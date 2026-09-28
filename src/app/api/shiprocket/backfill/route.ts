import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { listOrders } from "@/lib/shiprocket";
import { fail, handle, ok } from "@/lib/api";

/** Shiprocket panel ke orders ko CRM orders se AWB/status ke liye match karta hai */
export const POST = handle(async (req: Request) => {
  await requireApi("page./crm/shiprocket");
  const { from, to, dryRun, page } = await req.json();
  if (!from || !to) return fail("From / To date do");
  const r = await listOrders(from, to, page || 1);
  const list: { channel_order_id: string; status: string; shipments?: { awb: string; courier: string; id: number }[] }[] = r?.data || [];
  const out: { orderNo: string; inCrm: boolean; awb?: string; status: string; panelBooked: boolean }[] = [];
  for (const x of list) {
    const o = await prisma.order.findUnique({ where: { orderNo: x.channel_order_id } });
    const s = x.shipments?.[0];
    out.push({ orderNo: x.channel_order_id, inCrm: !!o, awb: s?.awb, status: x.status, panelBooked: !o });
    if (!dryRun && o && s?.awb && !o.awb) {
      await prisma.order.update({ where: { id: o.id }, data: { carrier: "SHIPROCKET", awb: s.awb, courier: s.courier, shipmentId: String(s.id), shipStatus: x.status, bookedAt: o.bookedAt ?? new Date() } });
    }
  }
  return ok({ rows: out, meta: r?.meta?.pagination ?? null });
});
