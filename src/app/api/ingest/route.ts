import { prisma } from "@/lib/db";
import { computeAmounts, nextOrderNo } from "@/lib/orders";
import { fail, num, ok, str } from "@/lib/api";

/**
 * Website / Shopify store se orders aane ka endpoint.
 * Header: x-api-key: INGEST_TOKEN. Body me storeKey (ya shop/shopDomain) -> Store Mapping se source lagta hai.
 */
export async function POST(req: Request) {
  if (req.headers.get("x-api-key") !== process.env.INGEST_TOKEN) return fail("unauthorized", 401);
  const b = await req.json().catch(() => null);
  if (!b) return fail("invalid json");
  const phone = String(b.phone || b.mobile || "").replace(/\D/g, "").slice(-10);
  if (phone.length !== 10) return ok({ skipped: "no mobile" });
  const storeKey = str(b.storeKey || b.store || b.shop || b.shopDomain);
  let source = str(b.source);
  if (!source && storeKey) {
    const m = await prisma.storeMapping.findUnique({ where: { storeKey }, include: { source: true } });
    source = m?.source.name ?? null;
  }
  const extId = str(b.externalId || b.order_id);
  if (extId && (await prisma.order.findFirst({ where: { remark: { contains: `[ext:${extId}]` } } }))) return ok({ duplicate: true });
  const amt = computeAmounts({ qty: num(b.qty, 1), unitPrice: num(b.price), total: num(b.total), online: num(b.online || b.paid) });
  const o = await prisma.order.create({
    data: {
      orderNo: await nextOrderNo(), customerName: str(b.name) || "Customer", phone, email: str(b.email), product: str(b.product) || "Other",
      ...amt, address: str(b.address), pincode: str(b.pincode), city: str(b.city), state: str(b.state),
      source: source || "Orders", storeKey, status: "New", remark: extId ? `[ext:${extId}]` : null,
    },
  });
  return ok({ id: o.id, orderNo: o.orderNo }, 201);
}
