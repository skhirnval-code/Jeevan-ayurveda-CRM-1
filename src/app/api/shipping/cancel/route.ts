import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { cancelAwbs } from "@/lib/shiprocket";
import { cancelArticle, ipConfigured } from "@/lib/indiapost";
import { audit } from "@/lib/audit";
import { fail, handle, num, ok } from "@/lib/api";

export const POST = handle(async (req: Request) => {
  const { orderId } = await req.json();
  const o = await prisma.order.findUniqueOrThrow({ where: { id: num(orderId) } });
  if (!o.awb) return fail("Is order par koi booking nahi");
  if (o.carrier === "SHIPROCKET") { const me = await requireApi("sr.cancel"); await cancelAwbs([o.awb]); await audit(me.id, "shiprocket.cancel", o.orderNo); }
  else { const me = await requireApi("ip.cancel"); if (ipConfigured()) await cancelArticle(o.awb); await audit(me.id, "indiapost.release", o.orderNo); }
  await prisma.order.update({ where: { id: o.id }, data: { awb: null, carrier: null, courier: null, shipStatus: "Cancelled", shipmentId: null, shipOrderId: null, bookedAt: null } });
  return ok({ ok: true });
});
