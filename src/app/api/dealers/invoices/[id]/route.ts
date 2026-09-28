import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { handle, num, ok, str } from "@/lib/api";
import { calcInvoice } from "@/lib/invoices";

type Ctx = { params: { id: string } };

export const GET = handle(async (_r: Request, { params }: Ctx) => {
  await requireApi("masters.view");
  return ok(await prisma.invoice.findUniqueOrThrow({ where: { id: +params.id }, include: { items: true, dealer: true } }));
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireApi("masters.edit");
  const b = await req.json();
  const old = await prisma.invoice.findUniqueOrThrow({ where: { id: +params.id } });
  const discount = num(b.discount);
  const c = calcInvoice(b.items || [], discount);
  const paid = num(b.paidAmount);
  const inv = await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: old.id } });
    const inv = await tx.invoice.update({
      where: { id: old.id },
      data: { paymentMode: String(b.paymentMode || old.paymentMode), paidAmount: paid, discount, subTotal: c.subTotal, gstAmount: c.gstAmount, grandTotal: c.grandTotal,
        status: paid >= c.grandTotal ? "Paid" : paid > 0 ? "Partial" : "Pending", notes: str(b.notes), items: { create: c.lines } },
    });
    await tx.ledgerEntry.deleteMany({ where: { refNo: old.invoiceNo, dealerId: old.dealerId } });
    await tx.ledgerEntry.create({ data: { dealerId: inv.dealerId, type: "INVOICE", particular: `Invoice ${inv.invoiceNo}`, debit: inv.grandTotal, refNo: inv.invoiceNo, createdBy: me.id } });
    if (paid > 0) await tx.ledgerEntry.create({ data: { dealerId: inv.dealerId, type: "PAYMENT", particular: `Payment - ${inv.invoiceNo}`, credit: paid, mode: inv.paymentMode, refNo: inv.invoiceNo, createdBy: me.id } });
    return inv;
  });
  await audit(me.id, "dealer.invoice.update", inv.invoiceNo);
  return ok(inv);
});

export const DELETE = handle(async (_r: Request, { params }: Ctx) => {
  const me = await requireApi("masters.edit");
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: +params.id } });
  await prisma.$transaction([
    prisma.ledgerEntry.deleteMany({ where: { refNo: inv.invoiceNo, dealerId: inv.dealerId } }),
    prisma.invoice.delete({ where: { id: inv.id } }),
  ]);
  await audit(me.id, "dealer.invoice.delete", inv.invoiceNo);
  return ok({ ok: true });
});
