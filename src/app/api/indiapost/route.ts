import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ipConfigured, trackArticle } from "@/lib/indiapost";
import { rangeOf } from "@/lib/dates";
import { fail, handle, num, ok, str } from "@/lib/api";

/** body.action: barcodes.add | wallet.add | print | unprint | test | cheque */
export const POST = handle(async (req: Request) => {
  const me = await requireApi("page./crm/indiapost");
  const b = await req.json();
  switch (b.action) {
    case "barcodes.add": {
      const list = String(b.text || "").toUpperCase().split(/[\s,]+/).filter((x) => /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(x));
      if (!list.length) return fail("Sahi article number nahi mile (format: EY123456789IN)");
      const r = await prisma.barcode.createMany({ data: list.map((articleNo) => ({ articleNo })), skipDuplicates: true });
      await audit(me.id, "indiapost.barcode_add", `${r.count}`); return ok({ added: r.count, skipped: list.length - r.count });
    }
    case "wallet.add": {
      const amount = num(b.amount); if (!amount) return fail("Amount do");
      await prisma.walletEntry.create({ data: { type: b.type === "ADJUST" ? "ADJUST" : "RECHARGE", amount, note: str(b.note) } });
      await audit(me.id, "indiapost.wallet.recharge", String(amount)); return ok({ ok: true });
    }
    case "cheque": {
      await prisma.walletEntry.create({ data: { carrier: "INDIAPOST_COD", type: "CHEQUE", amount: num(b.amount), note: str(b.note) } });
      await audit(me.id, "indiapost.cod_cheque", String(b.amount)); return ok({ ok: true });
    }
    case "print": {
      await requireApi("ip.label");
      const r = rangeOf(b.range || "today", b.from, b.to);
      const where = { carrier: "INDIAPOST", awb: { not: null }, bookedAt: r, deletedAt: null, ...(b.which === "pending" ? { labelPrinted: false } : b.which === "done" ? { labelPrinted: true } : {}) };
      const rows = await prisma.order.findMany({ where, select: { id: true } });
      await prisma.order.updateMany({ where: { id: { in: rows.map((x) => x.id) } }, data: { labelPrinted: true } });
      await prisma.setting.upsert({ where: { key: "ip.lastPrint" }, create: { key: "ip.lastPrint", value: rows.map((x) => x.id) }, update: { value: rows.map((x) => x.id) } });
      await audit(me.id, "indiapost.label", `${rows.length}`);
      return ok({ ids: rows.map((x) => x.id) });
    }
    case "unprint": {
      const s = await prisma.setting.findUnique({ where: { key: "ip.lastPrint" } });
      const ids = (s?.value as number[]) || [];
      await prisma.order.updateMany({ where: { id: { in: ids } }, data: { labelPrinted: false } });
      await audit(me.id, "indiapost.unprint", `${ids.length}`); return ok({ count: ids.length });
    }
    case "test": {
      if (!ipConfigured()) return fail("INDIAPOST_* env set nahi hain");
      const any = await prisma.order.findFirst({ where: { carrier: "INDIAPOST", awb: { not: null } }, orderBy: { bookedAt: "desc" } });
      if (any?.awb) await trackArticle(any.awb);
      await audit(me.id, "indiapost.account.test", "ok"); return ok({ ok: true });
    }
  }
  return fail("Unknown action");
});
