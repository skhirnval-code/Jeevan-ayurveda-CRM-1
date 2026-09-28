"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { api } from "@/components/useMeta";

const FIELDS: { key: string; label: string; guess: RegExp }[] = [
  { key: "customerName", label: "Customer Name", guess: /name|customer|naam/i },
  { key: "phone", label: "Phone", guess: /phone|mobile|contact|number/i },
  { key: "altPhone", label: "Alt Phone", guess: /alt|alternate/i },
  { key: "product", label: "Product", guess: /product|item/i },
  { key: "qty", label: "Qty", guess: /qty|quantity/i },
  { key: "unitPrice", label: "Unit Price", guess: /price|rate/i },
  { key: "total", label: "Total", guess: /total|amount/i },
  { key: "online", label: "Online Paid", guess: /online|paid|prepaid/i },
  { key: "address", label: "Address", guess: /address|pata/i },
  { key: "pincode", label: "Pincode", guess: /pin/i },
  { key: "city", label: "City", guess: /city/i },
  { key: "district", label: "District", guess: /district/i },
  { key: "state", label: "State", guess: /state/i },
  { key: "source", label: "Source", guess: /source/i },
  { key: "status", label: "Status", guess: /status/i },
  { key: "remark", label: "Remark", guess: /remark|note/i },
  { key: "date", label: "Order Date", guess: /date/i },
];

/** Smart Import: file padho -> columns khud pehchano -> preview + edit -> import */
export default function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [cols, setCols] = useState<string[]>([]);
  const [raw, setRaw] = useState<Record<string, unknown>[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(f: File) {
    const wb = XLSX.read(await f.arrayBuffer());
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    const c = Object.keys(json[0] || {});
    const m: Record<string, string> = {};
    for (const fld of FIELDS) { const hit = c.find((x) => fld.guess.test(x) && !Object.values(m).includes(x)); if (hit) m[fld.key] = hit; }
    setCols(c); setRaw(json); setMap(m); build(json, m);
  }
  function build(json: Record<string, unknown>[], m: Record<string, string>) {
    setRows(json.map((r) => Object.fromEntries(FIELDS.map((f) => [f.key, m[f.key] ? String(r[m[f.key]] ?? "") : ""]))));
  }
  async function doImport() {
    setBusy(true);
    try {
      const r = await api<{ created: number; errors: string[] }>("/api/orders/import", "POST", { rows });
      setMsg(`${r.created} orders import hue. ${r.errors.length ? r.errors.slice(0, 10).join(", ") : ""}`);
      if (r.created) setTimeout(onDone, 1500);
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card max-h-[90vh] w-full max-w-6xl overflow-auto">
        <div className="mb-2 flex justify-between"><h3 className="font-bold">Smart Import (Excel / CSV)</h3><button className="btn btn-sm" onClick={onClose}>Close</button></div>
        <p className="mb-3 text-sm text-slate-500">Koi bhi Excel (.xlsx) ya CSV file chuniye. System khud columns pehchanega, phir aap poora data preview + edit karke import kar sakte hain.</p>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {cols.length > 0 && (
          <>
            <h4 className="mt-4 font-semibold">Column mapping</h4>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
              {FIELDS.map((f) => (
                <div key={f.key}><label className="label">{f.label}</label>
                  <select className="input" value={map[f.key] || ""} onChange={(e) => { const m = { ...map, [f.key]: e.target.value }; setMap(m); build(raw, m); }}>
                    <option value="">—</option>{cols.map((c) => <option key={c}>{c}</option>)}
                  </select></div>
              ))}
            </div>
            <h4 className="mt-4 font-semibold">Preview ({rows.length} rows) — cell edit kar sakte hain</h4>
            <div className="max-h-80 overflow-auto">
              <table className="tbl"><thead><tr>{FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead>
                <tbody>{rows.slice(0, 300).map((r, i) => (
                  <tr key={i}>{FIELDS.map((f) => (
                    <td key={f.key} className="!p-0"><input className="w-full bg-transparent px-2 py-1 text-xs" value={r[f.key]} onChange={(e) => { const n = [...rows]; n[i] = { ...r, [f.key]: e.target.value }; setRows(n); }} /></td>
                  ))}</tr>
                ))}</tbody></table>
            </div>
            {msg && <p className="mt-2 text-sm">{msg}</p>}
            <div className="mt-3 flex justify-end"><button className="btn-primary" disabled={busy} onClick={doImport}>{busy ? "Import ho raha hai..." : `Import ${rows.length} orders`}</button></div>
          </>
        )}
      </div>
    </div>
  );
}
