import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { COMPANY } from "@/lib/constants";
import { fmtDate, rupee } from "@/lib/dates";
import PrintButton from "@/components/PrintButton";

export default async function OrderInvoice({ params }: { params: { id: string } }) {
  await requirePage("/crm/orders");
  const o = await prisma.order.findUnique({ where: { id: +params.id } });
  if (!o) notFound();
  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-slate-900 shadow">
      <div className="no-print mb-4 text-right"><PrintButton /></div>
      <div className="flex justify-between border-b pb-4">
        <div><h1 className="text-2xl font-bold">{COMPANY}</h1><div className="text-sm text-slate-500">Tax Invoice / Bill</div></div>
        <div className="text-right text-sm"><div><b>Invoice:</b> {o.orderNo}</div><div><b>Date:</b> {fmtDate(o.createdAt)}</div></div>
      </div>
      <div className="my-4 text-sm"><b>Bill To:</b><div>{o.customerName} · {o.phone}</div><div>{o.address}, {o.city}, {o.district}, {o.state} - {o.pincode}</div></div>
      <table className="w-full border text-sm">
        <thead className="bg-slate-100"><tr><th className="border p-2 text-left">Item</th><th className="border p-2">Qty</th><th className="border p-2">Rate</th><th className="border p-2">Amount</th></tr></thead>
        <tbody><tr><td className="border p-2">{o.product}{o.extra ? ` (${o.extra})` : ""}</td><td className="border p-2 text-center">{o.qty}</td><td className="border p-2 text-right">{rupee(o.unitPrice || o.total / (o.qty || 1))}</td><td className="border p-2 text-right">{rupee(o.total)}</td></tr></tbody>
        <tfoot>
          <tr><td colSpan={3} className="border p-2 text-right">Online paid</td><td className="border p-2 text-right">{rupee(o.online)}</td></tr>
          <tr><td colSpan={3} className="border p-2 text-right font-bold">COD / Balance</td><td className="border p-2 text-right font-bold">{rupee(o.balance)}</td></tr>
        </tfoot>
      </table>
      <p className="mt-8 text-center text-xs text-slate-500">Dhanyavaad! Ye computer generated invoice hai.</p>
    </div>
  );
}
