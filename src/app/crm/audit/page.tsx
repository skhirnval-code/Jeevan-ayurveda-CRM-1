import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { fmtDateTime } from "@/lib/dates";
import { auditWhere } from "@/lib/auditWhere";
import { PageHead, qs, sp1, type SP } from "@/components/ui";

export default async function Audit({ searchParams: sp }: { searchParams: SP }) {
  await requirePage("/crm/audit");
  const f = Object.fromEntries(["module", "from", "to", "user", "action", "q", "page"].map((k) => [k, sp1(sp, k)]));
  const page = Math.max(1, +(f.page || 1));
  const where = auditWhere(f);
  const [rows, total, users, actions] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { user: { select: { name: true, role: true } } } }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    prisma.auditLog.groupBy({ by: ["action"], _count: true, orderBy: { _count: { action: "desc" } } }),
  ]);
  const TABS = [["", "All"], ["security", "Security"], ["data", "Data Changes"], ["shipping", "Shipping"], ["settings", "Settings"]];
  return (
    <div className="space-y-4">
      <PageHead title="Audit Logs" sub={`${total} entries`}><a className="btn" href={`/api/audit/export?${new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][])}`}>Export CSV</a></PageHead>
      <div className="flex flex-wrap gap-2">{TABS.map(([k, l]) => <Link key={k} href={qs("/crm/audit", sp, { module: k, page: null })} className={`btn btn-sm ${(f.module || "") === k ? "!bg-slate-900 !text-white" : ""}`}>{l}</Link>)}</div>
      <form className="card grid grid-cols-2 gap-3 md:grid-cols-6" action="/crm/audit">
        {f.module && <input type="hidden" name="module" value={f.module} />}
        <div><label className="label">From</label><input type="date" name="from" defaultValue={f.from} className="input" /></div>
        <div><label className="label">To</label><input type="date" name="to" defaultValue={f.to} className="input" /></div>
        <div><label className="label">User</label><select name="user" defaultValue={f.user} className="input"><option value="">All users</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}</select></div>
        <div><label className="label">Action</label><select name="action" defaultValue={f.action} className="input"><option value="">All actions</option>{actions.map((a) => <option key={a.action} value={a.action}>{a.action} ({a._count})</option>)}</select></div>
        <div><label className="label">Search</label><input name="q" defaultValue={f.q} className="input" placeholder="action / id..." /></div>
        <div className="flex items-end gap-2"><button className="btn-primary">Apply</button><Link href="/crm/audit" className="btn">Reset</Link></div>
      </form>
      <div className="card overflow-x-auto !p-0">
        <table className="tbl"><thead><tr><th>Time (IST)</th><th>User</th><th>Module</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td>{fmtDateTime(r.createdAt)}</td><td>{r.user?.name ?? "System"}</td><td>{r.module}</td><td className="font-mono text-xs">{r.action}</td><td>{r.target}</td>
            <td className="max-w-[320px] truncate text-xs text-slate-500" title={r.meta ? JSON.stringify(r.meta) : ""}>{r.meta ? JSON.stringify(r.meta) : ""}</td></tr>)}</tbody></table>
        <div className="flex justify-center gap-2 p-3">
          {page > 1 && <Link className="btn btn-sm" href={qs("/crm/audit", sp, { page: String(page - 1) })}>Prev</Link>}
          <span className="text-sm">{page} / {Math.max(1, Math.ceil(total / 50))}</span>
          {page * 50 < total && <Link className="btn btn-sm" href={qs("/crm/audit", sp, { page: String(page + 1) })}>Next</Link>}
        </div>
      </div>
    </div>
  );
}
