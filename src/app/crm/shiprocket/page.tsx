import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { addDays, istStartOfDay, rangeOf, rupee } from "@/lib/dates";
import { SHIP_STATUSES } from "@/lib/constants";
import { PageHead, Section, Table, qs, sp1, type SP } from "@/components/ui";
import { Backfill, DocCentre, SrAccounts } from "@/components/ShipTools";

const DAY = 86400000;

export default async function ShiprocketPage({ searchParams: sp }: { searchParams: SP }) {
  await requirePage("/crm/shiprocket");
  const r = rangeOf(sp1(sp, "range") || "today", sp1(sp, "from"), sp1(sp, "to"));
  const sc = +(sp1(sp, "sc") || 30);
  const base = { carrier: "SHIPROCKET", deletedAt: null };
  const now = Date.now();
  const today = istStartOfDay();

  const [accounts, byStatus, booked, labelPending, manifestPending, delivered, rto] = await Promise.all([
    prisma.shiprocketAccount.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true, email: true, pickupLocation: true, sandbox: true, active: true } }),
    prisma.order.groupBy({ by: ["shipStatus"], where: { ...base, bookedAt: r }, _count: true }),
    prisma.order.count({ where: { ...base, bookedAt: r } }),
    prisma.order.count({ where: { ...base, bookedAt: r, labelPrinted: false } }),
    prisma.order.count({ where: { ...base, bookedAt: r, manifestDone: false } }),
    prisma.order.count({ where: { ...base, bookedAt: r, shipStatus: "Delivered" } }),
    prisma.order.count({ where: { ...base, bookedAt: r, shipStatus: { in: ["RTO Initiated", "RTO Delivered"] } } }),
  ]);
  const st = Object.fromEntries(byStatus.map((s) => [s.shipStatus ?? "-", s._count]));

  // Atke hue: 3+ din se koi event nahi, ya NDR/lost/RTO atka
  const open = await prisma.order.findMany({
    where: { ...base, awb: { not: null }, shipStatus: { notIn: ["Delivered", "RTO Delivered", "Cancelled"] }, bookedAt: { lt: addDays(today, -2) } },
    select: { id: true, orderNo: true, awb: true, customerName: true, phone: true, shipStatus: true, balance: true, bookedAt: true, lastShipEventAt: true, courier: true },
    orderBy: { bookedAt: "asc" }, take: 500,
  });
  const quiet = (o: (typeof open)[0]) => Math.floor((now - (o.lastShipEventAt ?? o.bookedAt!).getTime()) / DAY);
  const bucket = (o: (typeof open)[0]) =>
    o.shipStatus === "NDR" ? "ndr" : o.shipStatus === "Lost" ? "lost" : o.shipStatus === "RTO Initiated" ? (quiet(o) >= 7 ? "rtoStuck" : "rto")
      : ["AWB Assigned", "Pickup Scheduled", "Pickup Error"].includes(o.shipStatus ?? "") ? "notPicked"
      : o.shipStatus === "Out For Delivery" ? "ofd" : quiet(o) >= 3 ? "quiet" : "ok";
  const stuck = open.filter((o) => bucket(o) !== "ok");
  const B = [["all", "Sab atke"], ["notPicked", "Godam se utha nahi"], ["ofd", "Out for delivery me atka"], ["quiet", "Koi khabar nahi"], ["ndr", "NDR - phone karein"], ["lost", "Lost / Damaged"], ["rtoStuck", "Wapsi bhi atki"], ["rto", "Wapas aa raha"]];
  const cnt = (k: string) => (k === "all" ? stuck.filter((o) => bucket(o) !== "rto").length : stuck.filter((o) => bucket(o) === k).length);
  const sb = sp1(sp, "sb") || "all";
  const stuckShown = stuck.filter((o) => (sb === "all" ? bucket(o) !== "rto" : bucket(o) === sb));
  const codStuck = stuck.filter((o) => bucket(o) !== "rto").reduce((a, o) => a + o.balance, 0);

  // Courier scorecard
  const sco = await prisma.order.findMany({ where: { ...base, bookedAt: { gte: addDays(today, -sc) } }, select: { courier: true, shipStatus: true, balance: true, bookedAt: true, deliveredAt: true } });
  const cm = new Map<string, { b: number; d: number; rto: number; ndr: number; days: number[]; lost: number }>();
  for (const o of sco) {
    const k = o.courier || "-"; const a = cm.get(k) ?? { b: 0, d: 0, rto: 0, ndr: 0, days: [], lost: 0 };
    a.b++; if (o.shipStatus === "Delivered") { a.d++; if (o.deliveredAt) a.days.push((o.deliveredAt.getTime() - o.bookedAt!.getTime()) / DAY); }
    if (o.shipStatus?.startsWith("RTO")) { a.rto++; a.lost += o.balance; } if (o.shipStatus === "NDR") a.ndr++; cm.set(k, a);
  }

  // NDR action center
  const ndr = open.filter((o) => o.shipStatus === "NDR");
  const ndrEvents = await prisma.shipEvent.findMany({ where: { awb: { in: ndr.map((x) => x.awb!) } }, orderBy: { at: "desc" } });
  const reason = (awb: string | null) => {
    const ev = ndrEvents.find((e) => e.awb === awb);
    const raw = (ev?.raw ?? {}) as Record<string, unknown>;
    return String(raw.ndr_reason || raw.reason || ev?.event || "NDR");
  };
  const host = headers().get("host") ?? "your-domain";

  return (
    <div className="space-y-4">
      <PageHead title="🚚 Shiprocket Management" sub="Multiple accounts · active selection · test · pickup locations" />
      <Section title="Accounts"><SrAccounts accounts={accounts} webhookUrl={`https://${host}/api/delivery/notify`} /></Section>

      <Section title="📦 Shipment Operations" right={
        <div className="flex items-center gap-2 text-sm">
          <span>DELIVERED {booked ? ((delivered / booked) * 100).toFixed(2) : "0.00"}%</span><span>RTO {booked ? ((rto / booked) * 100).toFixed(2) : "0.00"}%</span>
          {[["today", "Aaj"], ["7d", "7 din"], ["30d", "30 din"]].map(([k, l]) => <Link key={k} className={`btn btn-sm ${(sp1(sp, "range") || "today") === k ? "!bg-slate-900 !text-white" : ""}`} href={qs("/crm/shiprocket", sp, { range: k })}>{l}</Link>)}
        </div>
      }>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {[["Booked", booked, "/crm/orders?courier=Shiprocket"], ["Label Pending", labelPending, "/crm/orders?ship=Label%20Pending"], ["Manifest Pending", manifestPending, "/crm/orders?ship=Manifest%20Pending"],
            ...SHIP_STATUSES.map((s) => [s, st[s] ?? 0, `/crm/orders?ship=${encodeURIComponent(s)}`])].map(([l, v, h]) => (
            <Link key={String(l)} href={String(h)} className="rounded-xl border bg-slate-50 p-3 text-center hover:bg-slate-100 dark:bg-slate-900"><div className="text-2xl font-bold">{v}</div><div className="text-xs">{l}</div></Link>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Card par click karein - us filter ke saath Manage Orders khulega.</p>
      </Section>

      <Section title="⏳ Atke hue shipment">
        <p className="mb-2 text-sm text-slate-500">Vaada-tarikh nikal chuki hai ya 3+ din se koi khabar nahi aayi. Wapas aa rahe parcel ka paisa isme nahi gina. COD phansa: <b>{rupee(codStuck)}</b></p>
        <div className="mb-2 flex flex-wrap gap-2">{B.map(([k, l]) => <Link key={k} href={qs("/crm/shiprocket", sp, { sb: k })} className={`btn btn-sm ${sb === k ? "!bg-slate-900 !text-white" : ""}`}><b>{cnt(k)}</b> {l}</Link>)}</div>
        <Table head={["Order", "Grahak", "Kahan atka / kya karein", "COD", "Late", "Chup", "Action"]} rows={stuckShown.slice(0, 200).map((o) => [
          <Link key="o" className="text-blue-600" href={`/crm/orders/${o.id}`}>{o.orderNo}</Link>, `${o.customerName} · ${o.phone}`, `${o.courier ?? ""} · ${o.shipStatus}`, rupee(o.balance),
          `${Math.floor((now - o.bookedAt!.getTime()) / DAY)}d`, `${quiet(o)}d`, <a key="c" className="btn btn-sm" href={`tel:${o.phone}`}>Call</a>,
        ])} />
      </Section>

      <Section title="🚚 Courier Scorecard" right={<div className="flex gap-1">{[30, 90, 180].map((d) => <Link key={d} className={`btn btn-sm ${sc === d ? "!bg-slate-900 !text-white" : ""}`} href={qs("/crm/shiprocket", sp, { sc: String(d) })}>{d} din</Link>)}</div>}>
        <Table head={["Courier", "Booked", "Delivered", "RTO", "RTO %", "NDR %", "Avg din", "COD doobi"]} rows={[...cm.entries()].sort((a, b) => b[1].b - a[1].b).map(([k, a]) => [
          k, a.b, a.d, a.rto, `${a.b ? ((a.rto / a.b) * 100).toFixed(1) : 0}%`, `${a.b ? ((a.ndr / a.b) * 100).toFixed(1) : 0}%`,
          a.days.length ? (a.days.reduce((x, y) => x + y, 0) / a.days.length).toFixed(1) : "-", rupee(a.lost),
        ])} />
      </Section>

      <Section title="📞 NDR Action Center - inhe abhi phone karein">
        <Table head={["Order", "Grahak", "Wajah", "COD", "Action"]} rows={ndr.map((o) => [
          <Link key="o" className="text-blue-600" href={`/crm/orders/${o.id}`}>{o.orderNo}</Link>, `${o.customerName} · ${o.phone}`, reason(o.awb), rupee(o.balance),
          <span key="a" className="flex gap-1"><a className="btn btn-sm" href={`tel:${o.phone}`}>Call</a><a className="btn btn-sm" target="_blank" href={`https://wa.me/91${o.phone}`}>WA</a></span>,
        ])} />
      </Section>

      <Section title="🖨 Document Centre"><DocCentre carrier="SHIPROCKET" /></Section>
      <Section title="💾 Shiprocket Backfill"><Backfill /></Section>
    </div>
  );
}
