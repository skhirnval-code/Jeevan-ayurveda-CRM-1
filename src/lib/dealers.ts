import { REVENUE_STATUSES, CANCEL_STATUSES } from "./constants";
import type { Range } from "./dates";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { num, str } from "./api";

export function dealerWhere(p: URLSearchParams, me: { id: number; role: string }): Prisma.DealerWhereInput {
  const and: Prisma.DealerWhereInput[] = [];
  if (me.role === "ZM") and.push({ zmId: me.id });
  if (me.role === "DEALER") and.push({ loginUserId: me.id });
  const q = p.get("q");
  if (q) and.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }, { mobile: { contains: q } }] });
  const st = p.get("status"); if (st) and.push({ active: st === "active" });
  for (const k of ["state", "district", "city", "territory"] as const) { const v = p.get(k); if (v) and.push({ [k]: v }); }
  const zm = p.get("zm"); if (zm) and.push(zm === "none" ? { zmId: null } : { zmId: +zm });
  return { AND: and };
}

export async function nextDealerCode() {
  const last = await prisma.dealer.findFirst({ where: { code: { startsWith: "PHD" } }, orderBy: { code: "desc" } });
  const n = last ? parseInt(last.code.replace(/\D/g, ""), 10) + 1 : 1;
  return "PHD" + String(n).padStart(4, "0");
}

export function pickDealer(b: Record<string, unknown>) {
  return {
    username: str(b.username), firmName: str(b.firmName), contactPerson: str(b.contactPerson), mobile: str(b.mobile), altMobile: str(b.altMobile),
    email: str(b.email), gst: str(b.gst), pan: str(b.pan), address: str(b.address), city: str(b.city)?.toUpperCase() ?? null, pincode: str(b.pincode),
    territory: str(b.territory), state: str(b.state), district: str(b.district), creditLimit: b.creditLimit ? num(b.creditLimit) : null,
    openingStock: b.openingStock ? Math.round(num(b.openingStock)) : null, defaultMargin: num(b.defaultMargin), minStock: b.minStock ? Math.round(num(b.minStock)) : 20,
    notes: str(b.notes), zmId: b.zmId ? num(b.zmId) : null,
  };
}


export type LedgerLine = { txn: string; date: Date; particular: string; debit: number; credit: number; net: number; running: number; kind: string; id?: number };

/**
 * Dealer ledger: delivered orders = SALE (debit = total - margin), LedgerEntry = payment (credit) / invoice/adjust (debit).
 * Running balance range se pehle ka opening leke chalta hai.
 */
export async function dealerLedger(dealerId: number, r: Range) {
  const [orders, entries] = await Promise.all([
    prisma.order.findMany({ where: { dealerId, deletedAt: null, status: { in: REVENUE_STATUSES } }, select: { orderNo: true, customerName: true, total: true, dealerMargin: true, deliveredAt: true, createdAt: true } }),
    prisma.ledgerEntry.findMany({ where: { dealerId } }),
  ]);
  const all: Omit<LedgerLine, "net" | "running">[] = [
    ...orders.map((o) => ({ txn: o.orderNo, date: o.deliveredAt ?? o.createdAt, particular: `Sale · ${o.customerName} (margin ₹${o.dealerMargin ?? 0})`, debit: o.total - (o.dealerMargin ?? 0), credit: 0, kind: "SALE" })),
    ...entries.map((e) => ({ txn: e.refNo || `TXN${e.id}`, date: e.date, particular: e.particular + (e.mode ? ` (${e.mode})` : ""), debit: e.debit, credit: e.credit, kind: e.type, id: e.id })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  let running = 0; const lines: LedgerLine[] = []; let opening = 0;
  for (const l of all) {
    running += l.debit - l.credit;
    if (r.gte && l.date < r.gte) { opening = running; continue; }
    if (r.lt && l.date >= r.lt) continue;
    lines.push({ ...l, net: l.debit - l.credit, running });
  }
  const sale = lines.filter((l) => l.kind === "SALE");
  const pay = lines.filter((l) => l.credit > 0);
  return {
    opening, lines, totalSale: sale.reduce((a, l) => a + l.debit, 0), saleCount: sale.length,
    totalPayment: pay.reduce((a, l) => a + l.credit, 0), payCount: pay.length, balance: running,
  };
}

export async function dealerCumulative(r: Range, search?: string | null, zmId?: number) {
  const dealers = await prisma.dealer.findMany({
    where: { ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { code: { contains: search, mode: "insensitive" } }] } : {}), ...(zmId ? { zmId } : {}) },
    orderBy: { name: "asc" },
  });
  const ids = dealers.map((d) => d.id);
  const dateW = r.gte || r.lt ? { deliveredAt: r } : {};
  const [sales, statusRows, pays, invoices, stock] = await Promise.all([
    prisma.order.groupBy({ by: ["dealerId"], where: { dealerId: { in: ids }, deletedAt: null, status: { in: REVENUE_STATUSES }, ...dateW }, _count: true, _sum: { total: true, qty: true, dealerMargin: true, balance: true } }),
    prisma.order.groupBy({ by: ["dealerId", "status"], where: { dealerId: { in: ids }, deletedAt: null, ...(r.gte || r.lt ? { dealerAssignedAt: r } : {}) }, _count: true }),
    prisma.ledgerEntry.groupBy({ by: ["dealerId"], where: { dealerId: { in: ids }, credit: { gt: 0 }, ...(r.gte || r.lt ? { date: r } : {}) }, _sum: { credit: true } }),
    prisma.invoice.groupBy({ by: ["dealerId"], where: { dealerId: { in: ids } }, _sum: { grandTotal: true } }),
    prisma.invoiceItem.groupBy({ by: ["invoiceId"], _sum: { qty: true } }).then(async (rows) => {
      const inv = await prisma.invoice.findMany({ where: { id: { in: rows.map((x) => x.invoiceId) } }, select: { id: true, dealerId: true } });
      const m = new Map<number, number>();
      for (const x of rows) { const d = inv.find((i) => i.id === x.invoiceId)?.dealerId; if (d) m.set(d, (m.get(d) ?? 0) + (x._sum.qty ?? 0)); }
      return m;
    }),
  ]);
  return dealers.map((d) => {
    const s = sales.find((x) => x.dealerId === d.id);
    const totalSale = s?._sum.total ?? 0, comm = s?._sum.dealerMargin ?? 0, paid = pays.find((x) => x.dealerId === d.id)?._sum.credit ?? 0;
    const st = Object.fromEntries(statusRows.filter((x) => x.dealerId === d.id).map((x) => [x.status, x._count]));
    const assigned = Object.values(st).reduce((a, b) => a + b, 0);
    const delivered = s?._count ?? 0;
    const cancelled = CANCEL_STATUSES.concat(["RTO"]).reduce((a, k) => a + (st[k] ?? 0), 0);
    const stockIn = (d.openingStock ?? 0) + (stock.get(d.id) ?? 0);
    const soldQty = s?._sum.qty ?? 0;
    return {
      id: d.id, name: d.name, code: d.code, margin: d.defaultMargin, orders: delivered, qty: soldQty,
      totalSale, commission: comm, netSale: totalSale - comm, paid, balance: totalSale - comm - paid,
      status: st, assigned, delivered, cancelled, recovery: totalSale - comm ? (paid / (totalSale - comm)) * 100 : 0,
      stockIn, stockLeft: stockIn - soldQty, lowStock: stockIn - soldQty < d.minStock, profit: comm, invoiced: invoices.find((x) => x.dealerId === d.id)?._sum.grandTotal ?? 0,
    };
  });
}
