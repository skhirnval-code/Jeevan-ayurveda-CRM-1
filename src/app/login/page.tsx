"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const r = useRouter();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, password: pw }) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(j.error || "Login fail");
    r.replace("/crm/dashboard");
    r.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-green-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <h1 className="text-xl font-bold">CRM Login</h1>
        <p className="mb-5 text-sm text-slate-500">Email / username aur password daalein</p>
        <label className="label">Email / Username</label>
        <input className="input mb-3" value={id} onChange={(e) => setId(e.target.value)} autoFocus required />
        <label className="label">Password</label>
        <input className="input mb-4" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "..." : "Login"}</button>
      </form>
    </div>
  );
}
