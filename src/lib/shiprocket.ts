import type { Order } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./auth";

const BASE = "https://apiv2.shiprocket.in/v1/external";

async function activeAccount() {
  const acc = await prisma.shiprocketAccount.findFirst({ where: { active: true } });
  if (!acc) throw new HttpError(400, "Koi active Shiprocket account nahi. Shiprocket page par account add/activate karein.");
  return acc;
}

/** Token 9 din tak cache (Shiprocket token 10 din valid rehta hai) */
export async function srToken(accountId?: number) {
  const acc = accountId ? await prisma.shiprocketAccount.findUniqueOrThrow({ where: { id: accountId } }) : await activeAccount();
  if (acc.token && acc.tokenAt && Date.now() - acc.tokenAt.getTime() < 9 * 86400000) return { token: acc.token, acc };
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: acc.email, password: acc.password }),
  });
  const j = await r.json();
  if (!r.ok || !j.token) throw new HttpError(400, "Shiprocket login fail: " + (j.message || r.status));
  await prisma.shiprocketAccount.update({ where: { id: acc.id }, data: { token: j.token, tokenAt: new Date() } });
  return { token: j.token as string, acc };
}

async function sr(path: string, method = "GET", body?: unknown, accountId?: number) {
  const { token } = await srToken(accountId);
  const r = await fetch(`${BASE}${path}`, {
    method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(400, "Shiprocket: " + (j.message || JSON.stringify(j).slice(0, 200)));
  return j;
}

export async function testAccount(id: number) {
  await prisma.shiprocketAccount.update({ where: { id }, data: { token: null, tokenAt: null } });
  await srToken(id);
  return sr("/settings/company/pickup", "GET", undefined, id);
}

export async function serviceability(pincode: string, cod: boolean, weight = 0.5) {
  const pickup = process.env.PICKUP_PINCODE || "302001";
  return sr(`/courier/serviceability/?pickup_postcode=${pickup}&delivery_postcode=${pincode}&cod=${cod ? 1 : 0}&weight=${weight}`);
}

/** Order create + AWB assign (courierId na ho to Shiprocket recommended) */
export async function bookOrder(o: Order, opts: { courierId?: number; weight?: number; length?: number; breadth?: number; height?: number } = {}) {
  const { acc } = await srToken();
  const created = await sr("/orders/create/adhoc", "POST", {
    order_id: o.orderNo,
    order_date: new Date(o.createdAt).toISOString().slice(0, 16).replace("T", " "),
    pickup_location: acc.pickupLocation,
    billing_customer_name: o.customerName,
    billing_last_name: "",
    billing_address: o.address || "",
    billing_city: o.city || "",
    billing_pincode: o.pincode || "",
    billing_state: o.state || "",
    billing_country: "India",
    billing_email: o.email || "",
    billing_phone: o.phone,
    shipping_is_billing: true,
    order_items: [{ name: o.product, sku: o.product.replace(/\W+/g, "-").toUpperCase(), units: o.qty, selling_price: o.qty ? o.total / o.qty : o.total }],
    payment_method: o.balance > 0 ? "COD" : "Prepaid",
    sub_total: o.total,
    cod_amount: o.balance, // partial prepaid ke liye sirf balance collect
    length: opts.length ?? 15, breadth: opts.breadth ?? 10, height: opts.height ?? 5, weight: opts.weight ?? 0.5,
  });
  const awb = await sr("/courier/assign/awb", "POST", { shipment_id: created.shipment_id, courier_id: opts.courierId });
  const d = awb?.response?.data || {};
  return {
    shipOrderId: String(created.order_id), shipmentId: String(created.shipment_id),
    awb: d.awb_code as string | undefined, courier: d.courier_name as string | undefined,
  };
}

export const requestPickup = (shipmentIds: string[]) => sr("/courier/generate/pickup", "POST", { shipment_id: shipmentIds.map(Number) });
export const generateLabel = (shipmentIds: string[]) => sr("/courier/generate/label", "POST", { shipment_id: shipmentIds.map(Number) });
export const generateManifest = (shipmentIds: string[]) => sr("/manifests/generate", "POST", { shipment_id: shipmentIds.map(Number) });
export const trackAwb = (awb: string) => sr(`/courier/track/awb/${encodeURIComponent(awb)}`);
export const cancelAwbs = (awbs: string[]) => sr("/orders/cancel/shipment/awbs", "POST", { awbs });
export const listOrders = (from: string, to: string, page = 1) => sr(`/orders?from=${from}&to=${to}&page=${page}&per_page=50`);

/** Shiprocket status -> CRM order status */
export function mapSrStatus(s: string): string | null {
  const x = s.toUpperCase();
  if (x.includes("RTO") && x.includes("DELIVERED")) return "RTO";
  if (x === "DELIVERED") return "Delivered";
  if (x.includes("LOST")) return "Lost";
  if (x.includes("NDR") || x.includes("UNDELIVERED")) return "NDR";
  if (x.includes("TRANSIT") || x.includes("PICKED") || x.includes("OUT FOR DELIVERY") || x.includes("SHIPPED")) return "In Transit";
  if (x.includes("CANCEL")) return null;
  return null;
}
