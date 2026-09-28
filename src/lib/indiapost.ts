/**
 * India Post (DoP) Business API adapter.
 * NOTE: DoP ka API contract-specific hai (Contract ID, BNPL/Advance account). Apne contract ke
 * documentation ke hisaab se endpoints/field names yahan bharein. Baaki CRM isi interface ko use karta hai.
 */
import type { Order } from "@prisma/client";
import { HttpError } from "./auth";

const cfg = () => ({
  base: process.env.INDIAPOST_BASE_URL || "",
  user: process.env.INDIAPOST_USERNAME || "",
  pass: process.env.INDIAPOST_PASSWORD || "",
  contract: process.env.INDIAPOST_CONTRACT_ID || "",
});

export function ipConfigured() {
  const c = cfg();
  return !!(c.base && c.user && c.pass && c.contract);
}

async function ip(path: string, body?: unknown) {
  const c = cfg();
  if (!ipConfigured()) throw new HttpError(400, "India Post API configure nahi hai (.env me INDIAPOST_* bharein)");
  const r = await fetch(c.base + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: "Basic " + Buffer.from(`${c.user}:${c.pass}`).toString("base64") },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(400, "India Post: " + JSON.stringify(j).slice(0, 200));
  return j;
}

/** Article number (barcode) Barcode Manager se aata hai — yahan booking request */
export async function bookArticle(o: Order, articleNo: string, weightGm = 500) {
  const c = cfg();
  const res = await ip("/booking", {
    contractId: c.contract, articleNumber: articleNo, articleType: "SP_COD",
    senderRef: o.orderNo, receiverName: o.customerName, receiverAddress: o.address, receiverCity: o.city,
    receiverState: o.state, receiverPincode: o.pincode, receiverMobile: o.phone,
    codAmount: o.balance, weight: weightGm,
  });
  return { awb: articleNo, raw: res };
}
export const trackArticle = (articleNo: string) => ip(`/tracking/${encodeURIComponent(articleNo)}`);
export const cancelArticle = (articleNo: string) => ip(`/cancel`, { articleNumber: articleNo });

/** India Post event -> CRM status */
export function mapPostEvent(ev: string): string | null {
  if (ev.startsWith("Item Delivered")) return "GPO Delivered";
  if (ev === "Item Booked") return "GPO Done";
  if (ev.includes("Returned") || ev.startsWith("RTO")) return "RTO";
  return null;
}
