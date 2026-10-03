import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { buildOrderWhere } from "@/lib/orderFilters";
import { computeAmounts, followupFor, nextOrderNo } from "@/lib/orders";
import { audit } from "@/lib/audit";
import { fail, handle, num, ok, str } from "@/lib/api";
import { REVENUE_STATUSES, STATUS_TABS } from "@/lib/constants";
import { incentiveFor, loadIncentiveRules } from "@/lib/incentive";
import { istStartOfDay } from "@/lib/dates";
import { can } from "@/lib/permissions";

const CHIPS = ["assignedToday", "pool", "worked", "sutra", "nasha", "recycled", "dueToday", "overdue", "future"];

export const GET = handle(async (req: Request) => {
  const me = await requireApi("orders.view");
  const p = new URL(req.url).searchParams;
  const size = Math.min(500, Math.max(5, num(p.get("size"), 20)));
  const page = Math.max(1, num(p.get("page"), 1));
  const where = buildOrderWhere(p, me);

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size,
      include: { leadOwner: { select: { id: true, name: true } }, dealer: { select: { id: true, name: true, code: true, zm: { select: { name: true } } } } },
    }),
  ]);

  // Tab counts (tab/chip filter ko chhod kar baaki filters ke saath)
  const base = buildOrderWhere(p, me, ["tab", "chip"]);
  const tabCounts: Record<string, number> = {};
  const byStatus = await prisma.order.groupBy({ by: ["status"], where: base, _count: true });
  for (const s of byStatus) tabCounts[s.status] = s._count;
  tabCounts.all = byStatus.reduce((a, b) => a + b._count, 0);
  for (const t of ["action", "tomorrow"]) {
    const q = new URLSearchParams(p); q.set("tab", t); q.delete("chip");
    tabCounts[t] = await prisma.order.count({ where: buildOrderWhere(q, me) });
  }
  const chipCounts: Record<string, number> = {};
  await Promise.all(CHIPS.map(async (c) => {
    const q = new URLSearchParams(p); q.set("chip", c); q.delete("tab");
    chipCounts[c] = await prisma.order.count({ where: buildOrderWhere(q, me) });
  }));
  // Assigned today: naye vs dubara (pehle kisi aur ke paas tha)
  const assignedRe = await prisma.orderHistory.count({
    where: { field: "leadOwner", oldValue: { not: null }, newValue: { not: null }, createdAt: { gte: istStartOfDay() } },
  });

  // Money cards: ONLINE / COD / INCENTIVE (delivered orders, filters ke saath)
  const delivered = await prisma.order.findMany({
    where: { AND: [base, { status: { in: REVENUE_STATUSES } }] },
    select: { total: true, online: true, balance: true, leadOwner: { select: { workMode: true } } },
  });
  const R = await loadIncentiveRules();
  const money = delivered.reduce((a, o) => {
    a.online += o.online; a.cod += Math.max(0, o.total - o.online);
    a.incentive += incentiveFor(o, (o.leadOwner?.workMode as "WFH" | "OFFICE") || "OFFICE", R).total;
    return a;
  }, { online: 0, cod: 0, incentive: 0 });
  if (!can(me, "reports.incentive") && me.role !== "AGENT") money.incentive = 0;

  return ok({ total, page, size, rows, tabCounts, chipCounts, assignedRe, money, tabs: STATUS_TABS });
});

export const POST = handle(async (req: Request) => {
  const me = await requireApi("orders.create");
  const b = await req.json();
  const name = str(b.customerName), phone = String(b.phone || "").replace(/\D/g, "").slice(-10);
  if (!name) return fail("Customer name zaroori hai");
  if (phone.length !== 10) return fail("Contact number 10 digit ka hona chahiye");
  if (b.pincode && !/^\d{6}$/.test(String(b.pincode))) return fail("Pincode 6 digit ka hona chahiye");
  const amt = computeAmounts({ qty: num(b.qty, 1), unitPrice: num(b.unitPrice), total: num(b.total), online: num(b.online) });
  const status = str(b.status) || "New";
  const fu = b.followupAt ? new Date(b.followupAt) : await followupFor(status);
  const leadOwnerId = can(me, "orders.assignOwner") && b.leadOwnerId ? num(b.leadOwnerId) : (me.role === "AGENT" ? me.id : null);
  const dealerId = can(me, "orders.assignDealer") && b.dealerId ? num(b.dealerId) : null;
  const dealer = dealerId ? await prisma.dealer.findUnique({ where: { id: dealerId } }) : null;

  // Duplicate guard: same number + product ka order pichle 60 sec me bana hai to naya mat banao, wahi lauta do
  const dup = await prisma.order.findFirst({
    where: { phone, deletedAt: null, product: str(b.product) || "Other", createdAt: { gte: new Date(Date.now() - 60_000) } },
    orderBy: { id: "desc" },
  });
  if (dup) return ok(dup, 200);

  const data: Prisma.OrderUncheckedCreateInput = {
    orderNo: await nextOrderNo(), customerName: name, phone,
    altPhone: str(b.altPhone), email: str(b.email), product: str(b.product) || "Other", extra: str(b.extra),
    ...amt, paymentMode: str(b.paymentMode) || amt.paymentMode, paymentStatus: str(b.paymentStatus) || "Pending",
    address: str(b.address), pincode: str(b.pincode), city: str(b.city), state: str(b.state), district: str(b.district),
    source: str(b.source) || "Calling", status, remark: str(b.remark), followupAt: fu ?? null,
    leadOwnerId, agentAssignedAt: leadOwnerId ? new Date() : null,
    dealerId, dealerAssignedAt: dealerId ? new Date() : null, dealerMargin: dealer?.defaultMargin ?? null,
    lastHumanWorkAt: new Date(),
  };
  const o = await prisma.order.create({ data });
  await prisma.orderHistory.create({ data: { orderId: o.id, field: "status", oldValue: null, newValue: status, byUserId: me.id, byName: me.name } });
  await audit(me.id, "order.create", o.orderNo);
  return ok(o, 201);
});
