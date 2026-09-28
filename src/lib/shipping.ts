import { prisma } from "./db";
import { HttpError } from "./auth";
import { audit } from "./audit";
import { updateOrder } from "./orders";
import * as SR from "./shiprocket";
import * as IP from "./indiapost";
import type { SessionUser } from "./permissions";

function checkAddress(o: { address: string | null; pincode: string | null; city: string | null; state: string | null }) {
  if (!o.address || !o.pincode || !/^\d{6}$/.test(o.pincode) || !o.state) throw new HttpError(400, "Address / 6-digit pincode / state poora bharein");
}

export async function bookShiprocket(orderId: number, user: SessionUser, opts: { courierId?: number; weight?: number } = {}) {
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (o.awb) throw new HttpError(400, `${o.orderNo} pehle se book hai (AWB ${o.awb})`);
  checkAddress(o);
  const r = await SR.bookOrder(o, opts);
  await prisma.order.update({
    where: { id: o.id },
    data: { carrier: "SHIPROCKET", courier: r.courier, awb: r.awb, shipOrderId: r.shipOrderId, shipmentId: r.shipmentId, shipStatus: r.awb ? "AWB Assigned" : "Booked", bookedAt: new Date(), lastHumanWorkAt: new Date() },
  });
  if (["Confirmed", "New", "Pending", "Confirm Pending"].includes(o.status)) await updateOrder(o.id, { status: "In Transit" }, user);
  await audit(user.id, "shiprocket.book", o.orderNo, r);
  return r;
}

export async function syncShiprocket(orderId: number) {
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!o.awb || o.carrier !== "SHIPROCKET") return null;
  const t = await SR.trackAwb(o.awb);
  const td = t?.tracking_data;
  const cur = td?.shipment_track?.[0]?.current_status as string | undefined;
  if (!cur) return null;
  await applyShipEvent("SHIPROCKET", o.awb, cur, td?.shipment_track_activities?.[0]?.location);
  return cur;
}

export async function bookIndiaPost(orderId: number, user: SessionUser, articleNo?: string) {
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (o.awb) throw new HttpError(400, `${o.orderNo} pehle se book hai (${o.awb})`);
  checkAddress(o);
  let art: string;
  if (articleNo) art = articleNo;
  else {
    const b = await prisma.barcode.findFirst({ where: { used: false }, orderBy: { id: "asc" } });
    if (!b) throw new HttpError(400, "Barcode khatam — India Post page par naye article numbers daalein");
    art = String(b.articleNo);
  }
  if (IP.ipConfigured()) await IP.bookArticle(o, art);
  await prisma.$transaction([
    prisma.barcode.updateMany({ where: { articleNo: art }, data: { used: true, orderId: o.id, usedAt: new Date() } }),
    prisma.order.update({ where: { id: o.id }, data: { carrier: "INDIAPOST", courier: "India Post", awb: art, shipStatus: "Portal file ka intezaar", bookedAt: new Date(), lastHumanWorkAt: new Date() } }),
  ]);
  if (!["GPO Done", "GPO Delivered"].includes(o.status)) await updateOrder(o.id, { status: "GPO Portal" }, user);
  await audit(user.id, "indiapost.book", o.orderNo, { articleNo: art });
  return { awb: art };
}

/** Webhook / tracking se aaya event: order shipStatus + CRM status update */
export async function applyShipEvent(carrier: "SHIPROCKET" | "INDIAPOST", awb: string, event: string, location?: string, raw?: unknown) {
  await prisma.shipEvent.create({ data: { carrier, awb, event, location: location ?? null, raw: (raw ?? undefined) as never } });
  const o = await prisma.order.findFirst({ where: { awb } });
  if (!o) return null;
  const shipStatus = carrier === "SHIPROCKET" ? normalizeSr(event) : event;
  await prisma.order.update({ where: { id: o.id }, data: { shipStatus, lastShipEventAt: new Date() } });
  const newStatus = carrier === "SHIPROCKET" ? SR.mapSrStatus(event) : IP.mapPostEvent(event);
  if (newStatus && newStatus !== o.status) await updateOrder(o.id, { status: newStatus }, null, { system: true });
  return o.id;
}

function normalizeSr(s: string) {
  const x = s.toUpperCase();
  if (x.includes("RTO") && x.includes("DELIVERED")) return "RTO Delivered";
  if (x.includes("RTO")) return "RTO Initiated";
  if (x.includes("OUT FOR DELIVERY")) return "Out For Delivery";
  if (x === "DELIVERED") return "Delivered";
  if (x.includes("NDR") || x.includes("UNDELIVERED")) return "NDR";
  if (x.includes("PICKUP") && x.includes("SCHEDULED")) return "Pickup Scheduled";
  if (x.includes("PICKUP") && (x.includes("ERROR") || x.includes("EXCEPTION"))) return "Pickup Error";
  if (x.includes("CANCEL")) return "Cancelled";
  if (x.includes("LOST") || x.includes("DAMAGE")) return "Lost";
  if (x.includes("AWB")) return "AWB Assigned";
  return "In Transit";
}
