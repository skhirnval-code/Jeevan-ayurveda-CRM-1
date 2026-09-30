"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, canM, useMeta } from "@/components/useMeta";
import { DATE_RANGES, POST_EVENTS, QUICK_FILTERS, SHIP_STATUSES, statusClass } from "@/lib/constants";
import BookModal from "./BookModal";
import ImportModal from "./ImportModal";

type Row = {
  id: number; orderNo: string; createdAt: string; customerName: string; phone: string; product: string; qty: number;
  unitPrice: number; total: number; online: number; balance: number; status: string; paymentStatus: string; source: string;
  city: string | null; state: string | null; district: string | null; pincode: string | null; address: string | null;
  followupAt: string | null; leadOwner: { id: number; name: string } | null; agentAssignedAt: string | null;
  dealer: { id: number; name: string; code: string; zm: { name: string } | null } | null; dealerAssignedAt: string | null;
  awb: string | null; courier: string | null; carrier: string | null; shipStatus: string | null; remark: string | null;
};
type Resp = {
  total: number; page: number; size: number; rows: Row[]; tabs: string[];
  tabCounts: Record<string, number>; chipCounts: Record<string, number>; assignedRe: number;
  money: { online: number; cod: number; incentive: number };
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const dt = (s?: string | null) => s ? new Date(s).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
const d = (s?: string | null) => s ? new Date(s).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" }) : "-";

const CHIPS: { key: string; label: string; cls: string; title: string }[] = [
  { key: "assignedToday", label: "Assigned Today", cls: "bg-slate-100 text-slate-700", title: "Chune gaye range me jin orders ka AGENT ASSIGN hua" },
  { key: "pool", label: "Pool Remaining", cls: "bg-red-50 text-red-700", title: "Assign hue orders me se jin par agent ne abhi tak koi manual kaam nahi kiya" },
  { key: "worked", label: "Worked Today", cls: "bg-emerald-50 text-emerald-700", title: "Aaj jin par human kaam hua (status/followup/remark/note)" },
  { key: "sutra", label: "Sutra", cls: "bg-fuchsia-50 text-fuchsia-700", title: "Sutra Gold+ ke wo orders jo abhi tak kisi agent ko diye hi nahi gaye" },
  { key: "nasha", label: "Nasha", cls: "bg-lime-50 text-lime-800", title: "Nasha / Anti Addiction ke wo orders jo abhi tak kisi agent ko assign nahi" },
  { key: "recycled", label: "♻️ Recycled New", cls: "bg-cyan-50 text-cyan-700", title: "Recycle karke wapas New kiye gaye orders" },
  { key: "dueToday", label: "Due Today", cls: "bg-amber-50 text-amber-700", title: "Aaj follow-up wale orders (terminal nahi)" },
  { key: "overdue", label: "Overdue", cls: "bg-red-50 text-red-700", title: "Overdue follow-ups (aaj se pehle ki date, abhi tak band nahi hue)" },
  { key: "future", label: "Future Followups", cls: "bg-violet-50 text-violet-700", title: "Aane wale dino ke follow-ups (terminal nahi)" },
];

export default function OrdersClient() {
  const meta = useMeta();
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [book, setBook] = useState<{ row: Row; carrier: "SHIPROCKET" | "INDIAPOST" } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState("");

  const query = sp.toString();
  const get = (k: string) => sp.get(k) || "";
  const setParams = useCallback((patch: Record<string, string | null>) => {
    const u = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (!v) u.delete(k); else u.set(k, v); }
    if (!("page" in patch)) u.delete("page");
    router.replace(`${path}?${u.toString()}`, { scroll: false });
  }, [sp, router, path]);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { setData(await api<Resp>(`/api/orders?${query}`)); } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, [query]);
  useEffect(() => { load(); setSel(new Set()); setAllMatching(false); }, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 3500); return () => clearTimeout(t); } }, [toast]);

  async function inlineStatus(r: Row, status: string) {
    try { await api(`/api/orders/${r.id}`, "PUT", { status }); setToast(`${r.orderNo}: ${status}`); load(); }
    catch (e) { alert((e as Error).message); }
  }
  async function del(r: Row) {
    if (!confirm(`${r.orderNo} delete karein?`)) return;
    try { await api(`/api/orders/${r.id}`, "DELETE"); load(); } catch (e) { alert((e as Error).message); }
  }

  const stateSel = get("state");
  const districts = useMemo(() => meta?.states.find((s) => s.name === stateSel)?.districts ?? [], [meta, stateSel]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const tab = get("tab") || "all";

  return (
    <div>
      {toast && <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Manage Orders</h1><div className="text-slate-500">{data?.total ?? "…"} orders</div></div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => setShowFilters(!showFilters)}>{showFilters ? "Hide Filters" : "Show Filters"}</button>
          {canM(meta, "orders.export") && <a className="btn" href={`/api/orders/export?${query}`}>Export</a>}
          {canM(meta, "orders.import") && <button className="btn" onClick={() => setImportOpen(true)}>Bulk Upload</button>}
          {canM(meta, "orders.create") && <Link className="btn-primary" href="/crm/orders/new">+ New Order</Link>}
        </div>
      </div>

      {/* Status tabs */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
        <TabBtn active={tab === "action"} onClick={() => setParams({ tab: "action", chip: null })} cls="border-teal-300 text-teal-700">🔥 Action Required <b>{data?.tabCounts.action ?? 0}</b></TabBtn>
        <TabBtn active={tab === "tomorrow"} onClick={() => setParams({ tab: "tomorrow", chip: null })} cls="border-violet-300 text-violet-700">📅 Tomorrow <b>{data?.tabCounts.tomorrow ?? 0}</b></TabBtn>
        <span className="mx-1 border-l border-slate-300" />
        <TabBtn active={tab === "all"} onClick={() => setParams({ tab: null, chip: null })} cls="">All <b>{data?.tabCounts.all ?? 0}</b></TabBtn>
        {(data?.tabs ?? []).map((t) => (
          <TabBtn key={t} active={tab === t} onClick={() => setParams({ tab: t, chip: null })} cls={statusClass(t)}>{t} <b>{data?.tabCounts[t] ?? 0}</b></TabBtn>
        ))}
      </div>

      {/* Work chips */}
      <div className="mb-3 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button key={c.key} title={c.title} onClick={() => setParams({ chip: get("chip") === c.key ? null : c.key, tab: null })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${c.cls} ${get("chip") === c.key ? "ring-2 ring-slate-900" : ""}`}>
            {c.label} <b>{data?.chipCounts[c.key] ?? 0}</b>
            {c.key === "assignedToday" && data && <span className="ml-1 text-xs opacity-70">({Math.max(0, (data.chipCounts.assignedToday ?? 0) - data.assignedRe)} naye + {data.assignedRe} dubara)</span>}
          </button>
        ))}
      </div>

      {/* Top row */}
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div><label className="label">Date</label>
          <select className="input !w-40" value={get("date") || "all"} onChange={(e) => setParams({ date: e.target.value === "all" ? null : e.target.value })}>
            {DATE_RANGES.filter((r) => r.key !== "3d").map((r) => <option key={r.key} value={r.key}>{r.key === "7d" ? "Last 7 Days" : r.key === "15d" ? "Last 15 Days" : r.key === "30d" ? "Last 30 Days" : r.label}</option>)}
          </select></div>
        <Multi label="Quick Filters" empty="None" options={QUICK_FILTERS.map((q) => ({ value: q.key, label: q.label }))} value={get("qf")} onChange={(v) => setParams({ qf: v })} multi />
        <Multi label="Post Office" empty="All" title="India Post status" options={[{ value: "action", label: "Action Required" }, ...POST_EVENTS.map((e) => ({ value: e, label: e }))]} value={get("post")} onChange={(v) => setParams({ post: v })} />
        <Multi label="Shipment" empty="All" title="Shipment status" options={[{ value: "action", label: "Action Required" }, ...SHIP_STATUSES.map((e) => ({ value: e, label: e })), { value: "Label Pending", label: "Label Pending" }, { value: "Manifest Pending", label: "Manifest Pending" }]} value={get("ship")} onChange={(v) => setParams({ ship: v })} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Money icon="💳" label="ONLINE" v={data?.money.online} cls="from-blue-600 to-blue-500" />
          <Money icon="💵" label="COD" v={data?.money.cod} cls="from-amber-700 to-amber-500" />
          <Money icon="🏆" label="INCENTIVE" v={data?.money.incentive} cls="from-green-800 to-green-600" />
        </div>
      </div>

      {showFilters && meta && (
        <div className="card mb-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <Sel label="Status" v={get("status")} on={(v) => setParams({ status: v })} opts={meta.statuses} />
          <Sel label="Source" v={get("source")} on={(v) => setParams({ source: v })} opts={meta.sources} />
          <Sel label="Payment" v={get("paymentStatus")} on={(v) => setParams({ paymentStatus: v })} opts={["Pending", "Completed"]} />
          <Sel label="State" v={get("state")} on={(v) => setParams({ state: v, district: null })} opts={meta.states.map((s) => s.name)} />
          <Sel label="District" v={get("district")} on={(v) => setParams({ district: v })} opts={districts} />
          <Txt label="Pincode" k="pincode" get={get} set={setParams} />
          <Txt label="Phone" k="phone" get={get} set={setParams} />
          <Txt label="Order ID" k="orderNo" get={get} set={setParams} ph="PHCRM..." />
          <Txt label="AWB / Article No." k="awb" get={get} set={setParams} ph="SF... / EY...IN" />
          <Sel label="Courier" v={get("courier")} on={(v) => setParams({ courier: v })} opts={[{ v: "India Post", l: "India Post (sabhi)" }, { v: "Shiprocket", l: "Shiprocket (sabhi courier)" }, ...meta.couriers]} />
          <Txt label="Customer" k="customer" get={get} set={setParams} />
          <Txt label="City" k="city" get={get} set={setParams} />
          <Sel label="Product" v={get("product")} on={(v) => setParams({ product: v })} opts={meta.products} />
          <Sel label="Lead Owner" v={get("owner")} on={(v) => setParams({ owner: v })} opts={[{ v: "0", l: "Unassigned" }, ...meta.agents.map((a) => ({ v: String(a.id), l: a.name }))]} />
          <Sel label="Dealer" all="All Dealers" v={get("dealer")} on={(v) => setParams({ dealer: v })} opts={meta.dealers.map((x) => ({ v: String(x.id), l: x.name }))} />
          <Sel label="Dealer assignment" v={get("dealerAssigned")} on={(v) => setParams({ dealerAssigned: v })} opts={[{ v: "1", l: "Assigned" }, { v: "0", l: "Unassigned (coverage me)" }]} />
          <Sel label="ZM" v={get("zm")} on={(v) => setParams({ zm: v })} opts={meta.zms.map((z) => ({ v: String(z.id), l: z.name }))} />
          <div />
          {[["odFrom", "Order date from"], ["odTo", "Order date to"], ["bkFrom", "Booked date from"], ["bkTo", "Booked date to"], ["fuFrom", "Follow-up from"], ["fuTo", "Follow-up to"],
            ["aaFrom", "Agent assign from"], ["aaTo", "Agent assign to"], ["daFrom", "Dealer assign from"], ["daTo", "Dealer assign to"], ["scFrom", "Status changed from"], ["scTo", "Status changed to"]].map(([k, l]) => (
            <div key={k}><label className="label">{l}</label><input type="date" className="input" value={get(k)} onChange={(e) => setParams({ [k]: e.target.value })} /></div>
          ))}
          <Sel label="Status changed = (kaun-sa)" all="Any status" v={get("scStatus")} on={(v) => setParams({ scStatus: v })} opts={meta.statuses} />
          <Sel label="Status badla kisne" v={get("scBy")} on={(v) => setParams({ scBy: v })} opts={[
            { v: "other", l: "-- KISI AUR ne badla (Lead Owner ne nahi) --" }, { v: "self", l: "-- Lead Owner ne KHUD badla --" }, { v: "system", l: "-- Webhook / Courier ne apne aap --" },
            ...meta.allUsers.filter((u) => u.role !== "DEALER").map((u) => ({ v: String(u.id), l: u.name }))]} />
          <div className="col-span-2 flex items-end gap-2">
            <button className={`btn ${get("workedToday") ? "!bg-slate-900 !text-white" : ""}`} title="Aaj jin orders par kisi INSAAN ne manual kaam kiya (status/follow-up/remark/edit/booking). Webhook automatic badlav nahi gine jaate." onClick={() => setParams({ workedToday: get("workedToday") ? null : "1" })}>Aaj jin par kaam hua</button>
            <button className="btn" onClick={() => router.replace(path)}>Clear</button>
          </div>
        </div>
      )}

      {/* Bulk bar */}
      {sel.size > 0 && meta && data && (
        <BulkBar meta={meta} count={allMatching ? data.total : sel.size} total={data.total} allMatching={allMatching}
          onSelectAll={() => setAllMatching(true)} onClear={() => { setSel(new Set()); setAllMatching(false); }}
          run={async (action, value, remark) => {
            if (action === "delete" && !confirm(`${allMatching ? data.total : sel.size} orders delete karein?`)) return;
            if (action === "excel") { window.location.href = `/api/orders/export?ids=${[...sel].join(",")}`; return; }
            try {
              const r = await api<{ ok: number; failed: number; errors: string[] }>("/api/orders/bulk", "POST", { ids: [...sel], all: allMatching, query, action, value, remark });
              alert(`Ho gaya: ${r.ok}, fail: ${r.failed}${r.errors.length ? "\n" + r.errors.join("\n") : ""}`);
              load();
            } catch (e) { alert((e as Error).message); }
          }} />
      )}

      {err && <div className="card mb-3 text-red-600">{err}</div>}
      <div className="card overflow-x-auto !p-0">
        <div className="flex items-center justify-between p-3">
          <span className="text-sm text-slate-500">{loading ? "Load ho raha hai…" : `Page ${data?.page ?? 1} / ${pages}`}</span>
          <select className="input !w-24" value={get("size") || "20"} onChange={(e) => setParams({ size: e.target.value })}>
            {[5, 10, 20, 50, 100, 200, 500].map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
        <table className="tbl">
          <thead><tr>
            <th><input type="checkbox" checked={!!data?.rows.length && data.rows.every((r) => sel.has(r.id))} onChange={(e) => setSel(e.target.checked ? new Set(data?.rows.map((r) => r.id)) : new Set())} /></th>
            {["Order ID", "Date", "Customer", "Phone", "Product", "Qty", "Amount", "Total", "Online", "Balance", "Status", "Payment", "Source", "City", "State", "District", "Pincode", "Address", "Follow-up", "Lead Owner", "Agent Assign", "Dealer", "Dealer Assign", "ZM", "AWB", "Shipping", "Remark", "Actions"].map((h) => <th key={h}>{h}</th>)}
          </tr></thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                <td><input type="checkbox" checked={sel.has(r.id)} onChange={(e) => { const s = new Set(sel); if (e.target.checked) s.add(r.id); else s.delete(r.id); setSel(s); setAllMatching(false); }} /></td>
                <td><Link href={`/crm/orders/${r.id}`} className="font-semibold text-blue-600 hover:underline">{r.orderNo}</Link></td>
                <td>{dt(r.createdAt)}</td>
                <td><Link href={`/crm/orders/${r.id}`} className="font-medium">{r.customerName}</Link>{!r.leadOwner && <span className="ml-1 rounded bg-blue-100 px-1 text-[10px] text-blue-700">Lead</span>}</td>
                <td><a href={`tel:${r.phone}`}>{r.phone}</a></td>
                <td>{r.product}</td><td>{r.qty}</td><td>{inr(r.unitPrice)}</td><td>{inr(r.total)}</td>
                <td>{r.online ? inr(r.online) : "-"}</td><td>{inr(r.balance)}</td>
                <td>
                  <select className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(r.status)}`} value={r.status}
                    disabled={!canM(meta, "orders.status")} onChange={(e) => inlineStatus(r, e.target.value)}>
                    {(meta?.statuses ?? [r.status]).map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td><span className={r.paymentStatus === "Completed" ? "text-green-600" : "text-amber-600"}>{r.paymentStatus}</span></td>
                <td>{r.source}</td><td>{r.city || "-"}</td><td>{r.state || "-"}</td><td>{r.district || "-"}</td><td>{r.pincode || "-"}</td>
                <td className="max-w-[220px] truncate" title={r.address || ""}>{r.address || "-"}</td>
                <td>{d(r.followupAt)}</td><td>{r.leadOwner?.name || "-"}</td><td>{d(r.agentAssignedAt)}</td>
                <td>{r.dealer ? `${r.dealer.name}` : "-"}</td><td>{d(r.dealerAssignedAt)}</td><td>{r.dealer?.zm?.name || "-"}</td>
                <td className="font-mono text-xs">{r.awb || "-"}</td><td>{r.shipStatus ? <span className="text-xs">{r.courier} · {r.shipStatus}</span> : "-"}</td>
                <td className="max-w-[200px] truncate" title={r.remark || ""}>{r.remark || "-"}</td>
                <td>
                  <div className="flex gap-1">
                    <a className="btn btn-sm" target="_blank" href={`https://wa.me/91${r.phone}`}>WA</a>
                    {canM(meta, "orders.edit") && <Link className="btn btn-sm" href={`/crm/orders/${r.id}`}>Edit</Link>}
                    <a className="btn btn-sm" target="_blank" href={`/crm/orders/${r.id}/invoice`}>Inv</a>
                    {canM(meta, "orders.delete") && <button className="btn btn-sm !text-red-600" onClick={() => del(r)}>Del</button>}
                    {!r.awb && canM(meta, "sr.book") && <button className="btn btn-sm" onClick={() => setBook({ row: r, carrier: "SHIPROCKET" })}>📦 Book with Shiprocket</button>}
                    {!r.awb && canM(meta, "ip.book") && <button className="btn btn-sm" onClick={() => setBook({ row: r, carrier: "INDIAPOST" })}>📮 India Post</button>}
                  </div>
                </td>
              </tr>
            ))}
            {data && data.rows.length === 0 && <tr><td colSpan={30} className="py-10 text-center text-slate-400">Koi order nahi mila</td></tr>}
          </tbody>
        </table>
        <Pager page={data?.page ?? 1} pages={pages} go={(p) => setParams({ page: String(p) })} />
      </div>

      {book && <BookModal orderId={book.row.id} orderNo={book.row.orderNo} carrier={book.carrier} onClose={() => setBook(null)} onDone={() => { setBook(null); load(); }} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load(); }} />}
    </div>
  );
}

function TabBtn({ active, onClick, cls, children }: { active: boolean; onClick: () => void; cls: string; children: React.ReactNode }) {
  return <button onClick={onClick} className={`chip ${active ? "!border-slate-900 !bg-slate-900 !text-white" : cls || "border-slate-300 bg-white"}`}>{children}</button>;
}

function Money({ icon, label, v, cls }: { icon: string; label: string; v?: number; cls: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl bg-gradient-to-r ${cls} px-4 py-2 text-white shadow`}>
      <span className="text-lg">{icon}</span><div><div className="text-[10px] opacity-80">{label}</div><div className="font-bold">{inr(v ?? 0)}</div></div>
    </div>
  );
}

type Opt = string | { v: string; l: string };
function Sel({ label, v, on, opts, all = "All" }: { label: string; v: string; on: (v: string | null) => void; opts: Opt[]; all?: string }) {
  return (
    <div><label className="label">{label}</label>
      <select className="input" value={v} onChange={(e) => on(e.target.value || null)}>
        <option value="">{all}</option>
        {opts.map((o) => typeof o === "string" ? <option key={o}>{o}</option> : <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function Txt({ label, k, get, set, ph }: { label: string; k: string; get: (k: string) => string; set: (p: Record<string, string | null>) => void; ph?: string }) {
  const urlV = get(k);
  const [v, setV] = useState(urlV);
  const t = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => setV(urlV), [urlV]);
  return (
    <div><label className="label">{label}</label>
      <input className="input" placeholder={ph} value={v} onChange={(e) => { setV(e.target.value); clearTimeout(t.current); const val = e.target.value; t.current = setTimeout(() => set({ [k]: val || null }), 500); }} />
    </div>
  );
}

function Multi({ label, empty, options, value, onChange, multi, title }: {
  label: string; empty: string; options: { value: string; label: string }[]; value: string; onChange: (v: string | null) => void; multi?: boolean; title?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = value ? value.split(",") : [];
  const text = cur.length ? (cur.length === 1 ? options.find((o) => o.value === cur[0])?.label ?? cur[0] : `${cur.length} chune`) : empty;
  return (
    <div className="relative" ref={ref}>
      <label className="label">{label}</label>
      <button className="input !w-auto min-w-[90px] text-left" onClick={() => setOpen(!open)}>{text} ▾</button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-80 w-64 overflow-y-auto rounded-xl border bg-white p-2 shadow-xl dark:bg-slate-800">
          {title && <div className="mb-1 flex justify-between px-2 text-xs font-semibold text-slate-500">{title}<button onClick={() => { onChange(null); setOpen(false); }}>Clear</button></div>}
          {options.map((o) => {
            const on = cur.includes(o.value);
            return (
              <button key={o.value} className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${on ? "font-semibold text-green-700" : ""}`}
                onClick={() => {
                  if (multi) { const n = on ? cur.filter((x) => x !== o.value) : [...cur, o.value]; onChange(n.length ? n.join(",") : null); }
                  else { onChange(on ? null : o.value); setOpen(false); }
                }}>{multi && (on ? "☑ " : "☐ ")}{o.label}</button>
            );
          })}
          {multi && <button className="btn btn-sm mt-2 w-full" onClick={() => setOpen(false)}>Done</button>}
        </div>
      )}
    </div>
  );
}

function BulkBar({ meta, count, total, allMatching, onSelectAll, onClear, run }: {
  meta: NonNullable<ReturnType<typeof useMeta>>; count: number; total: number; allMatching: boolean;
  onSelectAll: () => void; onClear: () => void; run: (action: string, value?: string, remark?: string) => void;
}) {
  const [status, setStatus] = useState(""); const [remark, setRemark] = useState("");
  const [owner, setOwner] = useState(""); const [dealer, setDealer] = useState("");
  return (
    <div className="card mb-3 flex flex-wrap items-center gap-2 border-green-300 bg-green-50 dark:bg-green-950/30">
      <b>{count} selected</b>
      {!allMatching && <button className="btn btn-sm" onClick={onSelectAll}>Select all {total} matching</button>}
      {canM(meta, "orders.status") && <>
        <select className="input !w-40" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Set status...</option>{meta.statuses.map((s) => <option key={s}>{s}</option>)}</select>
        <input className="input !w-56" placeholder="Remark (optional) - sab par lagega" value={remark} onChange={(e) => setRemark(e.target.value)} />
        <button className="btn btn-sm" disabled={!status} onClick={() => run("status", status, remark)}>Apply status</button>
        <button className="btn btn-sm" onClick={() => run("recycle")}>♻️ Recycle to New</button>
      </>}
      {canM(meta, "orders.assignOwner") && <>
        <select className="input !w-44" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Change Lead Owner...</option><option value="0">Unassign</option>{meta.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <button className="btn btn-sm" disabled={!owner} onClick={() => run("owner", owner)}>Set Lead Owner</button>
      </>}
      {canM(meta, "orders.assignDealer") && <>
        <select className="input !w-48" value={dealer} onChange={(e) => setDealer(e.target.value)}><option value="">Dealer chunein...</option>{meta.dealers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <button className="btn btn-sm" disabled={!dealer} onClick={() => run("dealer", dealer)}>Assign Dealer</button>
        <button className="btn btn-sm" onClick={() => run("removeDealer")}>Remove Dealer</button>
      </>}
      {canM(meta, "sr.book") && <button className="btn btn-sm" onClick={() => run("srBook")}>📦 Book Auto (Shiprocket)</button>}
      {canM(meta, "sr.track") && <button className="btn btn-sm" onClick={() => run("srSync")}>🔄 Sync Status (Shiprocket)</button>}
      {canM(meta, "orders.export") && !allMatching && <button className="btn btn-sm" onClick={() => run("excel")}>📦 Chune hue ka Excel ({count})</button>}
      {canM(meta, "ip.book") && <button className="btn btn-sm" onClick={() => run("ipBook")}>📮 India Post (bulk)</button>}
      {canM(meta, "orders.delete") && <button className="btn btn-sm !text-red-600" onClick={() => run("delete")}>Delete selected</button>}
      <button className="btn btn-sm" onClick={onClear}>Clear selection</button>
    </div>
  );
}

function Pager({ page, pages, go }: { page: number; pages: number; go: (p: number) => void }) {
  const [to, setTo] = useState("");
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 p-3">
      <button className="btn btn-sm" disabled={page <= 1} onClick={() => go(page - 1)}>← Prev</button>
      <span className="text-sm">{page} / {pages}</span>
      <input type="number" className="input !w-20 !py-1" placeholder="Go to" value={to} onChange={(e) => setTo(e.target.value)} />
      <button className="btn btn-sm" onClick={() => { const n = +to; if (n >= 1 && n <= pages) go(n); }}>Go</button>
      <button className="btn btn-sm" disabled={page >= pages} onClick={() => go(page + 1)}>Next →</button>
    </div>
  );
}
