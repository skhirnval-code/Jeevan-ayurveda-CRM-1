"use client";
import { useCallback, useEffect, useState } from "react";
import { api, canM, useMeta } from "@/components/useMeta";

type D = {
  id: number; code: string; name: string; username: string | null; firmName: string | null; contactPerson: string | null; mobile: string | null; altMobile: string | null;
  email: string | null; gst: string | null; pan: string | null; address: string | null; city: string | null; pincode: string | null; territory: string | null; state: string | null;
  district: string | null; creditLimit: number | null; openingStock: number | null; defaultMargin: number; minStock: number; notes: string | null; active: boolean;
  zm: { id: number; name: string } | null; loginUser: { username: string } | null;
};
type T = { id: number; level: string; value: string; priority: number; dealer: { name: string; code: string } };
type Resp = { rows: D[]; total: number; page: number; size: number; facets: { states: string[]; districts: string[]; cities: string[]; territories: string[] }; territories: T[] };
const COLS = ["Dealer", "Contact", "Mobile", "Location", "ZM", "Status", "Actions"];

export default function DealersClient() {
  const meta = useMeta();
  const [f, setF] = useState<Record<string, string>>({ size: "25", page: "1", sort: "asc" });
  const [d, setD] = useState<Resp | null>(null);
  const [own, setOwn] = useState(false);
  const [edit, setEdit] = useState<D | "new" | null>(null);
  const [terr, setTerr] = useState<D | null>(null);
  const [cols, setCols] = useState<string[]>(COLS);
  const [colsOpen, setColsOpen] = useState(false);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const load = useCallback(() => api<Resp>(`/api/dealers?${qs}`).then(setD), [qs]);
  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v, page: k === "page" ? v : "1" }));
  const pages = d ? Math.max(1, Math.ceil(d.total / d.size)) : 1;

  async function patch(x: D, body: Record<string, unknown>) { try { await api(`/api/dealers/${x.id}`, "PUT", body); load(); } catch (e) { alert((e as Error).message); } }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Dealers Management</h1>
        <div className="flex flex-wrap gap-2">
          <a className="btn" href={`/api/dealers/export?${qs}`}>Export to Excel</a>
          <button className="btn" onClick={() => setOwn(!own)}>{own ? "Hide Ownership" : "Territory Ownership"}</button>
          {canM(meta, "masters.edit") && <button className="btn-primary" onClick={() => setEdit("new")}>Create New Dealer</button>}
        </div>
      </div>
      <div className="card mb-3 grid grid-cols-2 gap-2 md:grid-cols-7">
        <input className="input md:col-span-2" placeholder="Search: name / Dealer ID / username" value={f.q || ""} onChange={(e) => set("q", e.target.value)} />
        <select className="input" value={f.status || ""} onChange={(e) => set("status", e.target.value)}><option value="">All status</option><option value="active">Active</option><option value="disabled">Disabled</option></select>
        {(["state", "district", "city", "territory"] as const).map((k) => (
          <select key={k} className="input" value={f[k] || ""} onChange={(e) => set(k, e.target.value)}>
            <option value="">All {k === "city" ? "cities" : k === "territory" ? "territories" : k + "s"}</option>
            {(d?.facets[k === "city" ? "cities" : k === "territory" ? "territories" : (k + "s") as "states"] ?? []).map((x) => <option key={x}>{x}</option>)}
          </select>
        ))}
        <select className="input" value={f.zm || ""} onChange={(e) => set("zm", e.target.value)}><option value="">All ZM</option><option value="none">ZM nahi diya</option>{meta?.zms.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
      </div>

      {own && d && (
        <div className="card mb-3 overflow-x-auto"><h3 className="mb-2 font-semibold">Territory Ownership</h3>
          <table className="tbl"><thead><tr><th>Territory</th><th>Level</th><th>Dealer</th><th>Code</th><th>Priority</th></tr></thead>
            <tbody>{d.territories.map((t) => <tr key={t.id}><td>{t.value}</td><td>{t.level}</td><td>{t.dealer.name}</td><td>{t.dealer.code}</td><td>{t.priority}</td></tr>)}</tbody></table></div>
      )}

      <div className="card overflow-x-auto !p-0">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <select className="input !w-36" value={f.size} onChange={(e) => set("size", e.target.value)}>{[25, 50, 100, 250, 500, 1000].map((n) => <option key={n} value={n}>{n} / page</option>)}</select>
          <div className="relative"><button className="btn" onClick={() => setColsOpen(!colsOpen)}>Columns</button>
            {colsOpen && <div className="absolute z-20 mt-1 w-44 rounded-lg border bg-white p-2 shadow dark:bg-slate-800">{COLS.map((c) => <label key={c} className="flex gap-2 text-sm"><input type="checkbox" checked={cols.includes(c)} onChange={(e) => setCols(e.target.checked ? [...cols, c] : cols.filter((x) => x !== c))} />{c}</label>)}</div>}</div>
          <a className="btn" href={`/api/dealers/export?${qs}&format=csv`}>CSV</a>
          <button className="btn" onClick={() => window.print()}>Print/PDF</button>
          <span className="ml-auto text-sm text-slate-500">{d?.total ?? 0} dealers</span>
        </div>
        <table className="tbl">
          <thead><tr>
            {cols.includes("Dealer") && <th className="cursor-pointer" onClick={() => set("sort", f.sort === "asc" ? "desc" : "asc")}>Dealer {f.sort === "asc" ? "↑" : "↓"}</th>}
            {COLS.slice(1).filter((c) => cols.includes(c)).map((c) => <th key={c}>{c}</th>)}
          </tr></thead>
          <tbody>{d?.rows.map((x) => (
            <tr key={x.id} className={x.active ? "" : "opacity-50"}>
              {cols.includes("Dealer") && <td><div className="font-semibold">{x.name}</div><div className="text-xs text-slate-500">{x.code}{x.loginUser ? ` · ${x.loginUser.username}` : ""} · ₹{x.defaultMargin}/order</div></td>}
              {cols.includes("Contact") && <td>{x.contactPerson || x.firmName || "-"}</td>}
              {cols.includes("Mobile") && <td>{x.mobile || "-"}</td>}
              {cols.includes("Location") && <td>{[x.city, x.district, x.state].filter(Boolean).join(", ") || "-"}</td>}
              {cols.includes("ZM") && <td><select className="input !w-40 !py-1" value={x.zm?.id ?? ""} disabled={!canM(meta, "masters.edit")} onChange={(e) => patch(x, { zmId: e.target.value || null })}>
                <option value="">-- ZM nahi --</option>{meta?.zms.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></td>}
              {cols.includes("Status") && <td>{x.active ? <span className="text-green-600">Active</span> : <span className="text-red-600">Disabled</span>}</td>}
              {cols.includes("Actions") && <td><div className="flex gap-1">
                {canM(meta, "masters.edit") && <>
                  <button className="btn btn-sm" onClick={() => setEdit(x)}>Edit</button>
                  <button className="btn btn-sm" onClick={() => patch(x, { active: !x.active })}>{x.active ? "Disable" : "Enable"}</button>
                  <button className="btn btn-sm" onClick={() => setTerr(x)}>Territory</button>
                </>}
                <a className="btn btn-sm" title="Ledger" href={`/crm/dealers/ledger?dealer=${x.id}`}>⋯</a>
                <button className="btn btn-sm" title="Copy details" onClick={() => navigator.clipboard.writeText(`${x.name} (${x.code})\n${x.contactPerson ?? ""} ${x.mobile ?? ""}\n${x.address ?? ""}, ${x.city ?? ""}, ${x.state ?? ""} ${x.pincode ?? ""}\nGST: ${x.gst ?? "-"}`)}>⧉</button>
              </div></td>}
            </tr>))}</tbody>
        </table>
        <div className="flex justify-center gap-2 p-3">
          <button className="btn btn-sm" disabled={+f.page <= 1} onClick={() => set("page", String(+f.page - 1))}>Prev</button>
          <span className="text-sm">{f.page} / {pages}</span>
          <button className="btn btn-sm" disabled={+f.page >= pages} onClick={() => set("page", String(+f.page + 1))}>Next</button>
        </div>
      </div>
      {edit && <DealerForm dealer={edit === "new" ? null : edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); load(); }} />}
      {terr && <TerritoryModal dealer={terr} onClose={() => { setTerr(null); load(); }} />}
    </div>
  );
}

function DealerForm({ dealer, onClose, onDone }: { dealer: D | null; onClose: () => void; onDone: () => void }) {
  const meta = useMeta();
  const [f, setF] = useState<Record<string, string | boolean>>(() => ({
    name: dealer?.name ?? "", code: dealer?.code ?? "", username: dealer?.username ?? "", firmName: dealer?.firmName ?? "", contactPerson: dealer?.contactPerson ?? "",
    mobile: dealer?.mobile ?? "", altMobile: dealer?.altMobile ?? "", email: dealer?.email ?? "", gst: dealer?.gst ?? "", pan: dealer?.pan ?? "", address: dealer?.address ?? "",
    city: dealer?.city ?? "", pincode: dealer?.pincode ?? "", territory: dealer?.territory ?? "", state: dealer?.state ?? "", district: dealer?.district ?? "",
    creditLimit: dealer?.creditLimit?.toString() ?? "", openingStock: dealer?.openingStock?.toString() ?? "", defaultMargin: dealer?.defaultMargin?.toString() ?? "",
    zmId: dealer?.zm?.id?.toString() ?? "", minStock: dealer?.minStock?.toString() ?? "", notes: dealer?.notes ?? "", createLogin: false, loginEmail: "", password: "",
  }));
  const [msg, setMsg] = useState("");
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const districts = meta?.states.find((s) => s.name === f.state)?.districts ?? [];
  const I = (k: string, l: string, ph = "") => <div><label className="label">{l}</label><input className="input" placeholder={ph} value={String(f[k] ?? "")} onChange={(e) => set(k, e.target.value)} /></div>;
  async function save() {
    try {
      if (dealer) await api(`/api/dealers/${dealer.id}`, "PUT", f);
      else { const r = await api<{ code: string; tempPassword: string | null }>("/api/dealers", "POST", f); if (r.tempPassword) alert(`Dealer ${r.code} bana. Login password: ${r.tempPassword}`); }
      onDone();
    } catch (e) { setMsg((e as Error).message); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card max-h-[92vh] w-full max-w-4xl overflow-y-auto">
        <div className="mb-3 flex justify-between"><h3 className="text-lg font-bold">{dealer ? `Edit Dealer — ${dealer.code}` : "New Dealer"}</h3><button onClick={onClose}>×</button></div>
        <div className="grid gap-3 md:grid-cols-3">
          {I("name", "Dealer Name *", "Dealer ka naam")}{I("code", "Dealer ID (editable, unique)", "auto (PHD0001) ya manual")}{I("username", "Username (khaali = auto)", "khaali = naam se")}
          {I("firmName", "Firm Name", "Firm / business")}{I("contactPerson", "Contact Person", "Sampark vyakti")}{I("mobile", "Mobile", "10 digit")}
          {I("altMobile", "Alternate Mobile", "optional")}{I("email", "Email", "email@example.com")}{I("gst", "GST Number", "15 digit GSTIN")}
          {I("pan", "PAN Number", "10 digit PAN")}{I("address", "Address", "Poora pata")}{I("city", "City", "Sheher")}
          {I("pincode", "Pincode", "6 digit")}{I("territory", "Territory", "e.g. Amritsar zone")}
          <div><label className="label">State</label><select className="input" value={String(f.state)} onChange={(e) => { set("state", e.target.value); set("district", ""); }}><option value="">-- State --</option>{meta?.states.map((s) => <option key={s.name}>{s.name}</option>)}</select></div>
          <div><label className="label">District</label><select className="input" value={String(f.district)} onChange={(e) => set("district", e.target.value)}><option value="">-- District --</option>{districts.map((x) => <option key={x}>{x}</option>)}</select></div>
          {I("creditLimit", "Credit Limit", "optional (₹)")}{I("openingStock", "Opening Stock", "units (optional)")}{I("defaultMargin", "Default Margin (₹/order)", "e.g. 250 (dealer keeps)")}
          <div><label className="label">Zone Manager (ZM)</label><select className="input" value={String(f.zmId)} onChange={(e) => set("zmId", e.target.value)}><option value="">-- ZM nahi --</option>{meta?.zms.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>
          {I("minStock", "Min Stock Level", "default 20 (low-stock alert)")}
          <div className="md:col-span-3"><label className="label">Notes</label><textarea className="input" placeholder="Admin notes" value={String(f.notes)} onChange={(e) => set("notes", e.target.value)} /></div>
          {!dealer && <>
            <label className="flex items-center gap-2 text-sm md:col-span-3"><input type="checkbox" checked={!!f.createLogin} onChange={(e) => set("createLogin", e.target.checked)} />🔑 Iss dealer ka Login Account bhi abhi banao</label>
            {f.createLogin && <>{I("loginEmail", "Login ID (Email upar se)", "dealer@example.com")}{I("password", "Password (khaali = auto temp)", "min 8 chars ya khaali chhodein")}</>}
          </>}
        </div>
        {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
        <div className="mt-4 flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>{dealer ? "Save" : "Create"}</button></div>
      </div>
    </div>
  );
}

function TerritoryModal({ dealer, onClose }: { dealer: D; onClose: () => void }) {
  const [list, setList] = useState<{ id: number; level: string; value: string; priority: number }[]>([]);
  const [level, setLevel] = useState("CITY"); const [value, setValue] = useState(""); const [priority, setPriority] = useState("1");
  const load = useCallback(() => api<{ territories: typeof list }>(`/api/dealers/${dealer.id}`).then((r) => setList(r.territories)), [dealer.id]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-lg">
        <div className="mb-3 flex justify-between"><h3 className="font-bold">Territory — {dealer.name}</h3><button onClick={onClose}>×</button></div>
        <p className="mb-2 text-xs text-slate-500">Is area ke orders ke liye ye dealer suggest hoga (kam priority number = pehle).</p>
        {list.map((t) => <div key={t.id} className="flex items-center justify-between border-b py-1 text-sm"><span>{t.level}: <b>{t.value}</b> (P{t.priority})</span>
          <button className="text-red-600" onClick={async () => { await api(`/api/dealers/${dealer.id}/territory?tid=${t.id}`, "DELETE"); load(); }}>Hatao</button></div>)}
        <div className="mt-3 flex gap-2">
          <select className="input !w-32" value={level} onChange={(e) => setLevel(e.target.value)}>{["STATE", "DISTRICT", "CITY", "PINCODE"].map((l) => <option key={l}>{l}</option>)}</select>
          <input className="input" placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} />
          <input className="input !w-20" type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
          <button className="btn-primary" onClick={async () => { await api(`/api/dealers/${dealer.id}/territory`, "POST", { level, value, priority }); setValue(""); load(); }}>Add</button>
        </div>
      </div>
    </div>
  );
}
