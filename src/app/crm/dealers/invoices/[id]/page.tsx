import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { COMPANY } from "@/lib/constants";
import { fmtDate, rupee } from "@/lib/dates";
import PrintButton from "@/components/PrintButton";

export default async function InvoicePrint({ params }: { params: { id: string } }) {
  await requirePage("/crm/dealers/invoices");
  const inv = await prisma.invoice.findUnique({ where: { id: +params.id }, include: { items: true, dealer: true } });
  if (!inv) notFound();
  const sellerState = process.env.COMPANY_STATE || "Rajasthan";
  const intra = (inv.dealer.state || "") === sellerState;
  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-slate-900 shadow">
      <div className="no-print mb-4 text-right"><PrintButton /></div>
      <div className="flex justify-between border-b-2 border-slate-800 pb-3">
        <div><h1 className="text-2xl font-bold">{COMPANY}</h1><div className="text-sm">GSTIN: {process.env.COMPANY_GSTIN || "-"} · {sellerState}</div></div>
        <div className="text-right"><div className="text-xl font-bold">TAX INVOICE</div><div className="text-sm">{inv.invoiceNo} · {fmtDate(inv.date)}</div></div>
      </div>
      <div className="my-4 grid grid-cols-2 gap-4 text-sm">
        <div><b>Bill To:</b><div>{inv.dealer.firmName || inv.dealer.name} ({inv.dealer.code})</div><div>{inv.dealer.address}, {inv.dealer.city}, {inv.dealer.state} {inv.dealer.pincode}</div><div>GSTIN: {inv.dealer.gst || "-"} · Mob: {inv.dealer.mobile || "-"}</div></div>
        <div className="text-right"><div>Payment Mode: {inv.paymentMode}</div><div>Status: {inv.status}</div></div>
      </div>
      <table className="w-full border text-sm">
        <thead className="bg-slate-100"><tr>{["#", "Product", "HSN", "Qty", "Rate", "GST %", "Amount"].map((h) => <th key={h} className="border p-2 text-left">{h}</th>)}</tr></thead>
        <tbody>{inv.items.map((i, n) => <tr key={i.id}><td className="border p-2">{n + 1}</td><td className="border p-2">{i.product}</td><td className="border p-2">{i.hsn}</td><td className="border p-2">{i.qty}</td><td className="border p-2">{rupee(i.rate)}</td><td className="border p-2">{i.gstRate}%</td><td className="border p-2 text-right">{rupee(i.amount)}</td></tr>)}</tbody>
      </table>
      <div className="ml-auto mt-3 w-72 space-y-1 text-sm">
        <div className="flex justify-between"><span>Sub-total</span><span>{rupee(inv.subTotal)}</span></div>
        {intra ? <><div className="flex justify-between"><span>CGST</span><span>{rupee(inv.gstAmount / 2)}</span></div><div className="flex justify-between"><span>SGST</span><span>{rupee(inv.gstAmount / 2)}</span></div></>
          : <div className="flex justify-between"><span>IGST</span><span>{rupee(inv.gstAmount)}</span></div>}
        <div className="flex justify-between"><span>Discount</span><span>- {rupee(inv.discount)}</span></div>
        <div className="flex justify-between border-t pt-1 text-base font-bold"><span>Grand Total</span><span>{rupee(inv.grandTotal)}</span></div>
        <div className="flex justify-between"><span>Paid</span><span>{rupee(inv.paidAmount)}</span></div>
        <div className="flex justify-between font-semibold"><span>Balance</span><span>{rupee(Math.max(0, inv.grandTotal - inv.paidAmount))}</span></div>
      </div>
      {inv.notes && <p className="mt-4 text-sm">Notes: {inv.notes}</p>}
      <div className="mt-16 text-right text-sm">For {COMPANY}<br /><br />Authorised Signatory</div>
    </div>
  );
}
