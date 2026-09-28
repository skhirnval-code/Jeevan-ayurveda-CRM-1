import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { dealerLedger } from "@/lib/dealers";
import { rangeOf } from "@/lib/dates";
import { fail, handle, num, ok, str } from "@/lib/api";

/** Excel export */
export const GET = handle(async (req: Request) => {
  await requireApi("masters.view");
  const p = new URL(req.url).searchParams;
  const id = Number(p.get("dealer")); if (!id) return fail("Dealer chunein");
  const d = await prisma.dealer.findUniqueOrThrow({ where: { id } });
  const L = await dealerLedger(id, rangeOf(p.get("range") || "all", p.get("from"), p.get("to")));
  const rows = [{ TXN: "", DATE: "", PARTICULAR: "Opening balance", DEBIT: "", CREDIT: "", NET: "", RUNNING: L.opening },
    ...L.lines.map((l) => ({ TXN: l.txn, DATE: l.date.toISOString().slice(0, 10), PARTICULAR: l.particular, DEBIT: l.debit, CREDIT: l.credit, NET: l.net, RUNNING: l.running }))];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), d.code);
  return new Response(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="ledger-${d.code}.xlsx"` } });
});

/** Add Payment / Adjustment */
export const POST = handle(async (req: Request) => {
  const me = await requireApi("masters.edit");
  const b = await req.json();
  const amount = num(b.amount); if (!b.dealerId || amount <= 0) return fail("Dealer aur amount do");
  const type = String(b.type || "PAYMENT");
  const e = await prisma.ledgerEntry.create({
    data: {
      dealerId: num(b.dealerId), type, date: b.date ? new Date(b.date) : new Date(), mode: str(b.mode), refNo: str(b.refNo),
      particular: str(b.particular) || (type === "PAYMENT" ? "Payment received" : "Adjustment"),
      credit: type === "PAYMENT" || b.side === "credit" ? amount : 0, debit: type !== "PAYMENT" && b.side !== "credit" ? amount : 0, createdBy: me.id,
    },
  });
  await audit(me.id, "dealer.cash.create", String(b.dealerId), { amount, type });
  return ok(e, 201);
});

export const DELETE = handle(async (req: Request) => {
  const me = await requireApi("masters.edit");
  const id = Number(new URL(req.url).searchParams.get("id"));
  await prisma.ledgerEntry.delete({ where: { id } });
  await audit(me.id, "dealer.ledger.delete", String(id));
  return ok({ ok: true });
});
