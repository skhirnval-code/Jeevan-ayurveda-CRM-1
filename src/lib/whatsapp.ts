import crypto from "crypto";
import { prisma } from "./db";
import { computeAmounts, nextOrderNo } from "./orders";

/**
 * WhatsApp Cloud API (Meta) — Click-to-WhatsApp ad se aaye customer se bot
 * naam / pata / pincode / plan leta hai aur CRM me order banata hai.
 *
 * Env (Vercel):
 *   WA_TOKEN            — permanent System User access token
 *   WA_PHONE_NUMBER_ID  — WhatsApp number ka "Phone number ID"
 *   WA_APP_SECRET       — Meta App > Settings > Basic > App secret (signature check)
 *   WA_VERIFY_TOKEN     — koi bhi secret shabd, Meta webhook setup me yahi daalna
 *   WA_GRAPH_VERSION    — optional, default v23.0
 */

export const PLANS: Record<string, { label: string; button: string; qty: number; total: number }> = {
  "1set": { label: "1 सेट (1 महीना)", button: "1 सेट ₹1470", qty: 1, total: 1470 },
  "2set": { label: "2 सेट (2 महीने)", button: "2 सेट ₹2700", qty: 2, total: 2700 },
  "3month": { label: "3 महीने (पूरा कोर्स)", button: "3 महीने ₹3900", qty: 3, total: 3900 },
};
const PRODUCT = "Jeevan Ayurveda";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // adhoora chat 24 ghante baad naya shuru
const DONE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // order ke 7 din baad naya chat = naya order

type Step = "plan" | "name" | "address" | "pincode" | "confirm" | "done";
type Session = {
  step: Step;
  plan?: string;
  name?: string;
  address?: string;
  pincode?: string;
  waName?: string;
  ad?: { headline?: string; sourceId?: string; sourceUrl?: string; ctwaClid?: string };
  orderId?: number;
  orderNo?: string;
  seen?: string[]; // last processed message ids (Meta retry dedupe)
  noticeAt?: number;
  updatedAt: number;
};

/* ---------------- Meta API ---------------- */

export function verifySignature(raw: string, header: string | null) {
  const secret = process.env.WA_APP_SECRET;
  if (!secret) return true; // secret set nahi -> check skip (setup ke time)
  if (!header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function send(to: string, payload: Record<string, unknown>) {
  const token = process.env.WA_TOKEN;
  const phoneId = process.env.WA_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.error("WA_TOKEN / WA_PHONE_NUMBER_ID set nahi hain");
    return;
  }
  const v = process.env.WA_GRAPH_VERSION || "v23.0";
  const r = await fetch(`https://graph.facebook.com/${v}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...payload }),
  });
  if (!r.ok) console.error("WA send fail", r.status, await r.text().catch(() => ""));
}

const sendText = (to: string, body: string) => send(to, { type: "text", text: { body, preview_url: false } });

const sendButtons = (to: string, body: string, buttons: { id: string; title: string }[]) =>
  send(to, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  });

/* ---------------- Session (Setting table me, bina DB migration) ---------------- */

const key = (waId: string) => `wa:${waId}`;

async function loadSession(waId: string): Promise<Session | null> {
  const s = await prisma.setting.findUnique({ where: { key: key(waId) } });
  return (s?.value as unknown as Session) ?? null;
}
async function saveSession(waId: string, s: Session, keepTime = false) {
  if (!keepTime) s.updatedAt = Date.now(); // "done" me time na badhe, taaki 7 din baad naya order chale
  const value = s as unknown as object;
  await prisma.setting.upsert({ where: { key: key(waId) }, update: { value }, create: { key: key(waId), value } });
}

/* ---------------- Bot prompts ---------------- */

const askPlan = (to: string, s: Session) =>
  sendButtons(
    to,
    `🙏 नमस्ते${s.waName ? " " + s.waName : ""}! *Jeevan Ayurveda* में आपका स्वागत है।\n\nऑर्डर के लिए नीचे से अपना प्लान चुनें 👇\n(कैश ऑन डिलीवरी — सामान मिलने पर पैसे दें)`,
    Object.entries(PLANS).map(([id, p]) => ({ id: `plan_${id}`, title: p.button })),
  );
const askName = (to: string) => sendText(to, "✍️ अपना *पूरा नाम* लिखकर भेजें:");
const askAddress = (to: string) =>
  sendText(to, "🏠 अपना *पूरा पता* लिखें — मकान नंबर, गली/मोहल्ला, गाँव/शहर, ज़िला, राज्य\n(पिनकोड भी साथ लिख दें तो और अच्छा)");
const askPincode = (to: string) => sendText(to, "📮 अपने इलाके का *6 अंकों का पिनकोड* भेजें:");
const askConfirm = (to: string, s: Session) => {
  const p = PLANS[s.plan!];
  return sendButtons(
    to,
    `📋 *आपका ऑर्डर*\n\nप्लान: ${p.label}\nकुल: ₹${p.total} (COD)\nनाम: ${s.name}\nपता: ${s.address}\nपिनकोड: ${s.pincode}\n\nक्या सब सही है?`,
    [
      { id: "confirm_yes", title: "✅ ऑर्डर पक्का करें" },
      { id: "confirm_edit", title: "✏️ बदलें" },
    ],
  );
};

/* ---------------- Order ---------------- */

async function createOrder(waId: string, s: Session) {
  const p = PLANS[s.plan!];
  const phone = waId.replace(/\D/g, "").slice(-10);
  const source = s.ad ? "WhatsApp Ad" : "WhatsApp";
  await prisma.source.upsert({ where: { name: source }, update: {}, create: { name: source } });
  const amt = computeAmounts({ qty: p.qty, total: p.total });
  const adInfo = s.ad
    ? ` | Ad: ${[s.ad.headline, s.ad.sourceId && `id ${s.ad.sourceId}`].filter(Boolean).join(" ")}`
    : "";
  const o = await prisma.order.create({
    data: {
      orderNo: await nextOrderNo(),
      customerName: s.name!,
      phone,
      product: PRODUCT,
      extra: p.label,
      ...amt,
      unitPrice: Math.round(p.total / p.qty),
      address: s.address!,
      pincode: s.pincode!,
      source,
      storeKey: "whatsapp",
      status: "New",
      remark: `WhatsApp bot order — ${p.label}${adInfo}`.slice(0, 500),
    },
  });
  await prisma.orderHistory
    .create({ data: { orderId: o.id, field: "status", oldValue: null, newValue: "New", byName: "WhatsApp Bot", system: true } })
    .catch(() => null);
  return o;
}

/* ---------------- Main handler ---------------- */

type WaMessage = {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  interactive?: { button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
  button?: { payload?: string; text?: string };
  referral?: { source_url?: string; source_id?: string; source_type?: string; headline?: string; ctwa_clid?: string };
};

export async function handleMessage(m: WaMessage, waName?: string) {
  const to = m.from;
  const text = (m.text?.body ?? m.button?.text ?? "").trim();
  const replyId = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? m.button?.payload ?? "";
  const low = text.toLowerCase();

  let s = await loadSession(to);
  if (s?.seen?.includes(m.id)) return; // Meta ne dobara bheja
  const now = Date.now();

  const restartWords = ["नया ऑर्डर", "new order", "restart", "start", "शुरू", "menu"];
  const wantsRestart = replyId === "new_order" || restartWords.includes(low);

  if (
    !s ||
    wantsRestart ||
    (s.step !== "done" && now - s.updatedAt > SESSION_TTL_MS) ||
    (s.step === "done" && now - s.updatedAt > DONE_TTL_MS)
  ) {
    s = { step: "plan", waName, ad: s?.ad, seen: s?.seen, updatedAt: now };
  }
  if (waName) s.waName = waName;
  if (m.referral) {
    s.ad = { headline: m.referral.headline, sourceId: m.referral.source_id, sourceUrl: m.referral.source_url, ctwaClid: m.referral.ctwa_clid };
  }
  s.seen = [...(s.seen ?? []), m.id].slice(-10);

  if (["cancel", "रद्द", "stop"].includes(low) && s.step !== "done") {
    s.step = "plan";
    await saveSession(to, s);
    await sendText(to, "ठीक है, ऑर्डर रोक दिया। दोबारा ऑर्डर करना हो तो *नया ऑर्डर* लिखें।");
    return;
  }

  switch (s.step) {
    case "plan": {
      const id = replyId.startsWith("plan_") ? replyId.slice(5) : "";
      if (PLANS[id]) {
        s.plan = id;
        s.step = s.name ? "address" : "name";
        await saveSession(to, s);
        return s.name ? askAddress(to) : askName(to);
      }
      await saveSession(to, s);
      return askPlan(to, s);
    }
    case "name": {
      if (!text || text.length < 2 || text.length > 80 || /\d{5,}/.test(text)) {
        await saveSession(to, s);
        return sendText(to, "कृपया अपना सही *नाम* लिखें (सिर्फ़ नाम, नंबर नहीं):");
      }
      s.name = text;
      s.step = "address";
      await saveSession(to, s);
      return askAddress(to);
    }
    case "address": {
      if (!text || text.length < 10 || text.length > 500) {
        await saveSession(to, s);
        return sendText(to, "पता बहुत छोटा है 🙏 कृपया *पूरा पता* लिखें — गाँव/शहर, ज़िला, राज्य के साथ:");
      }
      s.address = text;
      const pin = text.match(/\b[1-9]\d{5}\b/)?.[0];
      if (pin) {
        s.pincode = pin;
        s.step = "confirm";
        await saveSession(to, s);
        return askConfirm(to, s);
      }
      s.step = "pincode";
      await saveSession(to, s);
      return askPincode(to);
    }
    case "pincode": {
      const pin = text.replace(/\s/g, "").match(/^[1-9]\d{5}$/)?.[0];
      if (!pin) {
        await saveSession(to, s);
        return sendText(to, "पिनकोड सही नहीं लगा। कृपया *6 अंकों का पिनकोड* भेजें (जैसे 302001):");
      }
      s.pincode = pin;
      s.step = "confirm";
      await saveSession(to, s);
      return askConfirm(to, s);
    }
    case "confirm": {
      if (replyId === "confirm_yes" || ["haan", "ha", "yes", "हाँ", "हां", "ok"].includes(low)) {
        const o = await createOrder(to, s);
        s.step = "done";
        s.orderId = o.id;
        s.orderNo = o.orderNo;
        await saveSession(to, s);
        return sendText(
          to,
          `✅ *ऑर्डर दर्ज हो गया!*\n\nऑर्डर नंबर: *${o.orderNo}*\nकुल: ₹${o.total} (कैश ऑन डिलीवरी)\n\nहमारी टीम जल्द ही आपको कॉल करके ऑर्डर कन्फ़र्म करेगी। 🙏\nधन्यवाद — Jeevan Ayurveda`,
        );
      }
      if (replyId === "confirm_edit" || ["badlo", "edit", "बदलें", "no", "nahi"].includes(low)) {
        s = { step: "plan", waName: s.waName, ad: s.ad, seen: s.seen, updatedAt: now };
        await saveSession(to, s);
        await sendText(to, "ठीक है, फिर से शुरू करते हैं 👇");
        return askPlan(to, s);
      }
      await saveSession(to, s);
      return askConfirm(to, s);
    }
    case "done": {
      // Order ke baad customer team se baat kare to bot baar-baar beech me na aaye: 12 ghante me ek hi baar yaad dilao
      const quiet = s.noticeAt && now - s.noticeAt < 12 * 60 * 60 * 1000;
      if (!quiet) s.noticeAt = now;
      await saveSession(to, s, true);
      if (quiet) return;
      return sendButtons(
        to,
        `आपका ऑर्डर *${s.orderNo}* पहले से दर्ज है ✅ हमारी टीम जल्द कॉल करेगी।\n\nकोई सवाल हो तो यहीं लिखें — टीम जवाब देगी। दूसरा ऑर्डर करना है तो नीचे दबाएँ।`,
        [{ id: "new_order", title: "🛒 नया ऑर्डर" }],
      );
    }
  }
}
