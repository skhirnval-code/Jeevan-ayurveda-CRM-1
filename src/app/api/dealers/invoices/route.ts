import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, handle, num, ok, str } from "@/lib/api";
import { calcInvoice, nextInvoiceNo } from "@/lib/invoices";
import { rangeOf } from "@/lib/dates";

export const GET = handle(async (req: Request) => {
  const me = await requireApi("masters.view");
  const p = new URL(req.url).searchParams;
  const r = rangeOf(p.get("range") || "custom", p.get("from"), p.get("to"));
  const rows = await prisma.invoice.findMany({
    where: { date: r, ...(me.role === "DEALER" ? { dealer: { loginUserId: me.id } } : me.role === "ZM" ? { dealer: { zmId: me.id } } : {}) },
    orderBy: { date: "desc" }, take: 1000, include: { dealer: { select: { name: true, code: true } }, items: true },
  });
  return ok(rows);
});

export const POST = handle(async (req: Request) => {
  const me = await requireApi("masters.edit");
  const b = await req.json();
  if (!b.dealerId) return fail("Dealer chunein");
  const discount = num(b.discount);
  const c = calcInvoice(b.items || [], discount);
  if (!c.lines.length) return fail("Kam se kam ek item jodein");
  const paid = num(b.paidAmount);
  const inv = await prisma.invoice.create({
    data: {
      invoiceNo: await nextInvoiceNo(), dealerId: num(b.dealerId), paymentMode: String(b.paymentMode || "Bank Transfer"), paidAmount: paid, discount,
      subTotal: c.subTotal, gstAmount: c.gstAmount, grandTotal: c.grandTotal, status: paid >= c.grandTotal ? "Paid" : paid > 0 ? "Partial" : "Pending",
      notes: str(b.notes), items: { create: c.lines },
    },
  });
  // Ledger: invoice = debit, paid = credit
  await prisma.ledgerEntry.create({ data: { dealerId: inv.dealerId, type: "INVOICE", particular: `Invoice ${inv.invoiceNo}`, debit: inv.grandTotal, refNo: inv.invoiceNo, createdBy: me.id } });
  if (paid > 0) await prisma.ledgerEntry.create({ data: { dealerId: inv.dealerId, type: "PAYMENT", particular: `Payment - ${inv.invoiceNo}`, credit: paid, mode: inv.paymentMode, refNo: inv.invoiceNo, createdBy: me.id } });
  await audit(me.id, "dealer.invoice.create", inv.invoiceNo);
  return ok(inv, 201);
});
