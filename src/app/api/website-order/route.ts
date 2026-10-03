import { prisma } from "@/lib/db";
import { computeAmounts, nextOrderNo } from "@/lib/orders";
import { fail, ok, str } from "@/lib/api";

/**
 * jeevanayurveda.in website ke "COD ऑर्डर" form se seedha CRM me order.
 * Website isi domain par (rewrite se) chalti hai, isliye koi secret key nahi chahiye —
 * sirf apne domain ka Origin, honeypot field aur duplicate check.
 */
const ALLOWED = /^https:\/\/(www\.)?jeevanayurveda\.in$/;

const PLANS: Record<string, { label: string; qty: number; total: number }> = {
  "1set": { label: "1 सेट (1 महीना)", qty: 1, total: 1470 },
  "2set": { label: "2 सेट (2 महीने)", qty: 2, total: 2700 },
  "3month": { label: "3 महीने (पूरा कोर्स)", qty: 3, total: 3900 },
};

const SOURCE = "Website";
const PRODUCT = "Jeevan Ayurveda";

function cors(origin: string | null) {
  return origin && ALLOWED.test(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "content-type" }
    : {};
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED.test(origin)) return fail("forbidden", 403);
  const headers = cors(origin);
  const reply = (data: unknown, status = 200) => {
    const r = ok(data, status);
    Object.entries(headers).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  };

  const b = await req.json().catch(() => null);
  if (!b) return reply({ error: "invalid json" }, 400);
  if (str(b.website)) return reply({ ok: true }); // honeypot: bots ke liye chupa field

  const name = str(b.name);
  const phone = String(b.phone || "").replace(/\D/g, "").slice(-10);
  const pincode = String(b.pincode || "").replace(/\D/g, "");
  const address = str(b.address);
  const plan = PLANS[String(b.plan)] ?? null;

  if (!name || name.length > 80) return reply({ error: "नाम सही नहीं है" }, 400);
  if (!/^[6-9]\d{9}$/.test(phone)) return reply({ error: "मोबाइल नंबर सही नहीं है" }, 400);
  if (!/^\d{6}$/.test(pincode)) return reply({ error: "पिनकोड सही नहीं है" }, 400);
  if (!address || address.length > 500) return reply({ error: "पता सही नहीं है" }, 400);
  if (!plan) return reply({ error: "प्लान चुनें" }, 400);

  // Same number se 30 min ke andar dobara submit -> naya order nahi, purana hi lautao
  const recent = await prisma.order.findFirst({
    where: { phone, source: SOURCE, createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
    orderBy: { id: "desc" },
    select: { id: true, orderNo: true },
  });
  if (recent) return reply({ id: recent.id, orderNo: recent.orderNo, duplicate: true });

  await prisma.source.upsert({ where: { name: SOURCE }, update: {}, create: { name: SOURCE } });

  const amt = computeAmounts({ qty: plan.qty, total: plan.total });
  const o = await prisma.order.create({
    data: {
      orderNo: await nextOrderNo(),
      customerName: name,
      phone,
      product: PRODUCT,
      extra: plan.label,
      ...amt,
      unitPrice: Math.round(plan.total / plan.qty),
      address,
      pincode,
      source: SOURCE,
      storeKey: "jeevanayurveda.in",
      status: "New",
      remark: `Website COD order — ${plan.label}`,
    },
  });
  await prisma.orderHistory
    .create({ data: { orderId: o.id, field: "status", oldValue: null, newValue: "New", byName: "Website", system: true } })
    .catch(() => null);

  return reply({ id: o.id, orderNo: o.orderNo }, 201);
}
