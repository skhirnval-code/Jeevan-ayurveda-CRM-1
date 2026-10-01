import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { dealerCumulative } from "@/lib/dealers";
import { addDays, rangeOf, rupee, toYMD } from "@/lib/dates";
import { BRAND, STATUSES } from "@/lib/constants";
import { Section, Stat, qs, sp1, type SP } from "@/components/ui";

export default async function Cumulative({ searchParams: sp }: { searchParams: SP }) {
  const me = await requirePage("/crm/dealers/cumulative");
  const rk = sp1(sp, "range") || "all";
  const r = rangeOf(rk, sp1(sp, "from"), sp1(sp, "to"));
  const view = sp1(sp, "view") || "summary";
  const rows = await dealerCumulative(r, sp1(sp, "q"), me.role === "ZM" ? me.id : undefined);
  const t = rows.reduce((a, x) => ({ sale: a.sale + x.totalSale, comm: a.comm + x.commission, net: a.net + x.netSale, paid: a.paid + x.paid, bal: a.bal + x.balance, orders: a.orders + x.orders }), { sale: 0, comm: 0, net: 0, paid: 0, bal: 0, orders: 0 });
  const active = rows.filter((x) => x.orders || x.assigned || x.paid);
  const shown = sp1(sp, "q") ? rows : active.length ? active : rows;
  const statusCols = STATUSES.filter((s) => shown.some((x) => x.status[s]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><div className="text-xs font-bold text-blue-700">{BRAND.toUpperCase()}</div><h1 className="text-2xl font-bold">Dealer Cumulative Report</h1><p className="text-sm text-slate-500">Dealer Sale / Commission / Net Sale / Paid / Balance ek jagah.</p></div>
        <a className="btn" href={`/api/dealers/cumulative?${new URLSearchParams({ range: rk, from: sp1(sp, "from") || "", to: sp1(sp, "to") || "", q: sp1(sp, "q") || "" })}`}>Export CSV</a>
      </div>
      <div className="text-sm text-slate-500">DATE RANGE: {r.gte ? toYMD(r.gte) : "shuru"} to {r.lt ? toYMD(addDays(r.lt, -1)) : "aaj"} · Report lines: {shown.length}</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="TOTAL SALE" value={rupee(t.sale)} sub={`Dealers: ${active.length} · Orders: ${t.orders}`} tone="blue" />
        <Stat label="TOTAL COMMISSION" value={rupee(t.comm)} sub="Dealers ka hissa" tone="amber" />
        <Stat label="NET SALE" value={rupee(t.net)} sub="Total sale minus commission" tone="green" />
        <Stat label="TOTAL PAID" value={rupee(t.paid)} sub="Payments total" tone="teal" />
        <Stat label="TOTAL BALANCE" value={rupee(t.bal)} sub="Net sale minus paid" tone="red" />
      </div>
      <form className="card flex flex-wrap items-end gap-2" action="/crm/dealers/cumulative">
        <div className="flex gap-1">{[["today", "Today"], ["all", "All Dates"], ["custom", "Custom"]].map(([k, l]) => <Link key={k} className={`btn btn-sm ${rk === k ? "!bg-blue-600 !text-white" : ""}`} href={qs("/crm/dealers/cumulative", sp, { range: k })}>{l}</Link>)}</div>
        <input type="hidden" name="range" value="custom" /><input type="hidden" name="view" value={view} />
        <div><label className="label">From Date</label><input type="date" name="from" defaultValue={sp1(sp, "from")} className="input" /></div>
        <div><label className="label">To Date</label><input type="date" name="to" defaultValue={sp1(sp, "to")} className="input" /></div>
        <div><label className="label">Dealer Search</label><input name="q" defaultValue={sp1(sp, "q")} placeholder="Search dealer name or code..." className="input" /></div>
        <button className="btn-primary">Search</button><Link className="btn" href="/crm/dealers/cumulative">Reset</Link>
      </form>
      <div className="flex gap-2">{[["summary", "Summary"], ["status", "Status-wise"], ["stock", "Stock / Recovery / Profit"]].map(([k, l]) => <Link key={k} className={`btn ${view === k ? "!bg-blue-600 !text-white" : ""}`} href={qs("/crm/dealers/cumulative", sp, { view: k })}>{l}</Link>)}</div>
      <Section title={`Dealer Cumulative Report · Showing ${shown.length} dealers`}>
        <div className="overflow-x-auto"><table className="tbl">
          {view === "summary" && <>
            <thead><tr>{["DEALER", "ORDERS", "QTY", "TOTAL SALE", "TOTAL COMMISSION", "NET SALE", "TOTAL PAID", "TOTAL BALANCE"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{shown.map((x) => <tr key={x.id}><td><Link href={`/crm/dealers/ledger?dealer=${x.id}`} className="font-semibold">{x.name}</Link><div className="text-xs text-slate-500">Code: {x.code} · Comm ₹{x.margin}/order</div></td>
              <td>{x.orders}</td><td>{x.qty}</td><td>{rupee(x.totalSale)}</td><td>{rupee(x.commission)}</td><td>{rupee(x.netSale)}</td><td>{rupee(x.paid)}</td><td className="font-bold">{rupee(x.balance)}</td></tr>)}</tbody>
          </>}
          {view === "status" && <>
            <thead><tr><th>DEALER</th><th>ASSIGNED</th>{statusCols.map((s) => <th key={s}>{s}</th>)}</tr></thead>
            <tbody>{shown.map((x) => <tr key={x.id}><td className="font-semibold">{x.name}</td><td>{x.assigned}</td>{statusCols.map((s) => <td key={s}>{x.status[s] ?? ""}</td>)}</tr>)}</tbody>
          </>}
          {view === "stock" && <>
            <thead><tr>{["DEALER", "STOCK IN", "SOLD QTY", "STOCK LEFT", "DELIVERED", "CANCEL/RTO", "RECOVERY %", "PROFIT (COMM)", "INVOICED"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{shown.map((x) => <tr key={x.id}><td className="font-semibold">{x.name}</td><td>{x.stockIn}</td><td>{x.qty}</td>
              <td className={x.lowStock ? "font-bold text-red-600" : ""}>{x.stockLeft}{x.lowStock ? " ⚠" : ""}</td><td>{x.delivered}</td><td>{x.cancelled}</td>
              <td>{x.recovery.toFixed(0)}%</td><td>{rupee(x.profit)}</td><td>{rupee(x.invoiced)}</td></tr>)}</tbody>
          </>}
        </table></div>
      </Section>
    </div>
  );
}
