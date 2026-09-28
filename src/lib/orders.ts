import type { Order, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ORDER_PREFIX, REVENUE_STATUSES, TERMINAL_STATUSES } from "./constants";
import { addDays, istStartOfDay } from "./dates";
import { can, type SessionUser } from "./permissions";
import { HttpError } from "./auth";
import { audit } from "./audit";

export async function nextOrderNo() {
  const last = await prisma.order.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  return `${ORDER_PREFIX}${String(100000 + (last?.id ?? 0) + 1)}`;
}

export function computeAmounts(input: { qty?: number; unitPrice?: number; total?: number; online?: number }) {
  const qty = Math.max(1, Math.round(input.qty ?? 1));
  const unitPrice = input.unitPrice ?? 0;
  const total = input.total && input.total > 0 ? input.total : qty * unitPrice;
  const online = Math.min(input.online ?? 0, total);
  const balance = Math.max(0, total - online);
  const paymentMode = online <= 0 ? "COD" : balance <= 0 ? "Prepaid" : "Partial";
  return { qty, unitPrice, total, online, balance, paymentMode };
}

/** Settings > Follow-up Rules: status badalne par agli follow-up date */
export async function followupFor(status: string): Promise<Date | null | undefined> {
  if (TERMINAL_STATUSES.includes(status)) return null;
  const rule = await prisma.followupRule.findUnique({ where: { status } });
  if (!rule) return undefined;
  return addDays(istStartOfDay(), rule.afterDays);
}

const EDITABLE: (keyof Order)[] = [
  "customerName", "phone", "altPhone", "email", "product", "extra", "qty", "unitPrice", "total", "online",
  "balance", "paymentMode", "paymentStatus", "address", "pincode", "city", "state", "district", "source",
  "status", "remark", "followupAt", "leadOwnerId", "dealerId", "courier", "awb",
];

/**
 * Ek order update karta hai: permission check, history, audit, follow-up rule.
 * `system=true` = webhook/courier ne badla.
 */
export async function updateOrder(id: number, patch: Partial<Order>, user: SessionUser | null, opts: { system?: boolean } = {}) {
  const old = await prisma.order.findUnique({ where: { id } });
  if (!old || old.deletedAt) throw new HttpError(404, "Order nahi mila");

  if (user && !opts.system) {
    if (!can(user, "orders.viewAll") && old.leadOwnerId !== user.id && user.role !== "SUPER_ADMIN")
      throw new HttpError(403, "Ye order aapka nahi hai");
    if (patch.status && patch.status !== old.status) {
      if (!can(user, "orders.status")) throw new HttpError(403, "Status badalne ki permission nahi");
      const touchesRevenue = REVENUE_STATUSES.includes(patch.status) || REVENUE_STATUSES.includes(old.status);
      if (touchesRevenue && !can(user, "orders.revenueStatus"))
        throw new HttpError(403, "Delivered / GPO Delivered lagane ya hataane ki permission nahi");
    }
    if (patch.leadOwnerId !== undefined && patch.leadOwnerId !== old.leadOwnerId && !can(user, "orders.assignOwner"))
      throw new HttpError(403, "Lead Owner badalne ki permission nahi");
    if (patch.dealerId !== undefined && patch.dealerId !== old.dealerId && !can(user, "orders.assignDealer"))
      throw new HttpError(403, "Dealer badalne ki permission nahi");
  }

  const data: Prisma.OrderUncheckedUpdateInput = {};
  const hist: Prisma.OrderHistoryCreateManyInput[] = [];
  for (const k of EDITABLE) {
    if (!(k in patch)) continue;
    const nv = patch[k] as unknown;
    const ov = old[k] as unknown;
    const same = nv instanceof Date && ov instanceof Date ? nv.getTime() === ov.getTime() : nv === ov;
    if (same) continue;
    (data as Record<string, unknown>)[k as string] = nv;
    const field = k === "status" ? "status" : k === "leadOwnerId" ? "leadOwner" : k === "dealerId" ? "dealer"
      : k === "followupAt" ? "followup" : k === "remark" ? "remark" : "edit:" + String(k);
    hist.push({
      orderId: id, field, oldValue: ov == null ? null : String(ov instanceof Date ? ov.toISOString() : ov),
      newValue: nv == null ? null : String(nv instanceof Date ? nv.toISOString() : nv),
      byUserId: user?.id ?? null, byName: opts.system ? "System" : user?.name ?? null, system: !!opts.system,
    });
  }
  if (!hist.length) return old;

  const now = new Date();
  if ("status" in data) {
    data.statusChangedAt = now;
    data.statusChangedById = user?.id ?? null;
    data.statusChangedBy = opts.system ? "system" : old.leadOwnerId === user?.id ? "self" : "other";
    if (!("followupAt" in data)) {
      const f = await followupFor(String(data.status));
      if (f !== undefined) data.followupAt = f;
    }
    if (REVENUE_STATUSES.includes(String(data.status))) {
      data.deliveredAt = now;
      data.paymentStatus = "Completed";
    }
    if (data.status === "New") data.recycled = old.status !== "New";
  }
  if ("leadOwnerId" in data) data.agentAssignedAt = data.leadOwnerId ? now : null;
  if ("dealerId" in data) {
    data.dealerAssignedAt = data.dealerId ? now : null;
    if (data.dealerId) {
      const d = await prisma.dealer.findUnique({ where: { id: Number(data.dealerId) } });
      data.dealerMargin = d?.defaultMargin ?? 0;
    }
  }
  if (!opts.system && user) data.lastHumanWorkAt = now;
  if ("qty" in data || "unitPrice" in data || "total" in data || "online" in data) {
    const a = computeAmounts({
      qty: Number(data.qty ?? old.qty), unitPrice: Number(data.unitPrice ?? old.unitPrice),
      total: "total" in data ? Number(data.total) : ("qty" in data || "unitPrice" in data) ? 0 : old.total,
      online: Number(data.online ?? old.online),
    });
    Object.assign(data, a);
  }

  const [upd] = await prisma.$transaction([
    prisma.order.update({ where: { id }, data }),
    prisma.orderHistory.createMany({ data: hist }),
  ]);
  if (!opts.system) await audit(user?.id ?? null, "order.update", old.orderNo, { changes: hist.map((h) => h.field) });
  return upd;
}
