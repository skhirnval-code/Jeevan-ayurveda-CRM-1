import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { addDays, fmtDateTime, istStartOfDay } from "@/lib/dates";
import { TERMINAL_STATUSES } from "@/lib/constants";
import { ipConfigured } from "@/lib/indiapost";
import { PageHead } from "@/components/ui";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function SystemHealth() {
  await requirePage("/crm/system");
  const t0 = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const dbMs = Date.now() - t0;
  const since = new Date(Date.now() - 86400000);
  const today = istStartOfDay();
  const [size, users, activeUsers, logins, fails, due, overdue, backlog, srAcc, srBooked, srLast, ipBooked, ipLast, lastEvent, barcodes, srEvents24, ipEvents24] = await Promise.all([
    prisma.$queryRaw<{ size: string }[]>`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`,
    prisma.user.count(), prisma.user.count({ where: { active: true } }),
    prisma.auditLog.findMany({ where: { action: "auth.login", createdAt: { gte: since } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.auditLog.count({ where: { action: "auth.login_failed", createdAt: { gte: since } } }),
    prisma.order.count({ where: { deletedAt: null, followupAt: { gte: today, lt: addDays(today, 1) }, status: { notIn: TERMINAL_STATUSES } } }),
    prisma.order.count({ where: { deletedAt: null, followupAt: { lt: today }, status: { notIn: TERMINAL_STATUSES } } }),
    prisma.order.count({ where: { deletedAt: null, status: "New" } }),
    prisma.shiprocketAccount.findFirst({ where: { active: true } }),
    prisma.order.count({ where: { carrier: "SHIPROCKET" } }),
    prisma.order.findFirst({ where: { carrier: "SHIPROCKET" }, orderBy: { bookedAt: "desc" }, select: { bookedAt: true } }),
    prisma.order.count({ where: { carrier: "INDIAPOST" } }),
    prisma.order.findFirst({ where: { carrier: "INDIAPOST" }, orderBy: { bookedAt: "desc" }, select: { bookedAt: true } }),
    prisma.shipEvent.findFirst({ orderBy: { at: "desc" } }),
    prisma.barcode.count({ where: { used: false } }),
    prisma.shipEvent.count({ where: { carrier: "SHIPROCKET", at: { gte: since } } }),
    prisma.shipEvent.count({ where: { carrier: "INDIAPOST", at: { gte: since } } }),
  ]);
  const loginSuccess = await prisma.auditLog.count({ where: { action: "auth.login", createdAt: { gte: since } } });

  const C = ({ t, v, s, ok = true }: { t: string; v: React.ReactNode; s?: React.ReactNode; ok?: boolean }) => (
    <div className={`card border-l-4 ${ok ? "border-green-500" : "border-red-500"}`}><div className="text-xs text-slate-500">{t}</div><div className="text-2xl font-bold">{v}</div>{s && <div className="text-xs text-slate-500">{s}</div>}</div>
  );
  return (
    <div className="space-y-4">
      <PageHead title="System Health" sub={<>Live system status - auto-refresh 30s - updated {fmtDateTime(new Date())}</>}><AutoRefresh seconds={30} /></PageHead>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <C t="API / Database" v="Online" s={`DB ${dbMs} ms`} />
        <C t="Database Size" v={size[0]?.size ?? "-"} />
        <C t="Total Users" v={users} s={`${activeUsers} active flag`} />
        <C t="Logged in (24h)" v={logins.length} s="active users" />
        <C t="Failed Logins (24h)" v={fails} s={`${loginSuccess} success`} ok={fails < 50} />
        <C t="Pending Follow-ups" v={due} s="due today (open)" />
        <C t="Overdue Follow-ups" v={overdue} s="back-date pending" ok={overdue < 100} />
        <C t="New Backlog" v={backlog} s="status = New" ok={backlog < 500} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="card"><h3 className="font-semibold">Database Backup</h3>
          <p className="text-sm text-slate-500">Nightly <code>pg_dump</code> cron lagayein (README dekhein) — last 14 rakhein.</p></div>
        <div className="card"><h3 className="font-semibold">Store → CRM Ingest</h3>
          <p className="text-sm">Endpoint: <code>POST /api/ingest</code> (header <code>x-api-key</code>)</p></div>
        <div className={`card border-l-4 ${srAcc ? "border-green-500" : "border-red-500"}`}><h3 className="font-semibold">Shiprocket / Webhook — {srAcc ? "Active" : "Account nahi"}</h3>
          <p className="text-sm">Webhook: <code>/api/delivery/notify</code> · API creds: {srAcc ? "Yes" : "No"}</p>
          <p className="text-sm">Orders booked: {srBooked} · Last: {fmtDateTime(srLast?.bookedAt)} · Events (24h): {srEvents24}</p></div>
        <div className={`card border-l-4 ${ipConfigured() ? "border-green-500" : "border-amber-500"}`}><h3 className="font-semibold">India Post / Webhook — {ipConfigured() ? "Configured" : "API creds nahi"}</h3>
          <p className="text-sm">Booking webhook: <code>/api/delivery/postal/booking</code> · Events: <code>/api/delivery/postal/events</code></p>
          <p className="text-sm">Orders booked: {ipBooked} · Last: {fmtDateTime(ipLast?.bookedAt)} · Events (24h): {ipEvents24} · Barcodes bache: {barcodes}</p></div>
      </div>
      <p className="text-xs text-slate-500">Aakhri courier event: {lastEvent ? `${lastEvent.carrier} ${lastEvent.event} · ${fmtDateTime(lastEvent.at)}` : "-"}</p>
    </div>
  );
}
