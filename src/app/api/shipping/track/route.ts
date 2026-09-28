import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { syncShiprocket } from "@/lib/shipping";
import { trackArticle, ipConfigured } from "@/lib/indiapost";
import { handle, ok } from "@/lib/api";

export const GET = handle(async (req: Request) => {
  await requireApi();
  const id = Number(new URL(req.url).searchParams.get("orderId"));
  const o = await prisma.order.findUniqueOrThrow({ where: { id } });
  if (o.carrier === "SHIPROCKET") await syncShiprocket(o.id);
  if (o.carrier === "INDIAPOST" && o.awb && ipConfigured()) await trackArticle(o.awb).catch(() => null);
  const events = o.awb ? await prisma.shipEvent.findMany({ where: { awb: o.awb }, orderBy: { at: "desc" } }) : [];
  return ok({ awb: o.awb, carrier: o.carrier, events });
});
