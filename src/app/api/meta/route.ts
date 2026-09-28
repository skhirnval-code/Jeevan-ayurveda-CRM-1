import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { SHIPROCKET_COURIERS, STATES, STATUSES, DEFAULT_PRODUCTS } from "@/lib/constants";

/** Dropdowns ke liye sabhi master lists */
export const GET = handle(async () => {
  const me = await requireApi();
  const [sources, statuses, products, users, dealers, states] = await Promise.all([
    prisma.source.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.statusMaster.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    prisma.dealer.findMany({ where: { active: true }, select: { id: true, name: true, code: true, city: true, zmId: true }, orderBy: { name: "asc" } }),
    prisma.state.findMany({ orderBy: { name: "asc" }, include: { districts: { orderBy: { name: "asc" }, select: { name: true } } } }),
  ]);
  return ok({
    me: { id: me.id, name: me.name, role: me.role, permissions: me.permissions },
    sources: sources.map((s) => s.name),
    statuses: statuses.length ? statuses.map((s) => s.name) : [...STATUSES],
    products: products.length ? products.map((p) => p.name) : DEFAULT_PRODUCTS,
    agents: users.filter((u) => !["DEALER", "VIEWER", "ZM"].includes(u.role)),
    allUsers: users,
    zms: users.filter((u) => u.role === "ZM"),
    dealers,
    states: states.length ? states.map((s) => ({ name: s.name, districts: s.districts.map((d) => d.name) })) : STATES.map((n) => ({ name: n, districts: [] })),
    couriers: SHIPROCKET_COURIERS,
  });
});
