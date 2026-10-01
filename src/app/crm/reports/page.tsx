import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { buildOrderWhere } from "@/lib/orderFilters";
import { addDays, istDate, istStartOfDay, rangeOf, rupee, toYMD } from "@/lib/dates";
import { REVENUE_STATUSES } from "@/lib/constants";
import { Bar, PageHead, RangeLinks, Section, Table, qs, sp1, type SP } from "@/components/ui";
import Link from "next/link";

const RANGES = [
  { key: "all", label: "All Time" }, { key: "today", label: "Today" }, { key: "yest", label: "Yesterday" }, { key: "7d", label: "7 Days" },
  { key: "15d", label: "15 Days" }, { key: "30d", label: "30 Days" }, { key: "tm", label: "This Month" }, { key: "lm", label: "Last Month" },
];

export default async function Reports({ searchParams: sp }: { searchParams: SP }) {
  const me = await requirePage("/crm/reports");
  const r = rangeOf(sp1(sp, "range") || "all", sp1(sp, "from"), sp1(sp, "to"));
  const source = sp1(sp, "source");
  const scope = buildOrderWhere(new URLSearchParams(), me);
  const where: Prisma.OrderWhereInput = { AND: [scope, { createdAt: r }, source ? { source } : {}] };
  const sources = await prisma.source.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  // Source performance
  const [srcAll, srcConf, srcDel] = await Promise.all([
    prisma.order.groupBy({ by: ["source"], where, _count: true }),
    prisma.order.groupBy({ by: ["source"], where: { AND: [where, { status: { in: ["Confirmed", "In Transit", "GPO", "GPO Done", ...REVENUE_STATUSES] } }] }, _count: true }),
    prisma.order.groupBy({ by: ["source"], where: { AND: [where, { status: { in: REVENUE_STATUSES } }] }, _count: true, _sum: { total: true } }),
  ]);
  const srcRows = srcAll.sort((a, b) => b._count - a._count).map((s) => {
    const c = srcConf.find((x) => x.source === s.source)?._count ?? 0;
    const d = srcDel.find((x) => x.source === s.source);
    return [s.source, s._count, c, d?._count ?? 0, `${s._count ? (((d?._count ?? 0) / s._count) * 100).toFixed(1) : 0}%`, rupee(d?._sum.total ?? 0)];
  });

  // Live status board (aaj / kal / date)
  const lb = sp1(sp, "lb") || "today";
  const day = lb === "today" ? istStartOfDay() : lb === "yest" ? addDays(istStartOfDay(), -1) : istDate(lb);
  const dayR = { gte: day, lt: addDays(day, 1) };
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const uname = (id: number | null) => (id ? users.find((u) => u.id === id)?.name ?? "#" + id : "Unassigned");
  const pipeRaw = await prisma.order.groupBy({
    by: ["leadOwnerId", "status"], where: { AND: [scope, { statusChangedAt: dayR, status: { in: ["Confirmed", "In Transit", "GPO", "GPO Done"] } }] }, _count: true, _sum: { online: true, balance: true },
  });
  const delRaw = await prisma.order.groupBy({
    by: ["leadOwnerId", "status"], where: { AND: [scope, { deliveredAt: dayR, status: { in: REVENUE_STATUSES } }] }, _count: true, _sum: { online: true, balance: true },
  });
  type Agg = Record<string, number>;
  const fold = (rows: typeof pipeRaw) => {
    const m = new Map<number | null, Agg>();
    for (const x of rows) {
      const a = m.get(x.leadOwnerId) ?? { online: 0, cod: 0, total: 0 };
      a[x.status] = (a[x.status] ?? 0) + x._count; a.online += x._sum.online ?? 0; a.cod += x._sum.balance ?? 0; a.total += x._count;
      m.set(x.leadOwnerId, a);
    }
    return [...m.entries()];
  };

  const byState = await prisma.order.groupBy({ by: ["state"], where, _count: true, orderBy: { _count: { state: "desc" } } });
  const stConf = await prisma.order.groupBy({ by: ["state"], where: { AND: [where, { status: { in: ["Confirmed", ...REVENUE_STATUSES] } }] }, _count: true });
  const maxSt = Math.max(1, ...byState.map((s) => s._count));

  const dealerAll = await prisma.order.groupBy({ by: ["dealerId"], where: { AND: [where, { dealerId: { not: null } }] }, _count: true });
  const dealerDel = await prisma.order.groupBy({ by: ["dealerId"], where: { AND: [where, { dealerId: { not: null }, status: { in: REVENUE_STATUSES } }] }, _count: true, _sum: { total: true } });
  const dealers = await prisma.dealer.findMany({ where: { id: { in: dealerAll.map((d) => d.dealerId!) } }, select: { id: true, name: true } });

  return (
    <div className="space-y-4">
      <PageHead title="Reports & Analytics" />
      <RangeLinks base="/crm/reports" sp={sp} options={RANGES} />
      <form className="flex items-end gap-2" action="/crm/reports">
        {Object.entries(sp).filter(([k]) => k !== "source").map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v ?? "")} />)}
        <div><label className="label">Source</label><select name="source" defaultValue={source} className="input !w-48"><option value="">All sources</option>{sources.map((s) => <option key={s.id}>{s.name}</option>)}</select></div>
        <button className="btn">Apply</button>
      </form>

      <Section title="📣 Source Performance"><Table head={["Source", "Total", "Conf.", "Deliv.", "Conv%", "Revenue"]} rows={srcRows} /></Section>

      <Section title="📡 Live Status Board" right={
        <div className="flex gap-2">
          <Link className={`btn btn-sm ${lb === "today" ? "!bg-blue-600 !text-white" : ""}`} href={qs("/crm/reports", sp, { lb: "today" })}>Aaj</Link>
          <Link className={`btn btn-sm ${lb === "yest" ? "!bg-blue-600 !text-white" : ""}`} href={qs("/crm/reports", sp, { lb: "yest" })}>Kal</Link>
          <form action="/crm/reports" className="flex gap-1">{Object.entries(sp).filter(([k]) => k !== "lb").map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v ?? "")} />)}
            <input type="date" name="lb" defaultValue={toYMD(day)} className="input !w-auto !py-1" /><button className="btn btn-sm">Taaza karein</button></form>
        </div>
      }>
        <div className="grid gap-4 lg:grid-cols-2">
          <div><h3 className="mb-2 font-semibold">Pipeline</h3>
            <Table head={["Agent", "Confirmed", "In Transit", "GPO", "GPO Done", "Online", "COD", "Total"]}
              rows={fold(pipeRaw).map(([id, a]) => [uname(id), a["Confirmed"] ?? 0, a["In Transit"] ?? 0, a["GPO"] ?? 0, a["GPO Done"] ?? 0, rupee(a.online), rupee(a.cod), a.total])} /></div>
          <div><h3 className="mb-2 font-semibold">Delivered</h3>
            <Table head={["Agent", "Delivered", "GPO Delivered", "Online", "COD", "Total"]}
              rows={fold(delRaw).map(([id, a]) => [uname(id), a["Delivered"] ?? 0, a["GPO Delivered"] ?? 0, rupee(a.online), rupee(a.cod), a.total])} /></div>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="🗺️ Orders by State">
          {byState.slice(0, 12).map((s) => <Bar key={s.state ?? "-"} label={s.state ?? "Unknown"} value={s._count} max={maxSt} />)}
          <Table head={["State", "Orders", "Conf."]} rows={byState.map((s) => [s.state ?? "Unknown", s._count, stConf.find((x) => x.state === s.state)?._count ?? 0])} />
        </Section>
        <Section title="🏪 Dealer Cumulative">
          <Table head={["Dealer", "Total", "Delivered", "Revenue"]} rows={dealerAll.sort((a, b) => b._count - a._count).map((d) => {
            const x = dealerDel.find((y) => y.dealerId === d.dealerId);
            return [dealers.find((z) => z.id === d.dealerId)?.name ?? "-", d._count, x?._count ?? 0, rupee(x?._sum.total ?? 0)];
          })} />
        </Section>
      </div>
    </div>
  );
}
