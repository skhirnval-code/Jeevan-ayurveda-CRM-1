import { prisma } from "./db";
import { rangeOf } from "./dates";
import { REVENUE_STATUSES } from "./constants";
import { incentiveFor, loadIncentiveRules } from "./incentive";

export async function incentiveData(p: { range?: string; from?: string; to?: string; agent?: string; mode?: string }) {
  const r = rangeOf(p.range || "lm", p.from, p.to);
  const R = await loadIncentiveRules();
  const orders = await prisma.order.findMany({
    where: {
      deletedAt: null, status: { in: REVENUE_STATUSES }, deliveredAt: r, leadOwnerId: p.agent ? +p.agent : { not: null },
      ...(p.mode ? { leadOwner: { workMode: p.mode as "WFH" | "OFFICE" } } : {}),
    },
    select: { orderNo: true, total: true, online: true, balance: true, deliveredAt: true, customerName: true, leadOwner: { select: { id: true, name: true, workMode: true } } },
  });
  const byAgent = new Map<number, { id: number; name: string; mode: string; orders: number; amount: number; online: number; cod: number; onlinePart: number; codPart: number; incentive: number }>();
  const orderRows = orders.map((o) => {
    const mode = (o.leadOwner!.workMode as "WFH" | "OFFICE");
    const inc = incentiveFor(o, mode, R);
    const a = byAgent.get(o.leadOwner!.id) ?? { id: o.leadOwner!.id, name: o.leadOwner!.name, mode, orders: 0, amount: 0, online: 0, cod: 0, onlinePart: 0, codPart: 0, incentive: 0 };
    a.orders++; a.amount += o.total; a.online += o.online; a.cod += Math.max(0, o.total - o.online);
    a.onlinePart += inc.onlinePart; a.codPart += inc.codPart; a.incentive += inc.total;
    byAgent.set(a.id, a);
    return { orderNo: o.orderNo, agent: o.leadOwner!.name, mode, customer: o.customerName, total: o.total, online: o.online, cod: o.total - o.online, incentive: inc.total, deliveredAt: o.deliveredAt };
  });
  return { r, R, agents: [...byAgent.values()].sort((a, b) => b.incentive - a.incentive), orderRows };
}
