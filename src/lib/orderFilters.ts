import type { Prisma } from "@prisma/client";
import { rangeOf, istStartOfDay, addDays } from "./dates";
import { can, type SessionUser } from "./permissions";
import { CANCEL_STATUSES, REVENUE_STATUSES, TERMINAL_STATUSES } from "./constants";

type P = URLSearchParams;
const g = (p: P, k: string) => { const v = p.get(k); return v && v.trim() ? v.trim() : null; };

function dateRange(p: P, fromKey: string, toKey: string) {
  const f = g(p, fromKey), t = g(p, toKey);
  if (!f && !t) return undefined;
  return rangeOf("custom", f, t);
}

/**
 * Manage Orders ke sabhi filters ko Prisma where me badalta hai.
 * `skip` me diye gaye keys ignore hote hain (tab counts ke liye).
 */
export function buildOrderWhere(p: P, user: SessionUser, skip: string[] = []): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [{ deletedAt: null }];
  const use = (k: string) => !skip.includes(k);

  // Visibility: agent sirf apne orders, dealer sirf apne
  if (user.role === "DEALER") and.push({ dealer: { loginUserId: user.id } });
  else if (user.role === "ZM") and.push({ OR: [{ dealer: { zmId: user.id } }, { leadOwnerId: user.id }] });
  else if (!can(user, "orders.viewAll")) and.push({ leadOwnerId: user.id });

  // Date (top)
  const date = g(p, "date");
  if (date && date !== "all") and.push({ createdAt: rangeOf(date) });

  // Status tab / status filter
  const tab = g(p, "tab");
  const today = istStartOfDay();
  const tomorrow = addDays(today, 1);
  if (use("tab") && tab) {
    if (tab === "action") {
      and.push({ status: { notIn: TERMINAL_STATUSES }, OR: [{ followupAt: { lt: tomorrow } }, { status: "New", leadOwnerId: null }] });
    } else if (tab === "tomorrow") {
      and.push({ followupAt: { gte: tomorrow, lt: addDays(tomorrow, 1) }, status: { notIn: TERMINAL_STATUSES } });
    } else if (tab !== "all") and.push({ status: tab });
  }
  const status = g(p, "status");
  if (status) and.push({ status });

  // Work chips
  const chip = g(p, "chip");
  if (use("chip") && chip) {
    const r = rangeOf(date && date !== "all" ? date : "today");
    switch (chip) {
      case "assignedToday": and.push({ agentAssignedAt: r }); break;
      case "pool": and.push({ agentAssignedAt: r, OR: [{ lastHumanWorkAt: null }, { lastHumanWorkAt: { lt: r.gte } }] }); break;
      case "worked": and.push({ lastHumanWorkAt: rangeOf("today") }); break;
      case "sutra": and.push({ leadOwnerId: null, product: { contains: "Sutra", mode: "insensitive" }, status: "New" }); break;
      case "nasha": and.push({ leadOwnerId: null, OR: [{ product: { contains: "Addiction", mode: "insensitive" } }, { source: { startsWith: "Nasha" } }], status: "New" }); break;
      case "recycled": and.push({ recycled: true, status: "New" }); break;
      case "dueToday": and.push({ followupAt: { gte: today, lt: tomorrow }, status: { notIn: TERMINAL_STATUSES } }); break;
      case "overdue": and.push({ followupAt: { lt: today }, status: { notIn: TERMINAL_STATUSES } }); break;
      case "future": and.push({ followupAt: { gte: tomorrow }, status: { notIn: TERMINAL_STATUSES } }); break;
    }
  }

  // Quick filters
  const qf = g(p, "qf");
  if (qf) for (const q of qf.split(",")) {
    if (q === "unassigned") and.push({ leadOwnerId: null });
    if (q === "pendingFollowups") and.push({ followupAt: { not: null }, status: { notIn: TERMINAL_STATUSES } });
    if (q === "onlinePaid") and.push({ online: { gt: 0 } });
    if (q === "confirmed") and.push({ status: "Confirmed" });
    if (q === "gpoDone") and.push({ status: "GPO Done" });
    if (q === "delivered") and.push({ status: { in: REVENUE_STATUSES } });
    if (q === "highValue") and.push({ total: { gte: 2000 } });
  }

  // Post office / Shipment status
  const post = g(p, "post");
  if (post) and.push(post === "action"
    ? { carrier: "INDIAPOST", shipStatus: { in: ["Item Kept on Hold", "Item Returned to Sender", "Portal Pending"] } }
    : { carrier: "INDIAPOST", shipStatus: post });
  const ship = g(p, "ship");
  if (ship) {
    if (ship === "action") and.push({ carrier: "SHIPROCKET", shipStatus: { in: ["NDR", "Pickup Error", "Lost"] } });
    else if (ship === "Label Pending") and.push({ carrier: "SHIPROCKET", awb: { not: null }, labelPrinted: false });
    else if (ship === "Manifest Pending") and.push({ carrier: "SHIPROCKET", awb: { not: null }, manifestDone: false });
    else and.push({ carrier: "SHIPROCKET", shipStatus: ship });
  }

  // Simple filters
  const eq: [string, keyof Prisma.OrderWhereInput][] = [
    ["source", "source"], ["paymentStatus", "paymentStatus"], ["state", "state"], ["district", "district"], ["product", "product"],
  ];
  for (const [k, f] of eq) { const v = g(p, k); if (v) and.push({ [f]: v } as Prisma.OrderWhereInput); }
  const like: [string, keyof Prisma.OrderWhereInput][] = [
    ["pincode", "pincode"], ["phone", "phone"], ["orderNo", "orderNo"], ["awb", "awb"], ["customer", "customerName"], ["city", "city"],
  ];
  for (const [k, f] of like) {
    const v = g(p, k);
    if (v) and.push({ [f]: { contains: v, mode: "insensitive" } } as Prisma.OrderWhereInput);
  }
  const q = g(p, "q");
  if (q) and.push({ OR: [
    { customerName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { orderNo: { contains: q, mode: "insensitive" } }, { awb: { contains: q } },
  ] });

  const courier = g(p, "courier");
  if (courier) {
    if (courier === "India Post") and.push({ carrier: "INDIAPOST" });
    else if (courier === "Shiprocket") and.push({ carrier: "SHIPROCKET" });
    else and.push({ courier });
  }

  const owner = g(p, "owner");
  if (owner) and.push(owner === "0" ? { leadOwnerId: null } : { leadOwnerId: +owner });
  const dealer = g(p, "dealer");
  if (dealer) and.push({ dealerId: +dealer });
  const da = g(p, "dealerAssigned");
  if (da === "1") and.push({ dealerId: { not: null } });
  if (da === "0") and.push({ dealerId: null });
  const zm = g(p, "zm");
  if (zm) and.push({ dealer: { zmId: +zm } });

  const ranges: [string, string, keyof Prisma.OrderWhereInput][] = [
    ["odFrom", "odTo", "createdAt"], ["bkFrom", "bkTo", "bookedAt"], ["fuFrom", "fuTo", "followupAt"],
    ["aaFrom", "aaTo", "agentAssignedAt"], ["daFrom", "daTo", "dealerAssignedAt"],
  ];
  for (const [f, t, field] of ranges) {
    const r = dateRange(p, f, t);
    if (r) and.push({ [field]: r } as Prisma.OrderWhereInput);
  }

  // Status change filters (history table se)
  const scR = dateRange(p, "scFrom", "scTo");
  const scStatus = g(p, "scStatus");
  const scBy = g(p, "scBy");
  if (scR || scStatus || scBy) {
    const h: Prisma.OrderHistoryWhereInput = { field: "status" };
    if (scR) h.createdAt = scR;
    if (scStatus) h.newValue = scStatus;
    if (scBy === "system") h.system = true;
    else if (scBy && /^\d+$/.test(scBy)) h.byUserId = +scBy;
    and.push({ history: { some: h } });
    if (scBy === "self") and.push({ statusChangedBy: "self" });
    if (scBy === "other") and.push({ statusChangedBy: "other" });
  }

  if (g(p, "workedToday")) and.push({ lastHumanWorkAt: rangeOf("today") });

  return { AND: and };
}

export { CANCEL_STATUSES };
