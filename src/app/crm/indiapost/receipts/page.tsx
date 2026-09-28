import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { COMPANY } from "@/lib/constants";
import { sp1, type SP } from "@/components/ui";
import PrintButton from "@/components/PrintButton";

/** India Post address labels / receipts (A4 par 2 column) */
export default async function Receipts({ searchParams: sp }: { searchParams: SP }) {
  await requirePage("/crm/indiapost");
  const ids = (sp1(sp, "ids") || "").split(",").map(Number).filter(Boolean);
  const rows = await prisma.order.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } });
  return (
    <div className="bg-white text-slate-900">
      <div className="no-print mb-3 text-right"><PrintButton /></div>
      <div className="grid grid-cols-2 gap-3">
        {rows.map((o) => (
          <div key={o.id} className="break-inside-avoid rounded border-2 border-black p-3 text-sm">
            <div className="flex justify-between font-bold"><span>SPEED POST {o.balance > 0 ? "· COD" : ""}</span><span className="font-mono">{o.awb}</span></div>
            {o.balance > 0 && <div className="text-lg font-extrabold">COD: ₹{o.balance}</div>}
            <div className="mt-2"><b>To:</b> {o.customerName} · {o.phone}</div>
            <div>{o.address}</div><div>{o.city}, {o.district}, {o.state}</div><div className="text-lg font-bold">PIN {o.pincode}</div>
            <div className="mt-2 border-t pt-1 text-xs"><b>From:</b> {COMPANY} · Ref {o.orderNo}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
