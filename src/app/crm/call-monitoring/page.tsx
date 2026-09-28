import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { fmtDateTime, rangeOf } from "@/lib/dates";
import { PageHead, RangeLinks, Section, Table, qs, sp1, type SP } from "@/components/ui";

const RANGES = [{ key: "today", label: "Aaj" }, { key: "yest", label: "Kal" }, { key: "7d", label: "7 din" }, { key: "30d", label: "30 din" }];
const TABS = [["calls", "Calls"], ["agents", "Agent ki tulna"], ["hourly", "Ghanta / Din"], ["sus", "Shak wali calls"], ["new", "✨ Naye number"], ["ext", "🔧 Extension"]];
const LEN: Record<string, [number, number]> = { "0-10": [0, 10], "10-30": [10, 30], "30-60": [30, 60], "60-300": [60, 300], "300-600": [300, 600], "600+": [600, 1e9] };
const dur = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

export default async function CallMonitoring({ searchParams: sp }: { searchParams: SP }) {
  await requirePage("/crm/call-monitoring");
  const r = rangeOf(sp1(sp, "range") || "today", sp1(sp, "from"), sp1(sp, "to"));
  const tab = sp1(sp, "tab") || "calls";
  const f = { mobile: sp1(sp, "mobile"), order: sp1(sp, "order"), callId: sp1(sp, "callId"), agent: sp1(sp, "agent"), dir: sp1(sp, "dir"), res: sp1(sp, "res"), rec: sp1(sp, "rec"), len: sp1(sp, "len") };
  const and: Prisma.CallLogWhereInput[] = [{ startedAt: r }];
  if (f.mobile) and.push({ customerNo: { endsWith: f.mobile } });
  if (f.order) and.push({ order: { orderNo: { contains: f.order } } });
  if (f.callId) and.push({ callId: { contains: f.callId } });
  if (f.agent) and.push({ userId: +f.agent });
  if (f.dir) and.push({ direction: f.dir });
  if (f.res) and.push({ result: f.res });
  if (f.rec === "1") and.push({ recordingUrl: { not: null } });
  if (f.rec === "0") and.push({ recordingUrl: null });
  if (f.len && LEN[f.len]) and.push({ durationSec: { gte: LEN[f.len][0], lt: LEN[f.len][1] } });
  const where = { AND: and };

  const [all, agents] = await Promise.all([
    prisma.callLog.findMany({ where, orderBy: { startedAt: "desc" }, take: 5000, include: { user: { select: { name: true } }, order: { select: { id: true, orderNo: true, status: true } } } }),
    prisma.user.findMany({ where: { active: true, role: { not: "DEALER" } }, select: { id: true, name: true, extension: true }, orderBy: { name: "asc" } }),
  ]);
  const n = all.length;
  const ans = all.filter((c) => c.result === "Answered");
  const talk = ans.reduce((a, c) => a + c.durationSec, 0);
  const stats: [string, string | number][] = [
    ["Kul calls", n], [`Baat hui · ${n ? ((ans.length / n) * 100).toFixed(1) : 0}%`, ans.length],
    ["Nahi uthi", all.filter((c) => c.result === "Attempted").length], ["Missed (inbound)", all.filter((c) => c.result === "Missed").length],
    ["Voicemail", all.filter((c) => c.result === "Voicemail").length], ["Kul baat ka samay", dur(talk)],
    ["Bahar ki", all.filter((c) => c.direction === "OUTBOUND").length], ["Aane wali", all.filter((c) => c.direction === "INBOUND").length],
    ["Aausat lambai", dur(ans.length ? Math.round(talk / ans.length) : 0)], ["Sabse lambi", dur(Math.max(0, ...all.map((c) => c.durationSec)))],
    ["Recording hai", all.filter((c) => c.recordingUrl).length], ["Order se judi", all.filter((c) => c.orderId).length],
  ];

  // Call ke 10 min ke andar usi agent ne kya status lagaya
  const after = new Map<string, { n: number; talked: number }>();
  for (const c of all.filter((x) => x.orderId && x.userId).slice(0, 1500)) {
    const h = await prisma.orderHistory.findFirst({
      where: { orderId: c.orderId!, field: "status", byUserId: c.userId!, createdAt: { gte: c.startedAt, lt: new Date(c.startedAt.getTime() + (c.durationSec + 600) * 1000) } },
      orderBy: { createdAt: "asc" },
    });
    const k = h?.newValue ?? "koi status nahi badla";
    const a = after.get(k) ?? { n: 0, talked: 0 }; a.n++; if (c.result === "Answered") a.talked++; after.set(k, a);
  }

  let body: React.ReactNode = null;
  if (tab === "calls") {
    body = <Table head={["Samay", "Agent", "Customer", "Order", "Dhang", "Kya hua", "Lambai", "Baad me status", "Recording"]} rows={all.slice(0, 500).map((c) => [
      fmtDateTime(c.startedAt), c.user?.name ?? "-", c.customerNo, c.order ? <Link key="o" className="text-blue-600" href={`/crm/orders/${c.order.id}`}>{c.order.orderNo}</Link> : "-",
      c.direction === "INBOUND" ? "Aane wali" : "Bahar ki", c.result, dur(c.durationSec), c.order?.status ?? "-",
      c.recordingUrl ? <audio key="a" controls preload="none" src={c.recordingUrl} className="h-8" /> : "-",
    ])} />;
  } else if (tab === "agents") {
    const m = new Map<string, { n: number; ans: number; talk: number; orders: Set<number> }>();
    for (const c of all) { const k = c.user?.name ?? "Unknown"; const a = m.get(k) ?? { n: 0, ans: 0, talk: 0, orders: new Set() }; a.n++; if (c.result === "Answered") { a.ans++; a.talk += c.durationSec; } if (c.orderId) a.orders.add(c.orderId); m.set(k, a); }
    body = <Table head={["Agent", "Kul calls", "Baat hui", "Connect %", "Kul samay", "Aausat", "Orders chhue"]} rows={[...m.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, a]) => [k, a.n, a.ans, `${a.n ? ((a.ans / a.n) * 100).toFixed(0) : 0}%`, dur(a.talk), dur(a.ans ? Math.round(a.talk / a.ans) : 0), a.orders.size])} />;
  } else if (tab === "hourly") {
    const h = Array.from({ length: 24 }, () => ({ n: 0, ans: 0 }));
    for (const c of all) { const hr = new Date(c.startedAt.getTime() + 330 * 60000).getUTCHours(); h[hr].n++; if (c.result === "Answered") h[hr].ans++; }
    body = <Table head={["Ghanta", "Calls", "Baat hui", "Connect %"]} rows={h.map((x, i) => [`${String(i).padStart(2, "0")}:00`, x.n, x.ans, `${x.n ? ((x.ans / x.n) * 100).toFixed(0) : 0}%`]).filter((x) => x[1])} />;
  } else if (tab === "sus") {
    const sus = all.filter((c) => (c.result === "Answered" && c.durationSec < 10) || (c.orderId && c.result !== "Answered" && c.order?.status && ["Confirmed", "Cancelled"].includes(c.order.status)));
    body = <><p className="mb-2 text-sm text-slate-500">Answered par 10 sec se kam, ya bina baat hue order Confirmed/Cancelled.</p>
      <Table head={["Samay", "Agent", "Customer", "Order", "Kya hua", "Lambai"]} rows={sus.map((c) => [fmtDateTime(c.startedAt), c.user?.name ?? "-", c.customerNo, c.order?.orderNo ?? "-", c.result, dur(c.durationSec)])} /></>;
  } else if (tab === "new") {
    const nums = all.filter((c) => !c.orderId && c.direction === "INBOUND");
    body = <><p className="mb-2 text-sm text-slate-500">Aane wali calls jinka CRM me koi order nahi — naye lead ban sakte hain.</p>
      <Table head={["Samay", "Number", "Agent", "Kya hua", ""]} rows={nums.map((c) => [fmtDateTime(c.startedAt), c.customerNo, c.user?.name ?? "-", c.result, <Link key="n" className="btn btn-sm" href={`/crm/orders/new?phone=${c.customerNo}`}>+ Order</Link>])} /></>;
  } else {
    body = <Table head={["Agent", "Extension (Airtel IQ)"]} rows={agents.map((a) => [a.name, a.extension ?? "— (Users & Access > Manage Access se set karein)"])} />;
  }

  return (
    <div className="space-y-4">
      <PageHead title="📞 Call Monitoring" sub="Airtel IQ · samay IST me" />
      <RangeLinks base="/crm/call-monitoring" sp={sp} options={RANGES} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {stats.map(([l, v]) => <div key={l} className="card !p-3"><div className="text-xl font-bold">{v}</div><div className="text-xs text-slate-500">{l}</div></div>)}
      </div>
      <div className="flex flex-wrap gap-2">{TABS.map(([k, l]) => <Link key={k} href={qs("/crm/call-monitoring", sp, { tab: k })} className={`btn btn-sm ${tab === k ? "!bg-slate-900 !text-white" : ""}`}>{l}</Link>)}</div>
      <Section title="Call ke baad agent ne kya status lagaya" right={<span className="text-xs text-slate-500">call katne ke 10 min ke andar, usi agent ne</span>}>
        <div className="flex flex-wrap gap-2">{[...after.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, a]) => <div key={k} className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900"><b>{a.n}</b> {k} <span className="text-xs text-slate-500">({a.talked} me baat hui)</span></div>)}</div>
      </Section>
      <form className="card grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8" action="/crm/call-monitoring">
        {["range", "from", "to", "tab"].map((k) => sp1(sp, k) ? <input key={k} type="hidden" name={k} value={sp1(sp, k)} /> : null)}
        <div><label className="label">Mobile number</label><input name="mobile" defaultValue={f.mobile} className="input" placeholder="poora / aakhri 4" /></div>
        <div><label className="label">Order ID</label><input name="order" defaultValue={f.order} className="input" /></div>
        <div><label className="label">Call ID</label><input name="callId" defaultValue={f.callId} className="input" placeholder="uuid ka hissa" /></div>
        <div><label className="label">Agent</label><select name="agent" defaultValue={f.agent} className="input"><option value="">Sab agent</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label className="label">Dhang</label><select name="dir" defaultValue={f.dir} className="input"><option value="">Dono</option><option value="OUTBOUND">Bahar ki</option><option value="INBOUND">Aane wali</option></select></div>
        <div><label className="label">Kya hua</label><select name="res" defaultValue={f.res} className="input"><option value="">Sab</option>{["Answered", "Attempted", "Missed", "Voicemail"].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className="label">Recording</label><select name="rec" defaultValue={f.rec} className="input"><option value="">Sab</option><option value="1">Hai</option><option value="0">Nahi</option></select></div>
        <div><label className="label">Lambai</label><select name="len" defaultValue={f.len} className="input"><option value="">Sab</option>
          {[["0-10", "0-10 sec"], ["10-30", "10-30 sec"], ["30-60", "30 sec - 1 min"], ["60-300", "1-5 min"], ["300-600", "5-10 min"], ["600+", "10 min se zyada"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="col-span-2 flex gap-2"><button className="btn-primary">Apply</button><Link className="btn" href="/crm/call-monitoring">Reset</Link></div>
      </form>
      <Section title={TABS.find((t) => t[0] === tab)?.[1] ?? ""}>{body}</Section>
    </div>
  );
}
