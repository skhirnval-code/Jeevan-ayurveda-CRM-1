import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";

/** Airtel IQ (ya koi bhi cloud telephony) call-log webhook */
export async function POST(req: Request) {
  if (req.headers.get("x-api-key") !== process.env.CALLS_WEBHOOK_TOKEN) return fail("unauthorized", 401);
  const b = await req.json().catch(() => ({}));
  const callId = String(b.callId || b.call_id || b.uuid || "");
  if (!callId) return fail("callId missing");
  const customerNo = String(b.customerNumber || b.to || b.from || "").replace(/\D/g, "").slice(-10);
  const ext = String(b.agentExtension || b.extension || "");
  const user = ext ? await prisma.user.findFirst({ where: { extension: ext } }) : null;
  const order = customerNo ? await prisma.order.findFirst({ where: { phone: customerNo, deletedAt: null }, orderBy: { createdAt: "desc" } }) : null;
  const data = {
    startedAt: new Date(b.startTime || Date.now()), userId: user?.id ?? null, customerNo, orderId: order?.id ?? null,
    direction: String(b.direction || "OUTBOUND").toUpperCase().startsWith("IN") ? "INBOUND" : "OUTBOUND",
    result: String(b.status || "Answered"), durationSec: Number(b.duration || 0), recordingUrl: b.recordingUrl || null,
  };
  await prisma.callLog.upsert({ where: { callId }, create: { callId, ...data }, update: data });
  return ok({ ok: true });
}
