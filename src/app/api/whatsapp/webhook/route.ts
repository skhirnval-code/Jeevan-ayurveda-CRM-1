import { handleMessage, verifySignature } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Meta webhook verification: Callback URL save karte time Meta GET bhejta hai */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const mode = u.searchParams.get("hub.mode");
  const token = u.searchParams.get("hub.verify_token");
  const challenge = u.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WA_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

/** Naye WhatsApp messages */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("bad signature", { status: 401 });
  }
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("ok");
  }

  const myPhoneId = process.env.WA_PHONE_NUMBER_ID;
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.field !== "messages") continue; // echoes / history / status updates ignore
      const v = change.value ?? {};
      if (myPhoneId && v.metadata?.phone_number_id && v.metadata.phone_number_id !== myPhoneId) continue;
      const names: Record<string, string> = {};
      for (const c of v.contacts ?? []) if (c?.wa_id) names[c.wa_id] = c?.profile?.name;
      for (const m of v.messages ?? []) {
        try {
          await handleMessage(m, names[m.from]);
        } catch (e) {
          console.error("WA handle error", e);
        }
      }
    }
  }
  // Meta ko hamesha 200 do, warna woh baar-baar retry karta hai
  return new Response("ok");
}
