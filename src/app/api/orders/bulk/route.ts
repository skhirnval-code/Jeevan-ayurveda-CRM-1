import { prisma } from "@/lib/db";
import { HttpError, requireApi } from "@/lib/auth";
import { buildOrderWhere } from "@/lib/orderFilters";
import { updateOrder } from "@/lib/orders";
import { bookIndiaPost, bookShiprocket, syncShiprocket } from "@/lib/shipping";
import { audit } from "@/lib/audit";
import { fail, handle, num, ok } from "@/lib/api";
import { can } from "@/lib/permissions";

/** body: { ids?: number[], all?: boolean, query?: string, action, value?, remark? } */
export const POST = handle(async (req: Request) => {
  const me = await requireApi("orders.view");
  const b = await req.json();
  let ids: number[] = Array.isArray(b.ids) ? b.ids.map(Number) : [];
  if (b.all) {
    const rows = await prisma.order.findMany({ where: buildOrderWhere(new URLSearchParams(b.query || ""), me), select: { id: true } });
    ids = rows.map((r) => r.id);
  }
  if (!ids.length) return fail("Koi order select nahi hai");
  if (ids.length > 5000) return fail("Ek baar me max 5000 orders");

  const need: Record<string, string> = {
    status: "orders.status", recycle: "orders.status", owner: "orders.assignOwner", dealer: "orders.assignDealer",
    removeDealer: "orders.assignDealer", delete: "orders.delete", srBook: "sr.book", srSync: "sr.track", ipBook: "ip.book",
  };
  const perm = need[b.action];
  if (!perm) return fail("Unknown action");
  if (!can(me, perm)) throw new HttpError(403, "Permission nahi hai");

  const results = { ok: 0, failed: 0, errors: [] as string[] };
  const run = async (id: number, fn: () => Promise<unknown>) => {
    try { await fn(); results.ok++; } catch (e) { results.failed++; if (results.errors.length < 30) results.errors.push(`#${id}: ${(e as Error).message}`); }
  };

  if (b.action === "delete") {
    const r = await prisma.order.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date(), deletedReason: "bulk" } });
    await audit(me.id, "order.bulkDelete", `${r.count} orders`);
    return ok({ ok: r.count, failed: 0, errors: [] });
  }

  for (const id of ids) {
    switch (b.action) {
      case "status": await run(id, () => updateOrder(id, { status: String(b.value), ...(b.remark ? { remark: String(b.remark) } : {}) }, me)); break;
      case "recycle": await run(id, () => updateOrder(id, { status: "New", leadOwnerId: null }, me)); break;
      case "owner": await run(id, () => updateOrder(id, { leadOwnerId: b.value && b.value !== "0" ? num(b.value) : null }, me)); break;
      case "dealer": await run(id, () => updateOrder(id, { dealerId: num(b.value) }, me)); break;
      case "removeDealer": await run(id, () => updateOrder(id, { dealerId: null }, me)); break;
      case "srBook": await run(id, () => bookShiprocket(id, me)); break;
      case "srSync": await run(id, () => syncShiprocket(id)); break;
      case "ipBook": await run(id, () => bookIndiaPost(id, me)); break;
    }
  }
  const act = { status: "order.bulkStatus", recycle: "order.recycle", owner: "order.bulkAssign", dealer: "order.bulkAssign", removeDealer: "order.bulkAssign" } as Record<string, string>;
  if (act[b.action]) await audit(me.id, act[b.action], `${results.ok} orders`, { value: b.value });
  return ok(results);
});
