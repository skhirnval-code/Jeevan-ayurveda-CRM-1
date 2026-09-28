import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { addDays, fmtDate, istStartOfDay, rupee } from "@/lib/dates";
import { REVENUE_STATUSES } from "@/lib/constants";
import { PageHead, Section, Table, qs, sp1, type SP } from "@/components/ui";

const DAY = 86400000;

export default async function CourierPerformance({ searchParams: sp }: { searchParams: SP }) {
  await requirePage("/crm/reports/courier");
  const win = +(sp1(sp, "w") || 30);
  const mat = +(sp1(sp, "m") || 10);
  const today = istStartOfDay();
  const from = addDays(today, -win);
  const now = Date.now();

  const orders = await prisma.order.findMany({
    where: { deletedAt: null, bookedAt: { gte: from }, carrier: { not: null } },
    select: { id: true, orderNo: true, carrier: true, status: true, balance: true, bookedAt: true, deliveredAt: true },
  });
  const noAwb = await prisma.order.count({ where: { deletedAt: null, createdAt: { gte: from }, awb: null, status: { in: [...REVENUE_STATUSES, "RTO", "In Transit", "GPO Done"] } } });

  const cohort = (carrier: string) => {
    const list = orders.filter((o) => o.carrier === carrier);
    const age = (o: (typeof list)[0]) => Math.floor((now - o.bookedAt!.getTime()) / DAY);
    const todayB = list.filter((o) => o.bookedAt! >= today).length;
    const immature = list.filter((o) => o.bookedAt! < today && age(o) <= 2).length;
    const maturing = list.filter((o) => age(o) >= 3 && age(o) < mat).length;
    const matured = list.filter((o) => age(o) >= mat);
    const del = matured.filter((o) => REVENUE_STATUSES.includes(o.status));
    const rto = matured.filter((o) => o.status === "RTO");
    const done = del.length + rto.length;
    const days = del.filter((o) => o.deliveredAt).map((o) => (o.deliveredAt!.getTime() - o.bookedAt!.getTime()) / DAY).sort((a, b) => a - b);
    const median = days.length ? days[Math.floor(days.length / 2)] : null;
    const stuck = matured.filter((o) => !REVENUE_STATUSES.includes(o.status) && o.status !== "RTO");
    return {
      todayB, immature, maturing, matured: matured.length, done, del: del.length, rto: rto.length,
      success: done ? (del.length / done) * 100 : 0, rtoPct: done ? (rto.length / done) * 100 : 0, median,
      stuckN: stuck.length, codStuck: stuck.reduce((a, o) => a + o.balance, 0),
    };
  };
  const ip = cohort("INDIAPOST"), sr = cohort("SHIPROCKET");

  const stuck = await prisma.order.findMany({
    where: { deletedAt: null, bookedAt: { lt: addDays(today, -10) }, awb: { not: null }, status: { notIn: [...REVENUE_STATUSES, "RTO", "Cancelled", "Final cancel", "Lost"] } },
    orderBy: { bookedAt: "asc" }, take: 300,
    select: { id: true, orderNo: true, courier: true, customerName: true, phone: true, shipStatus: true, balance: true, bookedAt: true, lastShipEventAt: true },
  });

  const Card = ({ name, c }: { name: string; c: ReturnType<typeof cohort> }) => (
    <div className="card">
      <h3 className="mb-2 text-lg font-bold">{name}</h3>
      <div className="grid grid-cols-4 gap-2 text-center text-sm">
        {[[c.todayB, "Aaj buke - hisaab me nahi"], [c.immature, "1-2 din - Immature"], [c.maturing, `3-${mat - 1} din - Maturing`], [c.matured, `${mat}+ din - Matured`]].map(([v, l]) => (
          <div key={String(l)} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900"><div className="text-xl font-bold">{v}</div><div className="text-[11px] text-slate-500">{l}</div></div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div><div className="text-xs text-slate-500">Delivery Success</div><div className="text-2xl font-bold text-green-600">{c.success.toFixed(1)}%</div><div className="text-xs">{c.del} deliver / {c.done} khatam</div></div>
        <div><div className="text-xs text-slate-500">RTO</div><div className="text-2xl font-bold text-red-600">{c.rtoPct.toFixed(1)}%</div><div className="text-xs">{c.rto} wapas aaye · n={c.done}</div></div>
        <div><div className="text-xs text-slate-500">Median delivery</div><div className="text-2xl font-bold">{c.median != null ? `${c.median.toFixed(0)}d` : "-"}</div></div>
        <div><div className="text-xs text-slate-500">COD phansa ({c.stuckN} parcel, nateeja nahi)</div><div className="text-2xl font-bold text-amber-600">{rupee(c.codStuck)}</div></div>
      </div>
      {c.done < 100 && <p className="mt-2 text-xs text-amber-600">⚠️ n={c.done} - sirf sanket hai, pakka nateeja nahi</p>}
    </div>
  );

  const lead = ip.success - sr.success;
  return (
    <div className="space-y-4">
      <PageHead title="🚚 Courier Performance" sub="Booking-window ke aadhar par tulna · sirf matured parcel par percentage · dono courier ek jaisi shart par" />
      <Section title="📊 Cohort Tulna" right={
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Window:</span>{[7, 15, 30, 60, 90].map((w) => <Link key={w} href={qs("/crm/reports/courier", sp, { w: String(w) })} className={`btn btn-sm ${win === w ? "!bg-slate-900 !text-white" : ""}`}>{w}d</Link>)}
          <span>Matured:</span>
          {[5, 7, 10, 12, 15, 20].map((m) => <Link key={m} href={qs("/crm/reports/courier", sp, { m: String(m) })} className={`btn btn-sm ${mat === m ? "!bg-slate-900 !text-white" : ""}`}>{m} din</Link>)}
        </div>
      }>
        <p className="mb-3 text-sm text-slate-500">{fmtDate(from)} se aaj tak BOOK hue parcel · Percentage sirf {mat}+ din purane (matured) parcel par bani hai.</p>
        <div className="grid gap-4 lg:grid-cols-2"><Card name="India Post" c={ip} /><Card name="Shiprocket" c={sr} /></div>
        {(ip.done || sr.done) ? <p className="mt-3 font-semibold">🏁 {lead >= 0 ? "India Post" : "Shiprocket"} {Math.abs(lead).toFixed(1)} point aage hai ({ip.success.toFixed(1)}% vs {sr.success.toFixed(1)}%) - is window me.</p> : null}
        {noAwb > 0 && <p className="mt-2 text-sm text-slate-500">ℹ️ Is window ke {noAwb} order ka status courier ka nateeja keh raha hai par unpar koi AWB nahi hai — wo kisi courier me nahi gine gaye (Data Quality).</p>}
      </Section>
      <Section title={`⏳ 10+ din se atke parcel — dono courier (${stuck.length})`}>
        <Table head={["Order", "Courier", "Grahak", "Kahan atka / kya karein", "COD", "Umar", "Chup"]} rows={stuck.map((o) => [
          <Link key={o.id} className="text-blue-600" href={`/crm/orders/${o.id}`}>{o.orderNo}</Link>, o.courier, `${o.customerName} · ${o.phone}`,
          o.shipStatus || "Koi khabar nahi", rupee(o.balance), `${Math.floor((now - o.bookedAt!.getTime()) / DAY)}d`,
          o.lastShipEventAt ? `${Math.floor((now - o.lastShipEventAt.getTime()) / DAY)}d` : "-",
        ])} />
      </Section>
    </div>
  );
}
