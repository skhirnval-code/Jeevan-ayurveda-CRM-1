import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { buildOrderWhere } from "@/lib/orderFilters";
import { addDays, rangeOf, rupee, toYMD } from "@/lib/dates";
import { COMPANY, REVENUE_STATUSES } from "@/lib/constants";
import { PageHead, RangeLinks, Section, Stat, Table, qs, sp1, type SP } from "@/components/ui";
import PrintButton from "@/components/PrintButton";

const RANGES = [
  { key: "all", label: "All Time" }, { key: "today", label: "Today" }, { key: "yest", label: "Yesterday" }, { key: "7d", label: "7 Days" },
  { key: "15d", label: "15 Days" }, { key: "30d", label: "30 Days" }, { key: "tm", label: "This Month" }, { key: "lm", label: "Last Month" },
];

export default async function SalesReport({ searchParams: sp }: { searchParams: SP }) {
  const me = await requirePage("/crm/reports/sales");
  const r = rangeOf(sp1(sp, "range") || "tm", sp1(sp, "from"), sp1(sp, "to"));
  const basis = sp1(sp, "basis") === "order" ? "createdAt" : "deliveredAt";
  const source = sp1(sp, "source");
  const scope = buildOrderWhere(new URLSearchParams(), me);
  const where: Prisma.OrderWhereInput = { AND: [scope, { [basis]: r, status: { in: REVENUE_STATUSES } }, source ? { source } : {}] };

  const [byStatus, bySource, rows, sources] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where, _count: true, _sum: { total: true } }),
    prisma.order.groupBy({ by: ["source", "status"], where, _count: true, _sum: { total: true } }),
    prisma.order.findMany({ where, select: { total: true, createdAt: true, deliveredAt: true } }),
    prisma.source.findMany({ orderBy: { name: "asc" } }),
  ]);
  const total = byStatus.reduce((a, b) => a + b._count, 0);
  const revenue = byStatus.reduce((a, b) => a + (b._sum.total ?? 0), 0);
  const del = byStatus.find((s) => s.status === "Delivered")?._count ?? 0;
  const gpo = byStatus.find((s) => s.status === "GPO Delivered")?._count ?? 0;

  const srcMap = new Map<string, { d: number; g: number; rev: number }>();
  for (const s of bySource) {
    const a = srcMap.get(s.source) ?? { d: 0, g: 0, rev: 0 };
    if (s.status === "Delivered") a.d += s._count; else a.g += s._count;
    a.rev += s._sum.total ?? 0; srcMap.set(s.source, a);
  }
  const daily = new Map<string, { n: number; rev: number }>();
  for (const o of rows) {
    const d = toYMD((basis === "createdAt" ? o.createdAt : o.deliveredAt) ?? o.createdAt);
    const a = daily.get(d) ?? { n: 0, rev: 0 }; a.n++; a.rev += o.total; daily.set(d, a);
  }

  return (
    <div className="space-y-4">
      <PageHead title={COMPANY} sub={<>Sales Report · Delivered + GPO Delivered · {basis === "createdAt" ? "order" : "delivery"} ki tarikh par<br />{r.gte ? toYMD(r.gte) : "shuru"} to {r.lt ? toYMD(addDays(r.lt, -1)) : "aaj"}</>}>
        <PrintButton />
      </PageHead>
      <RangeLinks base="/crm/reports/sales" sp={sp} options={RANGES} />
      <form className="flex flex-wrap gap-2" action="/crm/reports/sales">
        {Object.entries(sp).filter(([k]) => !["basis", "source"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v ?? "")} />)}
        <select name="basis" defaultValue={sp1(sp, "basis") || "delivery"} className="input !w-64">
          <option value="delivery">Delivery ki tarikh (kab pahuncha)</option><option value="order">Order ki tarikh (kab bana)</option>
        </select>
        <select name="source" defaultValue={source} className="input !w-48"><option value="">All Sources</option>{sources.map((s) => <option key={s.id}>{s.name}</option>)}</select>
        <button className="btn">Apply</button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total Sales" value={total} sub="Delivered + GPO" tone="blue" />
        <Stat label="Delivered" value={del} tone="green" />
        <Stat label="GPO Delivered" value={gpo} tone="teal" />
        <Stat label="Revenue" value={rupee(revenue)} sub={`AOV ${rupee(total ? revenue / total : 0)}`} tone="amber" />
      </div>

      <Section title="Status Breakdown">
        <Table head={["STATUS", "ORDER COUNT", "PERCENTAGE (%)"]} rows={[
          ...byStatus.map((s) => [s.status, s._count, `${total ? ((s._count / total) * 100).toFixed(1) : 0}%`]),
          [<b key="t">TOTAL</b>, <b key="n">{total}</b>, "100%"],
        ]} />
      </Section>
      <Section title="Source-wise" right={<span className="text-xs text-slate-500">Kisi ek source ki poori report chahiye to naam par click karein</span>}>
        <Table head={["SOURCE", "DELIVERED", "GPO DELIVERED", "TOTAL", "SHARE", "REVENUE"]} rows={[...srcMap.entries()].sort((a, b) => b[1].d + b[1].g - a[1].d - a[1].g).map(([s, a]) => [
          <Link key={s} className="btn btn-sm" href={qs("/crm/reports/sales", sp, { source: s })}>{s}</Link>, a.d, a.g, a.d + a.g, `${total ? (((a.d + a.g) / total) * 100).toFixed(1) : 0}%`, rupee(a.rev),
        ])} />
      </Section>
      <Section title="Day-wise Sales">
        <Table head={["DATE", "ORDERS", "REVENUE"]} rows={[...daily.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([d, a]) => [d, a.n, rupee(a.rev)])} />
      </Section>
    </div>
  );
}
