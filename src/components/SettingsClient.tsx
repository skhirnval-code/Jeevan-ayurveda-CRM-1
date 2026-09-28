"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/useMeta";
import { INCENTIVE, STATUSES } from "@/lib/constants";

type S = {
  sources: { id: number; name: string; active: boolean; orders: number }[];
  stores: { storeKey: string; sourceId: number }[];
  statuses: { id: number; name: string; color: string; terminal: boolean; revenue: boolean; sortOrder: number; active: boolean }[];
  rules: { status: string; afterDays: number }[];
  settings: Record<string, unknown>;
  trash: { id: number; orderNo: string; customerName: string; phone: string; deletedAt: string; deletedReason: string | null }[];
};
const TABS = ["Sources", "Store Mapping", "Statuses", "Follow-up Rules", "Assignment", "CRM Preferences", "Trash"];

export default function SettingsClient() {
  const [tab, setTab] = useState("Sources");
  const [d, setD] = useState<S | null>(null);
  const [err, setErr] = useState("");
  const load = () => api<S>("/api/settings").then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const post = async (body: Record<string, unknown>) => {
    try { const r = await api<Record<string, unknown>>("/api/settings", "POST", body); await load(); return r; } catch (e) { alert((e as Error).message); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Settings - CRM Control Center</h1>
      <p className="mb-4 text-sm text-slate-500">Bina developer ke badalne yogya sabhi configuration yahin se. (Sirf SUPER_ADMIN)</p>
      <div className="mb-4 flex flex-wrap gap-2">{TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`btn ${tab === t ? "!bg-slate-900 !text-white" : ""}`}>{t}</button>)}</div>
      {err && <div className="card text-red-600">{err}</div>}
      {!d ? <div className="card">Load ho raha hai...</div> : (
        <>
          {tab === "Sources" && <Sources d={d} post={post} />}
          {tab === "Store Mapping" && <Stores d={d} post={post} />}
          {tab === "Statuses" && <Statuses d={d} post={post} />}
          {tab === "Follow-up Rules" && <Rules d={d} post={post} />}
          {tab === "Assignment" && <Assignment d={d} post={post} />}
          {tab === "CRM Preferences" && <Prefs d={d} post={post} />}
          {tab === "Trash" && <Trash d={d} post={post} />}
        </>
      )}
      <div className="card mt-6"><h3 className="mb-2 font-semibold">Maujuda pages (duplicate nahi - seedha link)</h3>
        <div className="flex gap-2"><Link className="btn" href="/crm/users">Users &amp; Access</Link><Link className="btn" href="/crm/shiprocket">Shiprocket</Link><Link className="btn" href="/crm/audit">Audit Logs</Link></div></div>
    </div>
  );
}

type P = { d: S; post: (b: Record<string, unknown>) => Promise<Record<string, unknown> | undefined> };

function Sources({ d, post }: P) {
  const [name, setName] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  return (
    <div className="space-y-4">
      <div className="card"><h3 className="mb-2 font-semibold">Add new Source</h3>
        <div className="flex gap-2"><input className="input" placeholder="jaise WhatsApp, Facebook, Deal" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn-primary" onClick={() => { post({ action: "source.add", name }); setName(""); }}>Add</button></div></div>
      <div className="card"><h3 className="mb-2 font-semibold">Sabhi Sources ({d.sources.length})</h3>
        <table className="tbl"><thead><tr><th>Source</th><th>Orders</th><th>Status</th><th /></tr></thead><tbody>
          {d.sources.map((s) => <tr key={s.id}><td>{s.name}</td><td>{s.orders}</td><td>{s.active ? "Active" : "Disabled"}</td>
            <td><button className="btn btn-sm" onClick={() => post({ action: "source.toggle", id: s.id, active: !s.active })}>{s.active ? "Disable" : "Enable"}</button></td></tr>)}
        </tbody></table></div>
      <div className="card"><h3 className="font-semibold">Duplicate Source Cleanup (Merge)</h3>
        <p className="mb-2 text-sm text-slate-500">Ek source ke sabhi orders dusre me move karein. Purana source disable ho jayega (delete nahi).</p>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input !w-56" value={from} onChange={(e) => setFrom(e.target.value)}><option value="">From (purana)...</option>{d.sources.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.orders})</option>)}</select>
          <span>→</span>
          <select className="input !w-56" value={to} onChange={(e) => setTo(e.target.value)}><option value="">To (mukhya)...</option>{d.sources.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <button className="btn-primary" disabled={!from || !to} onClick={async () => { if (confirm("Merge karein?")) { const r = await post({ action: "source.merge", from, to }); if (r) alert(`${r.moved} orders move hue`); } }}>Merge</button>
        </div></div>
    </div>
  );
}

function Stores({ d, post }: P) {
  const [rows, setRows] = useState(d.stores.map((s) => ({ storeKey: s.storeKey, sourceId: s.sourceId })));
  return (
    <div className="card space-y-3">
      <h3 className="font-semibold">Store → CRM Source Mapping</h3>
      <p className="text-sm text-slate-500">Har Shopify/online store ka apna CRM Source. Store ka identifier (storeKey, jaise domain) ko ek Source se jodein. Mapping na ho to naye orders default &quot;Orders&quot; source par jaate hain. Ingest payload me storeKey (ya store/shop/shopDomain) bhejna zaroori hai.</p>
      {rows.length === 0 && <p className="text-sm">Koi mapping nahi. Niche se add karein.</p>}
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <input className="input" placeholder="storeKey (jaise mystore.com)" value={r.storeKey} onChange={(e) => { const n = [...rows]; n[i] = { ...r, storeKey: e.target.value }; setRows(n); }} />
          <select className="input" value={r.sourceId || ""} onChange={(e) => { const n = [...rows]; n[i] = { ...r, sourceId: +e.target.value }; setRows(n); }}>
            <option value="">Source...</option>{d.sources.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <button className="btn" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="flex gap-2"><button className="btn" onClick={() => setRows([...rows, { storeKey: "", sourceId: 0 }])}>+ Add mapping</button><button className="btn-primary" onClick={() => post({ action: "stores.save", rows })}>Save Store Mapping</button></div>
    </div>
  );
}

function Statuses({ d, post }: P) {
  const [name, setName] = useState("");
  return (
    <div className="card">
      <h3 className="mb-2 font-semibold">Order Statuses</h3>
      <table className="tbl"><thead><tr><th>Status</th><th>Color</th><th>Terminal (follow-up band)</th><th>Revenue</th><th>Order</th><th>Active</th><th /></tr></thead>
        <tbody>{d.statuses.map((s) => <StatusRow key={s.id} s={s} post={post} />)}</tbody></table>
      <div className="mt-3 flex gap-2"><input className="input !w-64" placeholder="Naya status" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn-primary" onClick={() => { post({ action: "status.save", name, sortOrder: d.statuses.length + 1 }); setName(""); }}>Add</button></div>
    </div>
  );
}
function StatusRow({ s, post }: { s: S["statuses"][0]; post: P["post"] }) {
  const [x, setX] = useState(s);
  return (
    <tr><td className="font-medium">{s.name}</td>
      <td><select className="input !py-1" value={x.color} onChange={(e) => setX({ ...x, color: e.target.value })}>{["slate", "blue", "green", "amber", "orange", "red", "violet", "teal", "cyan"].map((c) => <option key={c}>{c}</option>)}</select></td>
      <td><input type="checkbox" checked={x.terminal} onChange={(e) => setX({ ...x, terminal: e.target.checked })} /></td>
      <td><input type="checkbox" checked={x.revenue} onChange={(e) => setX({ ...x, revenue: e.target.checked })} /></td>
      <td><input className="input !w-16 !py-1" type="number" value={x.sortOrder} onChange={(e) => setX({ ...x, sortOrder: +e.target.value })} /></td>
      <td><input type="checkbox" checked={x.active} onChange={(e) => setX({ ...x, active: e.target.checked })} /></td>
      <td><button className="btn btn-sm" onClick={() => post({ action: "status.save", ...x })}>Save</button></td></tr>
  );
}

function Rules({ d, post }: P) {
  const [rows, setRows] = useState(d.rules.length ? d.rules : [{ status: "Callback", afterDays: 1 }, { status: "Pending", afterDays: 2 }]);
  const statuses = d.statuses.length ? d.statuses.map((s) => s.name) : [...STATUSES];
  return (
    <div className="card space-y-2">
      <h3 className="font-semibold">Follow-up Rules</h3>
      <p className="text-sm text-slate-500">Status lagte hi agli follow-up date apne aap set hogi (aaj + X din). Terminal status par follow-up band.</p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <select className="input !w-56" value={r.status} onChange={(e) => { const n = [...rows]; n[i] = { ...r, status: e.target.value }; setRows(n); }}>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
          <span>→</span><input type="number" className="input !w-24" value={r.afterDays} onChange={(e) => { const n = [...rows]; n[i] = { ...r, afterDays: +e.target.value }; setRows(n); }} /><span>din baad</span>
          <button className="btn" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="flex gap-2"><button className="btn" onClick={() => setRows([...rows, { status: statuses[0], afterDays: 1 }])}>+ Rule</button><button className="btn-primary" onClick={() => post({ action: "rules.save", rows })}>Save Rules</button></div>
    </div>
  );
}

function Assignment({ d, post }: P) {
  const cur = (d.settings["assignment"] as { roles?: string[]; autoAssign?: boolean; roundRobin?: boolean }) || { roles: ["SUPER_ADMIN", "MANAGER"] };
  const [x, setX] = useState({ roles: cur.roles ?? ["SUPER_ADMIN", "MANAGER"], autoAssign: !!cur.autoAssign, roundRobin: !!cur.roundRobin });
  return (
    <div className="card space-y-3">
      <h3 className="font-semibold">Maujuda Assignment Authority</h3>
      <p className="text-sm text-slate-500">Kaun assign / reassign / Lead-Owner change kar sake. (User-level permission &quot;Assign / change Lead Owner&quot; bhi zaroori hai.)</p>
      <div className="flex flex-wrap gap-4">{["SUPER_ADMIN", "MANAGER", "ZM", "AGENT"].map((r) => (
        <label key={r} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={x.roles.includes(r)} onChange={(e) => setX({ ...x, roles: e.target.checked ? [...x.roles, r] : x.roles.filter((y) => y !== r) })} />{r}</label>))}</div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={x.autoAssign} onChange={(e) => setX({ ...x, autoAssign: e.target.checked })} />Naye orders apne aap agents ko assign karein</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={x.roundRobin} onChange={(e) => setX({ ...x, roundRobin: e.target.checked })} />Round-robin (barabar baantna)</label>
      <button className="btn-primary" onClick={() => post({ action: "setting.save", key: "assignment", value: x })}>Save</button>
    </div>
  );
}

function Prefs({ d, post }: P) {
  const cur = (d.settings["prefs"] as Record<string, number>) || {};
  const [x, setX] = useState({
    highValue: cur.highValue ?? 2000, recycleDays: cur.recycleDays ?? 7, wfhOnline: cur.wfhOnline ?? INCENTIVE.wfh.onlinePct, wfhCod: cur.wfhCod ?? INCENTIVE.wfh.codPct,
    officeMin: cur.officeMin ?? INCENTIVE.office.minOrder, officeOnline: cur.officeOnline ?? INCENTIVE.office.onlinePct, officeCod: cur.officeCod ?? INCENTIVE.office.codPct, officeDeduct: cur.officeDeduct ?? INCENTIVE.office.codDeduct,
  });
  const F = (k: keyof typeof x, l: string) => <div><label className="label">{l}</label><input type="number" className="input" value={x[k]} onChange={(e) => setX({ ...x, [k]: +e.target.value })} /></div>;
  return (
    <div className="card space-y-3">
      <h3 className="font-semibold">CRM Preferences</h3>
      <div className="grid gap-3 md:grid-cols-4">
        {F("highValue", "High Value order (₹ se upar)")}{F("recycleDays", "Recycle: X din bina kaam")}
        {F("wfhOnline", "WFH: Online %")}{F("wfhCod", "WFH: COD %")}
        {F("officeMin", "Office: min order ₹")}{F("officeOnline", "Office: Online %")}{F("officeCod", "Office: COD %")}{F("officeDeduct", "Office: COD se kaatein ₹")}
      </div>
      <button className="btn-primary" onClick={() => post({ action: "setting.save", key: "prefs", value: x })}>Save</button>
    </div>
  );
}

function Trash({ d, post }: P) {
  return (
    <div className="card">
      <h3 className="mb-2 font-semibold">Trash — soft-deleted orders</h3>
      <table className="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Deleted</th><th>Wajah</th><th /></tr></thead><tbody>
        {d.trash.map((t) => <tr key={t.id}><td>{t.orderNo}</td><td>{t.customerName} · {t.phone}</td><td>{new Date(t.deletedAt).toLocaleString("en-IN")}</td><td>{t.deletedReason ?? "-"}</td>
          <td className="flex gap-1"><button className="btn btn-sm" onClick={() => post({ action: "trash.restore", id: t.id })}>Restore</button>
            <button className="btn btn-sm !text-red-600" onClick={() => confirm("Hamesha ke liye delete?") && post({ action: "trash.purge", id: t.id })}>Permanent delete</button></td></tr>)}
        {d.trash.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400">Trash khaali hai</td></tr>}
      </tbody></table>
    </div>
  );
}
