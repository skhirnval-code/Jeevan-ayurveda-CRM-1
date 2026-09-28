import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { incentiveData } from "@/lib/incentiveData";
import { addDays, rupee, toYMD } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { PageHead, RangeLinks, Section, sp1, type SP } from "@/components/ui";
import WorkModeSelect from "@/components/WorkModeSelect";

const RANGES = [
  { key: "today", label: "Aaj" }, { key: "yest", label: "Kal" }, { key: "7d", label: "7 Din" }, { key: "15d", label: "15 Din" }, { key: "30d", label: "30 Din" },
  { key: "tm", label: "Is Mahine" }, { key: "lm", label: "Pichhle Mahine" }, { key: "ty", label: "Is Saal" }, { key: "all", label: "Sab" },
];

export default async function Incentive({ searchParams: sp }: { searchParams: SP }) {
  const me = await requirePage("/crm/reports/incentive");
  const p = { range: sp1(sp, "range") || "lm", from: sp1(sp, "from"), to: sp1(sp, "to"), agent: sp1(sp, "agent"), mode: sp1(sp, "mode") };
  const { r, R, agents } = await incentiveData(p);
  const users = await prisma.user.findMany({ where: { role: { not: "DEALER" } }, select: { id: true, name: true }, orderBy: { id: "asc" } });
  const canMoney = can(me, "reports.incentive");
  const tot = agents.reduce((a, b) => ({ orders: a.orders + b.orders, amount: a.amount + b.amount, online: a.online + b.online, cod: a.cod + b.cod, onlinePart: a.onlinePart + b.onlinePart, codPart: a.codPart + b.codPart, incentive: a.incentive + b.incentive }), { orders: 0, amount: 0, online: 0, cod: 0, onlinePart: 0, codPart: 0, incentive: 0 });
  const csvQ = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  const W = R.wfh, O = R.office;

  return (
    <div className="space-y-4">
      <PageHead title="🏆 Agent Incentive" sub={<>Sirf wo orders jo is samay me DELIVER hue (Delivered + GPO Delivered)<br />{r.gte ? toYMD(r.gte) : "shuru"} se {r.lt ? toYMD(addDays(r.lt, -1)) : "aaj"} tak</>} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="card border-l-4 border-blue-400"><h3 className="font-bold">🏠 Work From Home</h3>
          <ul className="mt-1 text-sm"><li>Online payment ka {W.onlinePct}%</li><li>COD me wasoole ka {W.codPct}%</li><li>Har order par - koi seema nahi</li></ul>
          <p className="mt-2 text-xs text-slate-500">Misaal: ₹3,000 ka order, ₹1,000 online + ₹2,000 COD → ₹150 + ₹200 = ₹350</p></div>
        <div className="card border-l-4 border-green-500"><h3 className="font-bold">🏢 Office</h3>
          <ul className="mt-1 text-sm"><li>Order ₹{O.minOrder} ya usse kam → incentive 0</li><li>₹{O.minOrder} se upar: Online ka {O.onlinePct}%</li><li>+ COD me se ₹{O.codDeduct} kaat kar bache hisse ka {O.codPct}%</li></ul>
          <p className="mt-2 text-xs text-slate-500">Misaal: ₹2,000 = ₹500 online + ₹1,500 COD → ₹75 + ₹50 = ₹125</p></div>
      </div>
      <RangeLinks base="/crm/reports/incentive" sp={sp} options={RANGES} />
      <form className="flex flex-wrap gap-2" action="/crm/reports/incentive">
        {Object.entries(sp).filter(([k]) => !["agent", "mode"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v ?? "")} />)}
        <select name="agent" defaultValue={p.agent} className="input !w-48"><option value="">Sab agent</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <select name="mode" defaultValue={p.mode} className="input !w-48"><option value="">Dono tarah ke</option><option value="WFH">Sirf Work From Home</option><option value="OFFICE">Sirf Office</option></select>
        <button className="btn">Refresh</button>
        {canMoney && <><a className="btn" href={`/api/reports/incentive?format=agent&${csvQ}`}>Agent-wise CSV</a><a className="btn" href={`/api/reports/incentive?format=order&${csvQ}`}>Order-wise CSV</a></>}
      </form>
      <Section title={`${agents.length} agents`}>
        <div className="overflow-x-auto"><table className="tbl">
          <thead><tr>{["#", "Agent", "Tarika", "Orders", "Kul Amount", "Online", "COD", `Online ${W.onlinePct}%`, `COD ${W.codPct}%`, "INCENTIVE"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {agents.map((a, i) => (
              <tr key={a.id}><td>{i + 1}</td><td className="font-medium">{a.name}</td><td>{canMoney ? <WorkModeSelect userId={a.id} mode={a.mode} /> : a.mode}</td>
                <td>{a.orders}</td><td>{rupee(a.amount)}</td><td>{rupee(a.online)}</td><td>{rupee(a.cod)}</td>
                <td>{canMoney ? rupee(a.onlinePart) : "—"}</td><td>{canMoney ? rupee(a.codPart) : "—"}</td><td className="font-bold text-green-700">{canMoney ? rupee(a.incentive) : "—"}</td></tr>
            ))}
            <tr className="bg-slate-50 font-bold dark:bg-slate-900"><td /><td>TOTAL</td><td /><td>{tot.orders}</td><td>{rupee(tot.amount)}</td><td>{rupee(tot.online)}</td><td>{rupee(tot.cod)}</td>
              <td>{canMoney ? rupee(tot.onlinePart) : "—"}</td><td>{canMoney ? rupee(tot.codPart) : "—"}</td><td>{canMoney ? rupee(tot.incentive) : "—"}</td></tr>
          </tbody>
        </table></div>
      </Section>
    </div>
  );
}
