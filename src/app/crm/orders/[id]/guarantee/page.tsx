import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { BRAND } from "@/lib/constants";
import { fmtDate } from "@/lib/dates";
import PrintButton from "@/components/PrintButton";

export default async function GuaranteeCard({ params }: { params: { id: string } }) {
  await requirePage("/crm/orders");
  const o = await prisma.order.findUnique({ where: { id: +params.id } });
  if (!o) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <div className="no-print mb-4 text-right"><PrintButton /></div>
      <div className="rounded-3xl border-4 border-double border-green-800 bg-gradient-to-br from-green-50 to-amber-50 p-8 text-center text-slate-900">
        <div className="text-3xl">🌿</div>
        <h1 className="text-2xl font-extrabold text-green-900">{BRAND}</h1>
        <h2 className="mb-4 text-lg font-bold tracking-widest text-amber-700">GUARANTEE CARD</h2>
        <div className="space-y-1 text-left text-sm">
          <div><b>Card No:</b> {o.orderNo}</div><div><b>Naam:</b> {o.customerName}</div><div><b>Mobile:</b> {o.phone}</div>
          <div><b>Product:</b> {o.product} × {o.qty}</div><div><b>Tarikh:</b> {fmtDate(o.createdAt)}</div>
        </div>
        <p className="mt-6 text-xs text-slate-600">Niyamit sevan aur batayi gayi vidhi ka palan karein. Kisi bhi sahayata ke liye is card number ke saath sampark karein.</p>
      </div>
    </div>
  );
}
