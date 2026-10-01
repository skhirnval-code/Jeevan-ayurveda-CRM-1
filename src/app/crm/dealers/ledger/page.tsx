import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { dealerLedger } from "@/lib/dealers";
import { fmtDate, rangeOf, rupee } from "@/lib/dates";
import { BRAND } from "@/lib/constants";
import { Section, Stat, qs, sp1, type SP } from "@/components/ui";
import AddPayment from "@/components/dealers/AddPayment";
import Link from "next/link";

export default async function Ledger({ searchParams: sp }: { searchParams: SP }) {
  const me = await requirePage("/crm/dealers/ledger");
  const dealers = await prisma.dealer.findMany({
    where: me.role === "DEALER" ? { loginUserId: me.id } : me.role === "ZM" ? { zmId: me.id } : {},
    select: { id: true, name: true, code: true }, orderBy: { name: "asc" },
  });
  const dealerId = sp1(sp, "dealer") || (me.role === "DEALER" ? String(dealers[0]?.id ?? "") : "");
  const rk = sp1(sp, "range") || "all";
  const r = rangeOf(rk, sp1(sp, "from"), sp1(sp, "to"));
  const allowed = dealers.some((d) => String(d.id) === dealerId);
  const L = dealerId && allowed ? await dealerLedger(+dealerId, r) : null;
  const d = dealers.find((x) => String(x.id) === dealerId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><div className="text-xs font-bold text-blue-700">{BRAND.toUpperCase()}</div><h1 className="text-2xl font-bold">Dealer Ledger</h1><p className="text-sm text-slate-500">Sale, payment, debit, credit and running balance in one report.</p></div>
        <div className="flex gap-2">
          {dealerId && <a className="btn" href={`/api/dealers/ledger?${new URLSearchParams({ dealer: dealerId, range: rk, from: sp1(sp, "from") || "", to: sp1(sp, "to") || "" })}`}>Export to Excel</a>}
          {me.role !== "DEALER" && <AddPayment dealers={dealers} dealerId={dealerId} />}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="DEALER CODE" value={d?.code ?? "-"} sub={d?.name ?? "Dealer chunein"} />
        <Stat label="TOTAL SALE" value={rupee(L?.totalSale)} sub={`Orders: ${L?.saleCount ?? 0}`} tone="blue" />
        <Stat label="TOTAL PAYMENT" value={rupee(L?.totalPayment)} sub={`Payments: ${L?.payCount ?? 0}`} tone="green" />
        <Stat label="NET BALANCE" value={rupee(L?.balance)} sub="Running balance" tone="red" />
      </div>
      <form className="card flex flex-wrap items-end gap-2" action="/crm/dealers/ledger">
        <div className="flex gap-1">{[["today", "Today"], ["all", "All Dates"], ["custom", "Custom"]].map(([k, l]) => <Link key={k} className={`btn btn-sm ${rk === k ? "!bg-blue-600 !text-white" : ""}`} href={qs("/crm/dealers/ledger", sp, { range: k })}>{l}</Link>)}</div>
        <input type="hidden" name="range" value={rk === "all" || rk === "today" ? rk : "custom"} />
        <div><label className="label">Dealer Code</label><select name="dealer" defaultValue={dealerId} className="input !w-72"><option value="">-- Select Dealer --</option>{dealers.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.code})</option>)}</select></div>
        <div><label className="label">From Date</label><input type="date" name="from" defaultValue={sp1(sp, "from")} className="input" /></div>
        <div><label className="label">To Date</label><input type="date" name="to" defaultValue={sp1(sp, "to")} className="input" /></div>
        <button className="btn-primary">Search</button><Link className="btn" href="/crm/dealers/ledger">Reset</Link>
      </form>
      <Section title={`Ledger Entries ${L ? `(${L.lines.length})` : ""}`}>
        {!L ? <p className="text-sm text-slate-500">Upar se dealer chunein.</p> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr>{["TXN", "DATE", "PARTICULAR", "DEBIT", "CREDIT", "NET", "RUNNING"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              <tr className="bg-slate-50 dark:bg-slate-900"><td /><td /><td className="font-semibold">Opening balance</td><td /><td /><td /><td className="font-semibold">{rupee(L.opening)}</td></tr>
              {L.lines.map((l, i) => <tr key={i}><td className="font-mono text-xs">{l.txn}</td><td>{fmtDate(l.date)}</td><td>{l.particular}</td><td className="text-red-600">{l.debit ? rupee(l.debit) : ""}</td><td className="text-green-600">{l.credit ? rupee(l.credit) : ""}</td><td>{rupee(l.net)}</td><td className="font-semibold">{rupee(l.running)}</td></tr>)}
            </tbody></table></div>
        )}
      </Section>
    </div>
  );
}
