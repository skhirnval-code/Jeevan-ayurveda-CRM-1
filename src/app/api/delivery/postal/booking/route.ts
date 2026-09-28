import { applyShipEvent } from "@/lib/shipping";
import { fail, ok } from "@/lib/api";

/** India Post booking confirmation webhook (post office scan "Item Booked") */
export async function POST(req: Request) {
  if (process.env.INGEST_TOKEN && req.headers.get("x-api-key") !== process.env.INGEST_TOKEN) return fail("unauthorized", 401);
  const b = await req.json().catch(() => ({}));
  const awb = String(b.articleNumber || "");
  if (awb) await applyShipEvent("INDIAPOST", awb, "Item Booked", String(b.office || ""), b);
  return ok({ ok: true });
}
