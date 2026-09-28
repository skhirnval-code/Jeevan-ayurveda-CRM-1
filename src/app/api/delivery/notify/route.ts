import { applyShipEvent } from "@/lib/shipping";
import { fail, ok } from "@/lib/api";

/** Shiprocket webhook (Settings > API > Webhooks me ye URL + token daalein) */
export async function POST(req: Request) {
  const token = req.headers.get("x-api-key");
  if (process.env.SHIPROCKET_WEBHOOK_TOKEN && token !== process.env.SHIPROCKET_WEBHOOK_TOKEN) return fail("unauthorized", 401);
  const b = await req.json().catch(() => ({}));
  const awb = String(b.awb || "");
  const status = String(b.current_status || b.shipment_status || "");
  if (awb && status) await applyShipEvent("SHIPROCKET", awb, status, b.scans?.[0]?.location, b);
  return ok({ ok: true });
}
