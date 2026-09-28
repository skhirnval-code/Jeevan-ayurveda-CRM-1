import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { generateLabel, generateManifest, requestPickup } from "@/lib/shiprocket";
import { rangeOf } from "@/lib/dates";
import { fail, handle, ok } from "@/lib/api";

/** body: { kind: "label" | "manifest" | "pickup", range, from, to, which: "pending" | "done" | "both" } */
export const POST = handle(async (req: Request) => {
  const me = await requireApi("sr.label");
  const b = await req.json();
  const r = rangeOf(b.range || "today", b.from, b.to);
  const flag = b.kind === "manifest" ? "manifestDone" : "labelPrinted";
  const where = { carrier: "SHIPROCKET", shipmentId: { not: null }, bookedAt: r, deletedAt: null, ...(b.which === "pending" ? { [flag]: false } : b.which === "done" ? { [flag]: true } : {}) };
  const rows = await prisma.order.findMany({ where, select: { id: true, shipmentId: true } });
  if (!rows.length) return fail("Is filter me koi shipment nahi");
  const ids = rows.map((x) => x.shipmentId!);
  let url: string | undefined;
  if (b.kind === "pickup") { await requestPickup(ids); await prisma.order.updateMany({ where: { id: { in: rows.map((x) => x.id) } }, data: { shipStatus: "Pickup Scheduled" } }); await audit(me.id, "shiprocket.pickup", `${ids.length}`); return ok({ count: ids.length }); }
  if (b.kind === "manifest") { const m = await generateManifest(ids); url = m.manifest_url; }
  else { const l = await generateLabel(ids); url = l.label_url; }
  await prisma.order.updateMany({ where: { id: { in: rows.map((x) => x.id) } }, data: { [flag]: true } });
  await audit(me.id, "shiprocket.documents", b.kind, { count: ids.length });
  return ok({ url, count: ids.length });
});
