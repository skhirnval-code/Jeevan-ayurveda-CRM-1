"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { href?: string; label: string; icon?: string; children?: { href: string; label: string }[] };

export default function Shell({ brand, user, nav, children }: {
  brand: string; user: { name: string; role: string }; nav: Item[]; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [dealerOpen, setDealerOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pinned, setPinned] = useState(true);
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    try { if (localStorage.getItem("sidebarPinned") === "0") setPinned(false); } catch { /* ignore */ }
  }, []);
  function togglePin() {
    const p = !pinned; setPinned(p); setOpen(false);
    try { localStorage.setItem("sidebarPinned", p ? "1" : "0"); } catch { /* ignore */ }
  }
  useEffect(() => { setOpen(false); if (path.startsWith("/crm/dealers")) setDealerOpen(true); }, [path]);

  function toggleDark() {
    const d = !dark; setDark(d);
    document.documentElement.classList.toggle("dark", d);
    try { localStorage.setItem("theme", d ? "dark" : "light"); } catch { /* ignore */ }
  }
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }
  const active = (h: string) => path === h || (h !== "/crm/reports" && h !== "/crm/dealers" && path.startsWith(h + "/"));

  return (
    <div className="min-h-screen">
      <header className={`no-print sticky top-0 z-30 flex h-14 items-center gap-3 bg-slate-900 px-4 text-white shadow ${pinned ? "lg:pl-[19rem]" : ""}`}>
        <button aria-label="Open menu" onClick={() => setOpen(true)} className={`text-2xl leading-none ${pinned ? "lg:hidden" : ""}`}>☰</button>
        <span className="font-bold">{brand} CRM</span>
      </header>

      {open && <div className={`no-print fixed inset-0 z-40 bg-black/40 ${pinned ? "lg:hidden" : ""}`} onClick={() => setOpen(false)} />}
      <aside className={`no-print fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-900 text-slate-200 transition-transform ${open ? "translate-x-0" : "-translate-x-full"} ${pinned ? "lg:translate-x-0" : ""}`}>
        <div className="flex items-center justify-between p-4">
          <div><div className="text-lg font-bold text-white">{brand}</div><div className="text-xs text-green-400">CRM - Pure Ayurveda</div></div>
          <div className="flex items-center gap-2">
            <button aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"} title={pinned ? "Unpin" : "Pin"} onClick={togglePin} className={`hidden rounded-lg px-2 py-1 text-base lg:block ${pinned ? "bg-green-700 text-white" : "hover:bg-slate-800"}`}>📌</button>
            <button aria-label="Close menu" onClick={() => setOpen(false)} className={`text-xl ${pinned ? "lg:hidden" : ""}`}>✕</button>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {nav.map((it) => it.children ? (
            <div key={it.label}>
              <button onClick={() => setDealerOpen(!dealerOpen)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-800">
                <span>{it.icon}</span><span className="flex-1">{it.label}</span><span>{dealerOpen ? "▾" : "›"}</span>
              </button>
              {dealerOpen && <div className="ml-8 space-y-1 border-l border-slate-700 pl-2">
                {it.children.map((c) => (
                  <Link key={c.href} href={c.href} className={`block rounded-lg px-3 py-2 text-sm hover:bg-slate-800 ${path === c.href ? "bg-slate-800 text-white" : ""}`}>{c.label}</Link>
                ))}
              </div>}
            </div>
          ) : (
            <Link key={it.href} href={it.href!} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-800 ${active(it.href!) ? "border-l-4 border-green-500 bg-slate-800 font-semibold text-white" : ""}`}>
              <span>{it.icon}</span>{it.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 border-t border-slate-800 p-3">
          <div className="flex items-center gap-3 px-1 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-600 font-bold text-white">{user.name[0]?.toUpperCase()}</div>
            <div><div className="font-semibold text-white">{user.name}</div><div className="text-xs text-green-400">{user.role}</div></div>
          </div>
          <button onClick={toggleDark} className="w-full rounded-lg bg-slate-800 py-2 text-sm">{dark ? "☀️ Light Mode" : "🌙 Dark Mode"}</button>
          <button onClick={() => setPwOpen(true)} className="w-full rounded-lg bg-slate-800 py-2 text-sm">🔑 Change Password</button>
          <button onClick={signOut} className="w-full rounded-lg bg-slate-800 py-2 text-sm text-red-300">Sign Out</button>
        </div>
      </aside>

      {pwOpen && <ChangePassword onClose={() => setPwOpen(false)} />}
      <div className={pinned ? "lg:pl-72" : ""}>
        <main className="mx-auto max-w-[1600px] p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

function ChangePassword({ onClose }: { onClose: () => void }) {
  const [o, setO] = useState(""); const [n, setN] = useState(""); const [msg, setMsg] = useState("");
  async function save() {
    const r = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oldPassword: o, newPassword: n }) });
    const j = await r.json();
    setMsg(r.ok ? "Password badal gaya ✓" : j.error);
    if (r.ok) setTimeout(onClose, 800);
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-sm">
        <h3 className="mb-3 font-bold">🔑 Change Password</h3>
        <label className="label">Purana password</label><input type="password" className="input mb-2" value={o} onChange={(e) => setO(e.target.value)} />
        <label className="label">Naya password (min 8)</label><input type="password" className="input mb-3" value={n} onChange={(e) => setN(e.target.value)} />
        {msg && <p className="mb-2 text-sm">{msg}</p>}
        <div className="flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></div>
      </div>
    </div>
  );
}
