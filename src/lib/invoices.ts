import { prisma } from "./db";
import { num, str } from "./api";

export type Item = { product: string; hsn?: string; qty: number; rate: number; gstRate?: number };

export function calcInvoice(items: Item[], discount: number) {
  const lines = items.filter((i) => i.product && num(i.qty) > 0).map((i) => ({ product: String(i.product), hsn: str(i.hsn), qty: num(i.qty), rate: num(i.rate), gstRate: num(i.gstRate), amount: num(i.qty) * num(i.rate) }));
  const subTotal = lines.reduce((a, l) => a + l.amount, 0);
  const gstAmount = lines.reduce((a, l) => a + (l.amount * l.gstRate) / 100, 0);
  return { lines, subTotal, gstAmount, grandTotal: Math.max(0, subTotal + gstAmount - discount) };
}

export async function nextInvoiceNo() {
  const n = (await prisma.invoice.count()) + 1;
  let no = "PH-DLR-" + String(n).padStart(4, "0"); let i = n;
  while (await prisma.invoice.findUnique({ where: { invoiceNo: no } })) no = "PH-DLR-" + String(++i).padStart(4, "0");
  return no;
}

