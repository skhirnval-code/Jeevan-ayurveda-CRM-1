import { requireApi } from "@/lib/auth";
import { serviceability } from "@/lib/shiprocket";
import { prisma } from "@/lib/db";
import { handle, ok } from "@/lib/api";

/** Book modal me courier list (rate, ETD) dikhane ke liye */
export const GET = handle(async (req: Request) => {
  await requireApi("sr.book");
  const id = Number(new URL(req.url).searchParams.get("orderId"));
  const o = await prisma.order.findUniqueOrThrow({ where: { id } });
  const r = await serviceability(o.pincode || "", o.balance > 0);
  const list = (r?.data?.available_courier_companies || []).map((c: Record<string, unknown>) => ({
    id: c.courier_company_id, name: c.courier_name, rate: c.rate, etd: c.etd, rating: c.rating, cod: c.cod,
  }));
  return ok({ couriers: list, recommended: r?.data?.recommended_courier_company_id });
});
