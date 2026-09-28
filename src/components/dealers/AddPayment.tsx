"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/useMeta";
import { INVOICE_PAY_MODES } from "@/lib/constants";

export default function AddPayment({ dealers, dealerId }: { dealers: { id: number; name: string; code: string }[]; dealerId?: string }) {
  const r = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ dealerId: dealerId || "", type: "PAYMENT", side: "credit", amount: "", mode: "Bank Transfer", refNo: "", date: new Date().toISOString().slice(0, 10), particular: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  async function save() {
    try { await api("/api/dealers/ledger", "POST", f); setOpen(false); r.refresh(); } catch (e) { alert((e as Error).message); }
  }
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>Add Payment</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md space-y-2">
            <h3 className="font-bold">Add Payment / Entry</h3>
            <div><label className="label">Dealer</label><select className="input" value={f.dealerId} onChange={(e) => set("dealerId", e.target.value)}><option value="">-- Select Dealer --</option>{dealers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}</select></div>
            <div><label className="label">Type</label><select className="input" value={f.type} onChange={(e) => set("type", e.target.value)}><option value="PAYMENT">Payment mila (credit)</option><option value="ADJUST">Adjustment</option></select></div>
            {f.type === "ADJUST" && <div><label className="label">Side</label><select className="input" value={f.side} onChange={(e) => set("side", e.target.value)}><option value="credit">Credit (dealer ka kam karein)</option><option value="debit">Debit (dealer par badhayein)</option></select></div>}
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Amount (₹)</label><input className="input" type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></div>
              <div><label className="label">Date</label><input className="input" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
              <div><label className="label">Mode</label><select className="input" value={f.mode} onChange={(e) => set("mode", e.target.value)}>{INVOICE_PAY_MODES.map((m) => <option key={m}>{m}</option>)}</select></div>
              <div><label className="label">Ref / UTR</label><input className="input" value={f.refNo} onChange={(e) => set("refNo", e.target.value)} /></div>
            </div>
            <div><label className="label">Particular</label><input className="input" value={f.particular} onChange={(e) => set("particular", e.target.value)} /></div>
            <div className="flex justify-end gap-2"><button className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></div>
          </div>
        </div>
      )}
    </>
  );
}
