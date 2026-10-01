"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, canM, useMeta } from "@/components/useMeta";
import BookModal from "./BookModal";

type F = Record<string, string>;
const EMPTY: F = {
  customerName: "", phone: "", altPhone: "", email: "", product: "Sutra Gold+", productOther: "", extra: "", qty: "1", address: "", pincode: "",
  city: "", state: "", district: "", source: "Calling", status: "New", remark: "", unitPrice: "", total: "", online: "0",
  paymentMode: "COD", paymentStatus: "Pending", leadOwnerId: "", dealerId: "", followupAt: "",
};

type Full = F & {
  id: string; orderNo: string; createdAt: string; awb: string; carrier: string; courier: string; shipStatus: string;
  history: { id: number; field: string; oldValue: string | null; newValue: string | null; byName: string | null; createdAt: string }[];
  notes: { id: number; text: string; createdAt: string; user: { name: string } | null }[];
  previous: { id: number; orderNo: string; status: string; total: number; createdAt: string }[];
  calls: { id: number; startedAt: string; result: string; durationSec: number; recordingUrl: string | null }[];
};

const fmt = (s: string) => new Date(s).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function OrderForm({ id }: { id?: number }) {
  const meta = useMeta();
  const router = useRouter();
  const [f, setF] = useState<F>(EMPTY);
  const [full, setFull] = useState<Full | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [book, setBook] = useState<"SHIPROCKET" | "INDIAPOST" | null>(null);

  async function load() {
    if (!id) return;
    const o = await api<Record<string, unknown>>(`/api/orders/${id}`);
    const x: F = { ...EMPTY };
    for (const k of Object.keys(EMPTY)) if (o[k] != null) x[k] = String(o[k]);
    if (o.followupAt) x.followupAt = String(o.followupAt).slice(0, 10);
    setF(x); setFull(o as unknown as Full);
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (id) return;
    const ph = new URLSearchParams(window.location.search).get("phone");
    if (ph) setF((p) => ({ ...p, phone: ph }));
  }, [id]);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const autoTotal = useMemo(() => (+f.qty || 1) * (+f.unitPrice || 0), [f.qty, f.unitPrice]);
  const total = +f.total || autoTotal;
  const balance = Math.max(0, total - (+f.online || 0));
  const districts = meta?.states.find((s) => s.name === f.state)?.districts ?? [];

  async function save() {
    setBusy(true); setMsg("");
    const body = { ...f, product: f.product === "__other" ? f.productOther : f.product, total: f.total || autoTotal };
    try {
      if (id) { await api(`/api/orders/${id}`, "PUT", body); setMsg("Save ho gaya ✓"); load(); }
      else { const o = await api<{ id: number }>("/api/orders", "POST", body); router.replace(`/crm/orders/${o.id}`); }
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }
  async function del() {
    if (!id || !confirm("Order delete karein?")) return;
    const reason = prompt("Wajah (optional)") || "";
    try { await api(`/api/orders/${id}?reason=${encodeURIComponent(reason)}`, "DELETE"); router.replace("/crm/orders"); } catch (e) { alert((e as Error).message); }
  }
  function copy() {
    const t = `Order: ${full?.orderNo ?? ""}\nNaam: ${f.customerName}\nMobile: ${f.phone}\nProduct: ${f.product} x ${f.qty}\nAmount: ₹${total} (COD ₹${balance})\nPata: ${f.address}, ${f.city}, ${f.district}, ${f.state} - ${f.pincode}`;
    navigator.clipboard.writeText(t); setMsg("Details copy ho gaye ✓");
  }
  async function addNote() {
    if (!note.trim() || !id) return;
    await api(`/api/orders/${id}/notes`, "POST", { text: note }); setNote(""); load();
  }

  const Field = ({ k, label, type = "text", ph, color = "border-slate-300" }: { k: string; label: string; type?: string; ph?: string; color?: string }) => (
    <div className={`border-l-4 pl-3 ${color}`}><label className="label">{label}</label>
      <input className="input" type={type} placeholder={ph} value={f[k]} onChange={(e) => set(k, e.target.value)} /></div>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button className="btn !bg-slate-500 !text-white" onClick={() => router.back()}>Back</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{id ? `Order ${full?.orderNo ?? ""}` : "New Order"}</h1>
          {full && <div className="text-xs text-slate-500">🕒 Order Date: {fmt(full.createdAt)} IST</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-blue" onClick={copy}>Copy Details</button>
          {id && <a className="btn !bg-green-900 !text-white" target="_blank" href={`/crm/orders/${id}/guarantee`}>Guarantee Card</a>}
          <a className="btn !bg-teal-500 !text-white" target="_blank" href={`https://www.google.com/maps/search/${encodeURIComponent(`${f.address} ${f.city} ${f.state} ${f.pincode}`)}`}>Locate on Map</a>
          {id && <a className="btn !bg-violet-500 !text-white" target="_blank" href={`/crm/orders/${id}/invoice`}>Invoice</a>}
          {id && canM(meta, "orders.delete") && <button className="btn-red" onClick={del}>Delete</button>}
          <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "..." : "Save"}</button>
        </div>
      </div>
      {full && <div className="mb-3 text-sm">Sources: <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold dark:bg-slate-700">{f.source}</span></div>}
      {msg && <div className="card mb-3 !py-2 text-sm">{msg}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card !p-0">
            <div className="rounded-t-2xl bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-3 font-semibold text-white">👤 Customer &amp; Order</div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              {Field({ k: "customerName", label: "Customer Name", color: "border-green-500" })}
              <div>{Field({ k: "phone", label: "Contact Number", ph: "10 digits", color: "border-blue-500" })}
                {f.phone && <a className="ml-3 text-xs text-green-700" href={`tel:${f.phone}`}>Call this number</a>}</div>
              {Field({ k: "altPhone", label: "Alternate Mobile (optional)", ph: "10 digits", color: "border-cyan-500" })}
              {Field({ k: "email", label: "Email (optional)", color: "border-violet-500" })}
              <div className="border-l-4 border-orange-500 pl-3"><label className="label">Product</label>
                <select className="input" value={meta?.products.includes(f.product) || f.product === "__other" ? f.product : "__other"} onChange={(e) => set("product", e.target.value)}>
                  <option value="">-- chuniye --</option>{meta?.products.map((p) => <option key={p}>{p}</option>)}<option value="__other">Other (naya likhein)</option>
                </select>
                {(f.product === "__other" || (meta && f.product && !meta.products.includes(f.product))) &&
                  <input className="input mt-2" placeholder="Product naam" value={f.product === "__other" ? f.productOther : f.product} onChange={(e) => { set("product", "__other"); set("productOther", e.target.value); }} />}
              </div>
              {Field({ k: "extra", label: "Extra (saath me kya diya - Majun, spray, gel waghera - optional)", ph: "jaise: + Majun, + Spray" })}
              {Field({ k: "qty", label: "Quantity", type: "number", color: "border-orange-500" })}
              <div />
              <div className="border-l-4 border-teal-500 pl-3 md:col-span-2"><label className="label">Address</label>
                <textarea className="input" rows={2} value={f.address} onChange={(e) => set("address", e.target.value)} /></div>
              {Field({ k: "pincode", label: "Pincode", ph: "6 digits", color: "border-teal-500" })}
              {Field({ k: "city", label: "City", color: "border-teal-500" })}
              <div className="border-l-4 border-teal-500 pl-3"><label className="label">State</label>
                <select className="input" value={f.state} onChange={(e) => { set("state", e.target.value); set("district", ""); }}>
                  <option value="">-</option>{meta?.states.map((s) => <option key={s.name}>{s.name}</option>)}</select></div>
              <div className="border-l-4 border-teal-500 pl-3"><label className="label">District</label>
                <select className="input" value={f.district} onChange={(e) => set("district", e.target.value)}>
                  <option value="">-</option>{districts.map((d) => <option key={d}>{d}</option>)}{f.district && !districts.includes(f.district) && <option>{f.district}</option>}</select></div>
              <div className="border-l-4 border-pink-500 pl-3"><label className="label">Source</label>
                <select className="input" value={f.source} onChange={(e) => set("source", e.target.value)}>{meta?.sources.map((s) => <option key={s}>{s}</option>)}</select></div>
              <div className="border-l-4 border-pink-500 pl-3"><label className="label">Status</label>
                <select className="input" value={f.status} disabled={!canM(meta, "orders.status")} onChange={(e) => set("status", e.target.value)}>{meta?.statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
              {Field({ k: "followupAt", label: "Follow-up date", type: "date", color: "border-amber-500" })}
              <div className="border-l-4 border-slate-400 pl-3"><label className="label">Remark</label>
                <textarea className="input" rows={2} value={f.remark} onChange={(e) => set("remark", e.target.value)} /></div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {full && (<>
            <div className="card">
              <h3 className="mb-2 font-semibold">🚚 Shipping</h3>
              {full.awb ? (
                <div className="space-y-1 text-sm">
                  <div>{full.courier} · <span className="font-mono">{full.awb}</span></div>
                  <div>Status: <b>{full.shipStatus || "-"}</b></div>
                  <div className="flex gap-2 pt-2">
                    <button className="btn btn-sm" onClick={async () => { await api(`/api/shipping/track?orderId=${id}`); load(); }}>Track / Refresh</button>
                    <button className="btn btn-sm !text-red-600" onClick={async () => { if (confirm("Booking cancel karein?")) { try { await api("/api/shipping/cancel", "POST", { orderId: id }); load(); } catch (e) { alert((e as Error).message); } } }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {canM(meta, "sr.book") && <button className="btn btn-sm" onClick={() => setBook("SHIPROCKET")}>📦 Book with Shiprocket</button>}
                  {canM(meta, "ip.book") && <button className="btn btn-sm" onClick={() => setBook("INDIAPOST")}>📮 India Post</button>}
                </div>
              )}
            </div>

            {canM(meta, "notes.view") && (
              <div className="card">
                <h3 className="mb-2 font-semibold">📝 Customer Notes (shared)</h3>
                {canM(meta, "notes.add") && <div className="mb-2 flex gap-2"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note likhein..." /><button className="btn btn-sm" onClick={addNote}>Add</button></div>}
                {full.notes.map((n) => <div key={n.id} className="border-b py-1 text-sm"><div>{n.text}</div><div className="text-xs text-slate-500">{n.user?.name} · {fmt(n.createdAt)}</div></div>)}
              </div>
            )}

            {full.previous.length > 0 && (
              <div className="card"><h3 className="mb-2 font-semibold">🔁 Isi number ke purane orders</h3>
                {full.previous.map((p) => <Link key={p.id} href={`/crm/orders/${p.id}`} className="block text-sm text-blue-600">{p.orderNo} · {p.status} · ₹{p.total}</Link>)}</div>
            )}

            {full.calls.length > 0 && (
              <div className="card"><h3 className="mb-2 font-semibold">📞 Calls</h3>
                {full.calls.map((c) => <div key={c.id} className="text-sm">{fmt(c.startedAt)} · {c.result} · {c.durationSec}s {c.recordingUrl && <a className="text-blue-600" target="_blank" href={c.recordingUrl}>▶</a>}</div>)}</div>
            )}

            <div className="card"><h3 className="mb-2 font-semibold">📜 History</h3>
              <div className="max-h-96 overflow-y-auto">
                {full.history.map((h) => (
                  <div key={h.id} className="border-b py-1 text-xs">
                    <b>{h.field}</b>: {h.oldValue ?? "—"} → <b>{h.newValue ?? "—"}</b>
                    <div className="text-slate-500">{h.byName ?? "System"} · {fmt(h.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          </>)}

          <div className="card !p-0">
            <div className="rounded-t-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 font-semibold text-white">💰 Payment Information</div>
            <div className="grid grid-cols-2 gap-3 p-4">
              {Field({ k: "unitPrice", label: "Unit Price (Rs)", type: "number" })}
              {Field({ k: "total", label: "Total Amount (Rs)", type: "number", ph: `auto: ${autoTotal}` })}
              {Field({ k: "online", label: "Online Payment Received (Rs)", type: "number" })}
              <div className="pl-3"><label className="label">Balance / COD Collectable</label><div className="text-2xl font-bold text-green-700">Rs {balance}</div></div>
              <div className="pl-3"><label className="label">Payment Mode</label>
                <select className="input" value={f.paymentMode} onChange={(e) => set("paymentMode", e.target.value)}>{["COD", "Prepaid", "Partial"].map((x) => <option key={x}>{x}</option>)}</select></div>
              <div className="pl-3"><label className="label">Payment Status</label>
                <select className="input" value={f.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)}>{["Pending", "Completed"].map((x) => <option key={x}>{x}</option>)}</select></div>
            </div>
          </div>

          <div className="card !p-0">
            <div className="rounded-t-2xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-3 font-semibold text-white">💼 Lead Assignment</div>
            <div className="grid gap-3 p-4">
              <div><label className="label">Lead Owner (assign / change)</label>
                <select className="input" value={f.leadOwnerId} disabled={!canM(meta, "orders.assignOwner")} onChange={(e) => set("leadOwnerId", e.target.value)}>
                  <option value="">Not assigned</option>{meta?.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div><label className="label">Dealer (optional)</label>
                <select className="input" value={f.dealerId} disabled={!canM(meta, "orders.assignDealer")} onChange={(e) => set("dealerId", e.target.value)}>
                  <option value="">No dealer</option>{meta?.dealers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.city || "-"})</option>)}</select></div>
            </div>
          </div>
        </div>
      </div>
      {book && id && full && <BookModal orderId={id} orderNo={full.orderNo} carrier={book} onClose={() => setBook(null)} onDone={() => { setBook(null); load(); }} />}
    </div>
  );
}
