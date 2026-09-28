import { applyShipEvent } from "@/lib/shipping";
import { fail, ok } from "@/lib/api";
import { prisma } from "@/lib/db";

/** India Post tracking events webhook */
export async function POST(req: Request) {
  if (process.env.INGEST_TOKEN && req.headers.get("x-api-key") !== process.env.INGEST_TOKEN) return fail("unauthorized", 401);
  const b = await req.json().catch(() => ({}));
  const list: Record<string, unknown>[] = Array.isArray(b) ? b : Array.isArray(b.events) ? b.events : [b];
  for (const e of list) {
    const awb = String(e.articleNumber || e.article_no || "");
    const ev = String(e.event || e.eventName || "");
    if (!awb || !ev) continue;
    await applyShipEvent("INDIAPOST", awb, ev, String(e.office || e.location || ""), e);
    if (e.tariff) await prisma.walletEntry.create({ data: { type: "DEBIT", amount: Number(e.tariff), awb, note: ev } });
  }
  return ok({ ok: true });
}
