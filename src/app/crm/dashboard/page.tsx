import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { buildOrderWhere } from "@/lib/orderFilters";
import { addDays, istStartOfDay, prevRange, rangeOf, toYMD, fmtDateTime, rupee, type Range } from "@/lib/dates";
import { CANCEL_STATUSES, PIPELINE_STATUSES, REVENUE_STATUSES, STATUSES, TERMINAL_STATUSES, statusClass } from "@/lib/constants";
import { Bar, Delta, PageHead, RangeLinks, Section, Stat, qs, sp1, type SP } from "@/components/ui";

const RANGES = [
  { key: "today", label: "Today" }, { key: "yest", label: "Yesterday" }, { key: "3d", label: "3 Days" }, { key: "7d", label: "7 Days" },
  { key: "15d", label: "15 Days" }, { key: "30d", label: "30 Days" }, { key: "tm", label: "This Month" }, { key: "lm", label: "Last Month" },
];

export default async function Dashboard({ searchParams: sp }: { searchParams: SP }) {
  const me = await requirePage("/crm/dashboard");
  const rk = sp1(sp, "range") || "today";
  const basis = sp1(sp, "basis") === "S" ? "statusChangedAt" : "createdAt";
  const r = rangeOf(rk, sp1(sp, "from"), sp1(sp, "to"));
  const pr = prevRange(r);
  const scope = buildOrderWhere(new URLSearchParams(), me);
  const W = (range: Range | null, extra: Prisma.OrderWhereInput = {}): Prisma.OrderWhereInput =>
    ({ AND: [scope, range ? { [basis]: range } : {}, extra] });

  const today = istStartOfDay();
  const tomorrow = addDays(today, 1);

  async function kpis(range: Range) {
    const [orders, leads, confirmed, pending, cancelled, callback, deliveredAgg, onlineAgg, codPending, pipeline] = await Promise.all([
      prisma.order.count({ where: W(range) }),
      prisma.order.count({ where: W(range, { status: "New" }) }),
      prisma.order.count({ where: W(range, { status: "Confirmed" }) }),
      prisma.order.count({ where: W(range, { status: "Pending" }) }),
      prisma.order.count({ where: W(range, { status: { in: CANCEL_STATUSES } }) }),
      prisma.order.count({ where: W(range, { status: "Callback" }) }),
      prisma.order.aggregate({ where: W(range, { status: { in: REVENUE_STATUSES } }), _sum: { total: true }, _count: true }),
      prisma.order.aggregate({ where: W(range), _sum: { online: true } }),
      prisma.order.aggregate({ where: W(range, { status: { notIn: TERMINAL_STATUSES } }), _sum: { balance: true } }),
      prisma.order.aggregate({ where: W(range, { status: { in: PIPELINE_STATUSES } }), _sum: { total: true } }),
    ]);
    return {
      orders, leads, confirmed, pending, cancelled, callback, delivered: deliveredAgg._count,
      revenue: deliveredAgg._sum.total ?? 0, online: onlineAgg._sum.online ?? 0, codPending: codPending._sum.balance ?? 0,
      pipeline: pipeline._sum.total ?? 0,
    };
  }

  const [k, kp, byStatus, bySource, byProduct, byState, dueToday, overdue, tomorrowCnt, recent, dueList, codDelivered, codCancel] = await Promise.all([
    kpis(r), pr ? kpis(pr) : Promise.resolve(null),
    prisma.order.groupBy({ by: ["status"], where: W(r), _count: true }),
    prisma.order.groupBy({ by: ["source"], where: W(r), _count: true, orderBy: { _count: { source: "desc" } }, take: 10 }),
    prisma.order.groupBy({ by: ["product"], where: W(r), _count: true, orderBy: { _count: { product: "desc" } }, take: 8 }),
    prisma.order.groupBy({ by: ["state"], where: W(r), _count: true, orderBy: { _count: { state: "desc" } }, take: 8 }),
    prisma.order.count({ where: W(null, { followupAt: { gte: today, lt: tomorrow }, status: { notIn: TERMINAL_STATUSES } }) }),
    prisma.order.count({ where: W(null, { followupAt: { lt: today }, status: { notIn: TERMINAL_STATUSES } }) }),
    prisma.order.count({ where: W(null, { followupAt: { gte: tomorrow, lt: addDays(tomorrow, 1) }, status: { notIn: TERMINAL_STATUSES } }) }),
    prisma.order.findMany({ where: W(null), orderBy: { createdAt: "desc" }, take: 10, select: { id: true, orderNo: true, customerName: true, createdAt: true, status: true, total: true } }),
    prisma.order.findMany({ where: W(null, { followupAt: { gte: today, lt: tomorrow }, status: { notIn: TERMINAL_STATUSES } }), take: 15, orderBy: { followupAt: "asc" }, select: { id: true, orderNo: true, customerName: true, phone: true, status: true } }),
    prisma.order.aggregate({ where: W(r, { status: { in: REVENUE_STATUSES } }), _sum: { balance: true } }),
    prisma.order.aggregate({ where: W(r, { status: { in: CANCEL_STATUSES } }), _sum: { balance: true } }),
  ]);

  // New vs repeat customers (range ke phones me se kitno ka pehle koi order tha)
  const phones = await prisma.order.findMany({ where: W(r), select: { phone: true }, distinct: ["phone"] });
  const repeat = r.gte && phones.length
    ? (await prisma.order.findMany({ where: { phone: { in: phones.map((p) => p.phone) }, createdAt: { lt: r.gte }, deletedAt: null }, select: { phone: true }, distinct: ["phone"] })).length
    : 0;
  const st = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
  const pct = (n: number) => (k.orders ? `${((n / k.orders) * 100).toFixed(1)}% of total` : "");
  const ordersLink = (extra: Record<string, string>) => qs("/crm/orders", {}, { ...extra, odFrom: r.gte ? toYMD(r.gte) : null, odTo: r.lt ? toYMD(addDays(r.lt, -1)) : null });

  // Agent status breakdown
  const ar = rangeOf(sp1(sp, "ar") || "today", sp1(sp, "afrom"), sp1(sp, "ato"));
  const aStatus = sp1(sp, "as"); const aAgent = sp1(sp, "aa");
  const agentRows = await prisma.order.groupBy({
    by: ["leadOwnerId", "status"], _count: true,
    where: { AND: [scope, { createdAt: ar }, aStatus ? { status: aStatus } : {}, aAgent ? { leadOwnerId: +aAgent } : {}] },
  });
  const agents = await prisma.user.findMany({ where: { id: { in: agentRows.map((a) => a.leadOwnerId).filter((x): x is number => !!x) } }, select: { id: true, name: true } });
  const agentMap = new Map<number | null, Record<string, number>>();
  for (const a of agentRows) { const m = agentMap.get(a.leadOwnerId) ?? {}; m[a.status] = a._count; agentMap.set(a.leadOwnerId, m); }
  const allAgents = await prisma.user.findMany({ where: { active: true, role: { in: ["AGENT", "MANAGER", "SUPER_ADMIN"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  const maxSrc = Math.max(1, ...bySource.map((s) => s._count));
  return (
    <div className="space-y-4">
      <PageHead title="Dashboard" sub={`${r.gte ? toYMD(r.gte) : "shuru"} to ${r.lt ? toYMD(addDays(r.lt, -1)) : "aaj"}`}>
        <Link className="btn" href="/crm/orders">Open Orders →</Link>
      </PageHead>
      <RangeLinks base="/crm/dashboard" sp={sp} options={RANGES} />
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Numbers based on:</span>
        <Link className={`btn btn-sm ${basis === "createdAt" ? "!bg-slate-900 !text-white" : ""}`} href={qs("/crm/dashboard", sp, { basis: null })}>[D] Order Date</Link>
        <Link className={`btn btn-sm ${basis !== "createdAt" ? "!bg-slate-900 !text-white" : ""}`} href={qs("/crm/dashboard", sp, { basis: "S" })}>[S] Status Change Date</Link>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <Link href="/crm/orders?chip=dueToday" className="rounded-xl bg-amber-100 p-3 font-medium text-amber-900">📞 आज आपको {dueToday} Follow-up करने हैं →</Link>
        <Link href="/crm/orders?chip=overdue" className="rounded-xl bg-red-100 p-3 font-medium text-red-900">⚠ {overdue} Overdue follow-up — अभी call करें →</Link>
        <Link href="/crm/orders?tab=tomorrow" className="rounded-xl bg-violet-100 p-3 font-medium text-violet-900">📅 कल {tomorrowCnt} follow-up →</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat icon="📦" label="Orders" value={k.orders} sub={<Delta now={k.orders} prev={kp?.orders} />} href={ordersLink({})} tone="blue" />
        <Stat icon="👥" label="Leads" value={k.leads} href={ordersLink({ status: "New" })} />
        <Stat icon="💰" label="Revenue" value={rupee(k.revenue)} sub={<Delta now={k.revenue} prev={kp?.revenue} />} tone="green" href={ordersLink({ qf: "delivered" })} />
        <Stat icon="🏦" label="Online Received" value={rupee(k.online)} sub={<Delta now={k.online} prev={kp?.online} />} tone="blue" href={ordersLink({ qf: "onlinePaid" })} />
        <Stat icon="⏳" label="COD Pending" value={rupee(k.codPending)} sub={<>Alag: {rupee(codDelivered._sum.balance ?? 0)} delivered · {rupee(codCancel._sum.balance ?? 0)} cancel</>} tone="amber" />
        <Stat icon="✅" label="Confirmed" value={k.confirmed} sub={pct(k.confirmed)} tone="green" href={ordersLink({ status: "Confirmed" })} />
        <Stat icon="🕒" label="Pending" value={k.pending} sub={<>{pct(k.pending)} <Delta now={k.pending} prev={kp?.pending} /></>} tone="amber" href={ordersLink({ status: "Pending" })} />
        <Stat icon="🚚" label="Pipeline Value" value={rupee(k.pipeline)} sub={<Delta now={k.pipeline} prev={kp?.pipeline} />} tone="violet" />
        <Stat icon="🎉" label="Delivered (Total)" value={k.delivered} sub={pct(k.delivered)} tone="teal" href={ordersLink({ qf: "delivered" })} />
        <Stat icon="❌" label="Cancelled" value={k.cancelled} sub={<>{pct(k.cancelled)} <Delta now={k.cancelled} prev={kp?.cancelled} /></>} tone="red" />
        <Stat icon="📞" label="Callback" value={k.callback} sub={pct(k.callback)} href={ordersLink({ status: "Callback" })} />
        <Stat icon="🌟" label="New Customers" value={phones.length - repeat} />
        <Stat icon="🔁" label="Repeat Customers" value={repeat} />
        <Stat icon="📞" label="Follow-ups Today" value={dueToday} href="/crm/orders?chip=dueToday" />
        <Stat icon="📦" label="Delivered" value={st["Delivered"] ?? 0} href={ordersLink({ status: "Delivered" })} />
        <Stat icon="🏣" label="GPO Delivered" value={st["GPO Delivered"] ?? 0} href={ordersLink({ status: "GPO Delivered" })} />
        <Stat icon="🚛" label="In Transit" value={st["In Transit"] ?? 0} href={ordersLink({ status: "In Transit" })} />
        <Stat icon="📦" label="GPO Done" value={st["GPO Done"] ?? 0} href={ordersLink({ status: "GPO Done" })} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Order Status">
          {byStatus.sort((a, b) => b._count - a._count).map((s) => (
            <div key={s.status} className="flex justify-between border-b py-1 text-sm"><span className={`rounded border px-2 text-xs ${statusClass(s.status)}`}>{s.status}</span><b>{s._count}</b></div>
          ))}
        </Section>
        <Section title="Top Sources">{bySource.map((s) => <Bar key={s.source} label={s.source} value={s._count} max={maxSrc} />)}</Section>
        <div className="space-y-4">
          <Section title="Top Products">{byProduct.map((s) => <div key={s.product} className="flex justify-between text-sm"><span>{s.product}</span><b>{s._count}</b></div>)}</Section>
          <Section title="Top States">{byState.map((s) => <div key={s.state ?? "-"} className="flex justify-between text-sm"><span>{s.state ?? "Unknown"}</span><b>{s._count}</b></div>)}</Section>
        </div>
      </div>

      <Section title="Payment Analysis">
        <div className="grid gap-3 md:grid-cols-3">
          <div><div className="text-sm text-slate-500">Online (in orders)</div><div className="text-xl font-bold">{rupee(k.online)}</div></div>
          <div><div className="text-sm text-slate-500">COD Pending</div><div className="text-xl font-bold">{rupee(k.codPending)}</div>
            <div className="text-xs text-slate-500">Alag: {rupee(codDelivered._sum.balance ?? 0)} delivered · {rupee(codCancel._sum.balance ?? 0)} cancel</div></div>
          <div><div className="text-sm text-slate-500">COD orders</div><div className="text-xl font-bold">{k.orders}</div></div>
        </div>
      </Section>

      <Section title="Agent Status Breakdown" right={
        <form className="flex flex-wrap gap-2" action="/crm/dashboard">
          {Object.entries(sp).filter(([x]) => !["ar", "as", "aa"].includes(x)).map(([x, v]) => <input key={x} type="hidden" name={x} value={String(v ?? "")} />)}
          <select name="ar" defaultValue={sp1(sp, "ar") || "today"} className="input !w-auto !py-1">
            {[["today", "Today"], ["yest", "Yesterday"], ["7d", "Last 7 Days"], ["30d", "Last 30 Days"], ["all", "All Time"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select name="as" defaultValue={aStatus} className="input !w-auto !py-1"><option value="">All Status</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <select name="aa" defaultValue={aAgent} className="input !w-auto !py-1"><option value="">All Agents</option>{allAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <button className="btn btn-sm">Apply</button>
        </form>
      }>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Agent / Lead Owner</th>{STATUSES.map((s) => <th key={s}>{s}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {[...agentMap.entries()].map(([id, m]) => (
                <tr key={String(id)}><td className="font-medium">{id ? agents.find((a) => a.id === id)?.name : "Unassigned"}</td>
                  {STATUSES.map((s) => <td key={s} className="text-center">{m[s] ?? ""}</td>)}
                  <td className="font-bold">{Object.values(m).reduce((a, b) => a + b, 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Recent Orders">
          {recent.map((o) => (
            <Link key={o.id} href={`/crm/orders/${o.id}`} className="flex justify-between border-b py-2 text-sm hover:bg-slate-50">
              <span><b>{o.customerName}</b> <span className="text-slate-500">{o.orderNo} · {fmtDateTime(o.createdAt)}</span></span>
              <span><span className={`mr-2 rounded border px-2 text-xs ${statusClass(o.status)}`}>{o.status}</span>{rupee(o.total)}</span>
            </Link>
          ))}
        </Section>
        <Section title={`Follow-ups Due Today (${dueToday})`}>
          {dueList.map((o) => (
            <div key={o.id} className="flex items-center justify-between border-b py-2 text-sm">
              <Link href={`/crm/orders/${o.id}`}><b>{o.customerName}</b> <span className="text-slate-500">{o.orderNo} · {o.status}</span></Link>
              <span className="flex gap-1"><a className="btn btn-sm" href={`tel:+91${o.phone}`}>Call</a><a className="btn btn-sm" target="_blank" href={`https://wa.me/91${o.phone}`}>WA</a></span>
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}
