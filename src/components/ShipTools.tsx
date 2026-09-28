"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/useMeta";

type Acc = { id: number; name: string; email: string; pickupLocation: string; sandbox: boolean; active: boolean };

export function SrAccounts({ accounts, webhookUrl }: { accounts: Acc[]; webhookUrl: string }) {
  const r = useRouter();
  const [form, setForm] = useState<Partial<Acc> & { password?: string } | null>(null);
  const run = async (body: Record<string, unknown>, okMsg?: string) => {
    try { const x = await api<{ pickupLocations?: string[] }>("/api/shiprocket/accounts", "POST", body); if (okMsg || x.pickupLocations) alert((okMsg ?? "OK") + (x.pickupLocations ? `\nPickup: ${x.pickupLocations.join(", ")}` : "")); r.refresh(); }
    catch (e) { alert((e as Error).message); }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">Webhook: <code className="rounded bg-slate-100 px-2 dark:bg-slate-900">{webhookUrl}</code>
        <button className="btn btn-sm" onClick={() => navigator.clipboard.writeText(webhookUrl)}>Copy URL</button>
        <span className="text-xs text-slate-500">Token (x-api-key) = .env SHIPROCKET_WEBHOOK_TOKEN</span>
        <button className="btn-primary btn-sm ml-auto" onClick={() => setForm({ name: "", email: "", pickupLocation: "Primary", sandbox: false })}>+ Add Account</button></div>
      {accounts.map((a) => (
        <div key={a.id} className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 ${a.active ? "border-green-400 bg-green-50 dark:bg-green-950/30" : ""}`}>
          <div className="flex-1"><b>{a.name}</b> {a.active && <span className="rounded bg-green-600 px-2 text-xs text-white">ACTIVE</span>} {a.sandbox && <span className="rounded bg-amber-500 px-2 text-xs text-white">SANDBOX</span>}
            <div className="text-xs text-slate-500">{a.email} · pickup: {a.pickupLocation}</div></div>
          <button className="btn btn-sm" onClick={() => run({ action: "test", id: a.id }, "Login OK ✓")}>Test</button>
          {a.sandbox && <button className="btn btn-sm" onClick={() => run({ action: "test", id: a.id }, "Sandbox OK ✓")}>🧪 Sandbox Test</button>}
          <button className="btn btn-sm" onClick={() => run({ action: "sync", id: a.id })}>Sync Pickup</button>
          {!a.active && <button className="btn btn-sm" onClick={() => run({ action: "activate", id: a.id })}>Activate</button>}
          <button className="btn btn-sm" onClick={() => setForm(a)}>Edit</button>
          <button className="btn btn-sm !text-red-600" onClick={() => confirm("Account delete?") && run({ action: "delete", id: a.id })}>Delete</button>
        </div>
      ))}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md space-y-2">
            <h3 className="font-bold">{form.id ? "Edit" : "Add"} Shiprocket Account</h3>
            <p className="text-xs text-slate-500">Shiprocket panel → Settings → API → &quot;Create API User&quot; ka email/password daalein.</p>
            {(["name", "email", "password", "pickupLocation"] as const).map((k) => (
              <div key={k}><label className="label">{k === "pickupLocation" ? "Pickup location naam" : k}</label>
                <input className="input" type={k === "password" ? "password" : "text"} placeholder={k === "password" && form.id ? "khaali = na badlein" : ""} value={(form[k] as string) ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
            ))}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.sandbox} onChange={(e) => setForm({ ...form, sandbox: e.target.checked })} />Sandbox / test account</label>
            <div className="flex justify-end gap-2"><button className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn-primary" onClick={async () => { await run({ action: form.id ? "update" : "create", ...form }); setForm(null); }}>Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Document Centre: labels / manifest / receipts */
export function DocCentre({ carrier }: { carrier: "SHIPROCKET" | "INDIAPOST" }) {
  const r = useRouter();
  const [range, setRange] = useState("today"); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [which, setWhich] = useState("pending"); const [busy, setBusy] = useState(false);
  const R = [["today", "Aaj"], ["yest", "Kal"], ["3d", "3 din"], ["7d", "7 din"], ["30d", "30 din"], ["all", "Sabhi"], ["custom", "Apni tareekh"]];
  async function go(kind: string) {
    setBusy(true);
    try {
      if (carrier === "SHIPROCKET") {
        const x = await api<{ url?: string; count: number }>("/api/shiprocket/docs", "POST", { kind, range, from, to, which });
        if (x.url) window.open(x.url, "_blank"); else alert(`${x.count} shipments`);
      } else {
        const x = await api<{ ids: number[] }>("/api/indiapost", "POST", { action: "print", range, from, to, which });
        if (!x.ids.length) alert("Kuch print karne ko nahi"); else window.open(`/crm/indiapost/receipts?ids=${x.ids.join(",")}`, "_blank");
      }
      r.refresh();
    } catch (e) { alert((e as Error).message); }
    setBusy(false);
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">{R.map(([k, l]) => <button key={k} className={`btn btn-sm ${range === k ? "!bg-slate-900 !text-white" : ""}`} onClick={() => setRange(k)}>{l}</button>)}
        {range === "custom" && <><input type="date" className="input !w-auto !py-1" value={from} onChange={(e) => setFrom(e.target.value)} /><input type="date" className="input !w-auto !py-1" value={to} onChange={(e) => setTo(e.target.value)} /></>}</div>
      <div className="flex flex-wrap gap-1">{[["pending", "Jo baaki hain"], ["done", carrier === "SHIPROCKET" ? "Jo nikal chuke" : "Jo chhap chuke"], ["both", "Dono"]].map(([k, l]) => <button key={k} className={`btn btn-sm ${which === k ? "!bg-slate-900 !text-white" : ""}`} onClick={() => setWhich(k)}>{l}</button>)}</div>
      <div className="flex flex-wrap gap-2">
        {carrier === "SHIPROCKET" ? <>
          <button className="btn-primary" disabled={busy} onClick={() => go("label")}>🖨 Labels nikalein</button>
          <button className="btn" disabled={busy} onClick={() => go("manifest")}>Manifest</button>
          <button className="btn" disabled={busy} onClick={() => go("pickup")}>Request Pickup</button>
        </> : <>
          <button className="btn-primary" disabled={busy} onClick={() => go("print")}>🖨 Receipts print karein</button>
          <button className="btn" onClick={async () => { const x = await api<{ count: number }>("/api/indiapost", "POST", { action: "unprint" }); alert(`${x.count} wapas 'baaki' me`); r.refresh(); }}>↩ Pichhla Receipt print wapas lo</button>
        </>}
      </div>
    </div>
  );
}

export function Backfill() {
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [dry, setDry] = useState(true);
  const [rows, setRows] = useState<{ orderNo: string; inCrm: boolean; awb?: string; status: string }[]>([]);
  async function go() { try { const x = await api<{ rows: typeof rows }>("/api/shiprocket/backfill", "POST", { from, to, dryRun: dry }); setRows(x.rows); } catch (e) { alert((e as Error).message); } }
  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <div><label className="label">From Date</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">To Date</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={dry} onChange={(e) => setDry(e.target.checked)} />Dry Run only</label>
        <button className="btn" onClick={go}>{dry ? "Preview Page 1" : "Import"}</button>
      </div>
      {rows.length > 0 && <table className="tbl mt-3"><thead><tr><th>Order</th><th>CRM me?</th><th>AWB</th><th>Status</th></tr></thead>
        <tbody>{rows.map((x) => <tr key={x.orderNo}><td>{x.orderNo}</td><td>{x.inCrm ? "✓" : "✗ panel se book"}</td><td>{x.awb}</td><td>{x.status}</td></tr>)}</tbody></table>}
    </div>
  );
}

function useIpPost() {
  const r = useRouter();
  return async (b: Record<string, unknown>) => {
    try { const x = await api<Record<string, unknown>>("/api/indiapost", "POST", b); alert(Object.entries(x).map(([k, v]) => `${k}: ${v}`).join("\n") || "OK"); r.refresh(); }
    catch (e) { alert((e as Error).message); }
  };
}

export function IpBarcodes() {
  const post = useIpPost(); const [text, setText] = useState("");
  return (
    <div className="space-y-2"><textarea className="input" rows={3} placeholder="Article numbers (EY123456789IN) — ek line me ek, ya comma se" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn-primary btn-sm" onClick={() => { post({ action: "barcodes.add", text }); setText(""); }}>Barcodes jodein</button></div>
  );
}

export function IpWallet() {
  const post = useIpPost(); const [amt, setAmt] = useState(""); const [note, setNote] = useState("");
  return (
    <div className="flex flex-wrap gap-2"><input className="input !w-32" type="number" placeholder="₹ amount" value={amt} onChange={(e) => setAmt(e.target.value)} />
      <input className="input !w-56" placeholder="note / UTR" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn btn-sm" onClick={() => { post({ action: "wallet.add", amount: amt, note }); setAmt(""); }}>Entry / Milan</button></div>
  );
}

export function IpCheque() {
  const post = useIpPost(); const [chq, setChq] = useState("");
  return (
    <div className="flex gap-2"><input className="input !w-40" type="number" placeholder="Cheque ₹" value={chq} onChange={(e) => setChq(e.target.value)} />
      <button className="btn btn-sm" onClick={() => { post({ action: "cheque", amount: chq, note: "COD cheque" }); setChq(""); }}>Cheque mila</button></div>
  );
}

export function IpTest() {
  const post = useIpPost();
  return <button className="btn btn-sm" onClick={() => post({ action: "test" })}>API jaanchein</button>;
}
