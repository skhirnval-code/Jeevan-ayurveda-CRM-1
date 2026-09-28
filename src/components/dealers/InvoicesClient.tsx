"use client";
import { useCallback, useEffect, useState } from "react";
import { api, canM, useMeta } from "@/components/useMeta";
import { INVOICE_PAY_MODES } from "@/lib/constants";

type Item = { product: string; hsn: string; qty: string; rate: string; gstRate: string };
type Inv = { id: number; invoiceNo: string; date: string; dealerId: number; dealer: { name: string; code: string }; paymentMode: string; status: string; grandTotal: number; paidAmount: number; discount: number; notes: string | null; items: { product: string; hsn: string | null; qty: number; rate: number; gstRate: number }[] };
const inr = (n: number) => "Rs " + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function InvoicesClient() {
  const meta = useMeta();
  const [f, setF] = useState({ range: "", from: "", to: "" });
  const [rows, setRows] = useState<Inv[]>([]);
  const [edit, setEdit] = useState<Inv | "new" | null>(null);
  const load = useCallback(() => api<Inv[]>(`/api/dealers/invoices?${new URLSearchParams(f)}`).then(setRows), [f]);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div><h1 className="text-2xl font-bold">Manage Invoice</h1><p className="text-sm text-slate-500">Dealer ko bheje gaye saaman ka GST invoice - banaye, dekhe, print/download karein.</p></div>
        {canM(meta, "masters.edit") && <button className="btn-primary" onClick={() => setEdit("new")}>+ New Invoice</button>}
      </div>
      <div className="card mb-3 flex flex-wrap items-end gap-2">
        <button className={`btn ${f.range === "today" ? "!bg-slate-900 !text-white" : ""}`} onClick={() => setF({ range: f.range === "today" ? "" : "today", from: "", to: "" })}>Aaj</button>
        <div><label className="label">From</label><input type="date" className="input" value={f.from} onChange={(e) => setF({ ...f, range: "", from: e.target.value })} /></div>
        <div><label className="label">To</label><input type="date" className="input" value={f.to} onChange={(e) => setF({ ...f, range: "", to: e.target.value })} /></div>
        <span className="ml-auto text-sm text-slate-500">{rows.length} invoice</span>
      </div>
      <div className="card overflow-x-auto !p-0"><table className="tbl">
        <thead><tr>{["Invoice No", "Date", "Dealer", "Payment Mode", "Status", "Grand Total", "Balance", "Actions"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((x) => (
          <tr key={x.id}><td className="font-semibold">{x.invoiceNo}</td><td>{new Date(x.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
            <td>{x.dealer.name} ({x.dealer.code})</td><td>{x.paymentMode}</td><td>{x.status}</td><td>{inr(x.grandTotal)}</td><td>{inr(Math.max(0, x.grandTotal - x.paidAmount))}</td>
            <td><div className="flex gap-1"><a className="btn btn-sm" target="_blank" href={`/crm/dealers/invoices/${x.id}`}>View / Print</a>
              {canM(meta, "masters.edit") && <><button className="btn btn-sm" onClick={() => setEdit(x)}>Edit</button>
                <button className="btn btn-sm !text-red-600" onClick={async () => { if (confirm(`${x.invoiceNo} delete karein?`)) { await api(`/api/dealers/invoices/${x.id}`, "DELETE"); load(); } }}>Delete</button></>}</div></td></tr>))}
          {rows.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-slate-400">Koi invoice nahi</td></tr>}</tbody></table></div>
      {edit && <InvoiceForm inv={edit === "new" ? null : edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function InvoiceForm({ inv, onClose, onDone }: { inv: Inv | null; onClose: () => void; onDone: () => void }) {
  const meta = useMeta();
  const [dq, setDq] = useState(inv ? `${inv.dealer.name} (${inv.dealer.code})` : "");
  const [dealerId, setDealerId] = useState(inv?.dealerId ?? 0);
  const [mode, setMode] = useState(inv?.paymentMode ?? "Bank Transfer");
  const [paid, setPaid] = useState(String(inv?.paidAmount ?? ""));
  const [discount, setDiscount] = useState(String(inv?.discount ?? ""));
  const [notes, setNotes] = useState(inv?.notes ?? "");
  const [items, setItems] = useState<Item[]>(inv?.items.map((i) => ({ product: i.product, hsn: i.hsn ?? "", qty: String(i.qty), rate: String(i.rate), gstRate: String(i.gstRate) })) ?? [{ product: "", hsn: "", qty: "1", rate: "", gstRate: "0" }]);
  const [msg, setMsg] = useState("");
  const matches = !dealerId && dq ? (meta?.dealers ?? []).filter((d) => `${d.name} ${d.code} ${d.city}`.toLowerCase().includes(dq.toLowerCase())).slice(0, 8) : [];
  const sub = items.reduce((a, i) => a + (+i.qty || 0) * (+i.rate || 0), 0);
  const gst = items.reduce((a, i) => a + ((+i.qty || 0) * (+i.rate || 0) * (+i.gstRate || 0)) / 100, 0);
  const grand = Math.max(0, sub + gst - (+discount || 0));
  const setItem = (i: number, k: keyof Item, v: string) => setItems(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  async function save() {
    const body = { dealerId, paymentMode: mode, paidAmount: paid, discount, notes, items };
    try { if (inv) await api(`/api/dealers/invoices/${inv.id}`, "PUT", body); else await api("/api/dealers/invoices", "POST", body); onDone(); } catch (e) { setMsg((e as Error).message); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card max-h-[92vh] w-full max-w-3xl overflow-y-auto">
        <h3 className="mb-3 text-lg font-bold">{inv ? `Edit ${inv.invoiceNo}` : "Naya Invoice"}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative md:col-span-3"><label className="label">Dealer</label>
            <input className="input" placeholder="Naam / mobile / firm / area se" value={dq} disabled={!!inv} onChange={(e) => { setDq(e.target.value); setDealerId(0); }} />
            {matches.length > 0 && <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow dark:bg-slate-800">{matches.map((d) => <button key={d.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={() => { setDealerId(d.id); setDq(`${d.name} (${d.code})`); }}>{d.name} · {d.code} · {d.city}</button>)}</div>}</div>
          <div><label className="label">Payment Mode</label><select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>{INVOICE_PAY_MODES.map((m) => <option key={m}>{m}</option>)}</select></div>
          <div><label className="label">Paid Amount (agar kuch mila ho)</label><input type="number" className="input" value={paid} onChange={(e) => setPaid(e.target.value)} /></div>
        </div>
        <label className="label mt-3">Items</label>
        <datalist id="products">{meta?.products.map((p) => <option key={p} value={p} />)}</datalist>
        {items.map((it, i) => (
          <div key={i} className="mb-2 grid grid-cols-12 gap-2">
            <input list="products" className="input col-span-4" placeholder="Product chunein ya naya type karein" value={it.product} onChange={(e) => setItem(i, "product", e.target.value)} />
            <input className="input col-span-2" placeholder="HSN" value={it.hsn} onChange={(e) => setItem(i, "hsn", e.target.value)} />
            <input type="number" className="input col-span-1" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} />
            <input type="number" className="input col-span-2" placeholder="Rate" value={it.rate} onChange={(e) => setItem(i, "rate", e.target.value)} />
            <select className="input col-span-2" value={it.gstRate} onChange={(e) => setItem(i, "gstRate", e.target.value)}>{["0", "5", "12", "18"].map((g) => <option key={g} value={g}>GST {g}%</option>)}</select>
            <button className="btn col-span-1" onClick={() => setItems(items.filter((_, j) => j !== i))}>Hatao</button>
          </div>
        ))}
        <button className="btn btn-sm" onClick={() => setItems([...items, { product: "", hsn: "", qty: "1", rate: "", gstRate: "0" }])}>+ Item jodein</button>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div><label className="label">Discount</label><input type="number" className="input" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
          <div><label className="label">Notes (optional)</label><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <div className="mt-3 text-right text-sm">Sub-total {inr(sub)} · GST {inr(gst)} · <b className="text-lg">Grand Total {inr(grand)}</b></div>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <div className="mt-3 flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!dealerId} onClick={save}>{inv ? "Save" : "Invoice Banayein"}</button></div>
      </div>
    </div>
  );
}
