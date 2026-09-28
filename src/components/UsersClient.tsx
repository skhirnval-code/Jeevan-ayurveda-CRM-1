"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/useMeta";
import { PERM_GROUPS, ROLE_DEFAULTS } from "@/lib/permissions";

type U = { id: number; name: string; username: string; email: string | null; phone: string | null; role: string; active: boolean; permissions: Record<string, boolean>; extension: string | null; workMode: string };
const ROLES = ["MANAGER", "ZM", "AGENT", "VIEWER", "DEALER"];

export default function UsersClient({ isSuper }: { isSuper: boolean }) {
  const [users, setUsers] = useState<U[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<U | "new" | null>(null);
  const load = () => api<U[]>("/api/users").then(setUsers);
  useEffect(() => { load(); }, []);

  async function act(u: U, action: string) {
    try {
      if (action === "reset") {
        const pw = prompt(`${u.name} ka naya password (khaali = auto)`) ?? null;
        if (pw === null) return;
        const r = await api<{ password: string }>(`/api/users/${u.id}/action`, "POST", { action: "reset_password", password: pw || undefined });
        alert(`Naya password: ${r.password}`);
      } else if (action === "logout") {
        await api(`/api/users/${u.id}/action`, "POST", { action: "force_logout" }); alert("Logout kar diya");
      } else if (action === "delete") {
        if (!confirm(`${u.name} ko delete karein?`)) return;
        const r = await api<{ message?: string }>(`/api/users/${u.id}`, "DELETE"); if (r.message) alert(r.message);
      }
      load();
    } catch (e) { alert((e as Error).message); }
  }

  if (edit) return <UserEditor user={edit === "new" ? null : edit} users={users} isSuper={isSuper} onBack={() => { setEdit(null); load(); }} />;
  const list = users.filter((u) => !q || `${u.name} ${u.username} ${u.email} ${u.phone}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-2xl font-bold">Users &amp; Access</h1><p className="text-sm text-slate-500">Create users and grant each one specific access.</p></div>
        <button className="btn-primary" onClick={() => setEdit("new")}>+ New User</button>
      </div>
      <input className="input mb-3 max-w-md" placeholder="🔍  Search: naam, mobile, login..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card overflow-x-auto !p-0">
        <table className="tbl"><thead><tr>{["User ID", "Name", "Username", "Email", "Role", "Status", "Access"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{list.map((u) => (
            <tr key={u.id}>
              <td>PH{String(u.id).padStart(3, "0")}</td><td className="font-medium">{u.name}</td><td>{u.username}</td><td>{u.email ?? "-"}</td>
              <td><span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold dark:bg-slate-700">{u.role}</span></td>
              <td>{u.active ? <span className="text-green-600">Active</span> : <span className="text-red-600">Disabled</span>}</td>
              <td>{u.role === "SUPER_ADMIN" ? "Super Admin" : (
                <div className="flex gap-1">
                  <button className="btn btn-sm" onClick={() => setEdit(u)}>Manage Access</button>
                  <button className="btn btn-sm" onClick={() => act(u, "reset")}>Reset Password</button>
                  <button className="btn btn-sm" onClick={() => act(u, "logout")}>Force Logout</button>
                  <button className="btn btn-sm !text-red-600" onClick={() => act(u, "delete")}>Delete</button>
                </div>)}</td>
            </tr>))}</tbody></table>
      </div>
    </div>
  );
}

function UserEditor({ user, users, isSuper, onBack }: { user: U | null; users: U[]; isSuper: boolean; onBack: () => void }) {
  const [f, setF] = useState({ name: user?.name ?? "", phone: user?.phone ?? "", email: user?.email ?? "", username: user?.username ?? "", password: "", role: user?.role ?? "AGENT", extension: user?.extension ?? "", active: user?.active ?? true, workMode: user?.workMode ?? "OFFICE" });
  const [perms, setPerms] = useState<Record<string, boolean>>(user?.permissions ?? ROLE_DEFAULTS.AGENT);
  const [transferTo, setTransferTo] = useState("");
  const [msg, setMsg] = useState("");
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    try {
      if (user) await api(`/api/users/${user.id}`, "PUT", { ...f, permissions: perms });
      else await api("/api/users", "POST", { ...f, permissions: perms });
      onBack();
    } catch (e) { setMsg((e as Error).message); }
  }
  return (
    <div>
      <div className="mb-4 flex items-center gap-3"><button className="btn" onClick={onBack}>← Back</button>
        <div><h1 className="text-xl font-bold">{user ? `Manage Access — ${user.name}` : "New User"}</h1><p className="text-sm text-slate-500">{user ? "Role, access aur details badlein." : "Naya user banao aur uska access set karo."}</p></div></div>
      <div className="card mb-4 grid gap-3 md:grid-cols-2">
        <div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div><label className="label">Email (login id)</label><input className="input" placeholder="naam@company.in" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        {!user && <div><label className="label">Username (khaali = auto)</label><input className="input" autoComplete="off" placeholder="khaali chhodein to naam se auto" value={f.username} onChange={(e) => set("username", e.target.value)} /></div>}
        {!user && <div><label className="label">Password</label><input className="input" type="password" autoComplete="new-password" placeholder="min 8 chars" value={f.password} onChange={(e) => set("password", e.target.value)} /></div>}
        <div><label className="label">Role (sets defaults)</label>
          <select className="input" value={f.role} onChange={(e) => { set("role", e.target.value); setPerms(ROLE_DEFAULTS[e.target.value] ?? {}); }}>
            {(isSuper ? ["SUPER_ADMIN", ...ROLES] : ROLES).map((r) => <option key={r}>{r}</option>)}</select></div>
        <div><label className="label">Airtel IQ Extension</label><input className="input" value={f.extension} onChange={(e) => set("extension", e.target.value)} /></div>
        <div><label className="label">Incentive tarika</label><select className="input" value={f.workMode} onChange={(e) => set("workMode", e.target.value)}><option value="OFFICE">🏢 Office</option><option value="WFH">🏠 Work From Home</option></select></div>
        {user && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Active</label>}
      </div>
      <h3 className="mb-2 font-semibold">Module Access</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {PERM_GROUPS.map((g) => (
          <div key={g.title} className="card">
            <div className="mb-2 flex justify-between"><b>{g.title}</b>
              <button className="text-xs text-blue-600" onClick={() => { const all = g.items.every((i) => perms[i.key]); setPerms({ ...perms, ...Object.fromEntries(g.items.map((i) => [i.key, !all])) }); }}>Sab / Koi nahi</button></div>
            {g.items.map((i) => (
              <label key={i.key} className="flex items-center gap-2 py-0.5 text-sm"><input type="checkbox" checked={!!perms[i.key]} onChange={(e) => setPerms({ ...perms, [i.key]: e.target.checked })} />{i.label}</label>
            ))}
          </div>
        ))}
      </div>
      {user && (
        <div className="card mt-4 flex flex-wrap items-end gap-2"><div><label className="label">Is user ke sabhi orders transfer karein</label>
          <select className="input" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}><option value="">Unassign (pool me)</option>{users.filter((u) => u.id !== user.id && u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <button className="btn" onClick={async () => { if (!confirm("Transfer karein?")) return; const r = await api<{ count: number }>(`/api/users/${user.id}/action`, "POST", { action: "transfer_orders", toUserId: transferTo || null }); alert(`${r.count} orders transfer hue`); }}>Transfer Orders</button></div>
      )}
      {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
      <div className="mt-4 flex justify-end gap-2"><button className="btn" onClick={onBack}>Cancel</button><button className="btn-primary" onClick={save}>Save User</button></div>
    </div>
  );
}
