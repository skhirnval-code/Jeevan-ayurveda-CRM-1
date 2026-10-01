import Link from "next/link";

export type SP = Record<string, string | string[] | undefined>;
export const sp1 = (sp: SP, k: string) => { const v = sp[k]; return Array.isArray(v) ? v[0] : v; };

/** current searchParams me kuch keys badal kar naya href */
export function qs(base: string, sp: SP, patch: Record<string, string | null | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) { const x = Array.isArray(v) ? v[0] : v; if (x) u.set(k, x); }
  for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") u.delete(k); else u.set(k, v); }
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}

export function PageHead({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold">{title}</h1>{sub && <div className="text-sm text-slate-500">{sub}</div>}</div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon, tone = "slate", href }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: string; tone?: string; href?: string;
}) {
  const tones: Record<string, string> = {
    slate: "border-slate-200", green: "border-green-300", red: "border-red-300", blue: "border-blue-300",
    amber: "border-amber-300", violet: "border-violet-300", teal: "border-teal-300",
  };
  const body = (
    <div className={`card h-full border-l-4 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center justify-between text-slate-500"><span className="text-xl">{icon}</span>{href && <span>🔍</span>}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Delta({ now, prev }: { now: number; prev?: number | null }) {
  if (prev == null) return null;
  if (!prev) return <span className="text-xs text-slate-400">— vs prev</span>;
  const pct = ((now - prev) / prev) * 100;
  return <span className={`text-xs font-semibold ${pct >= 0 ? "text-green-600" : "text-red-600"}`}>{pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}% vs prev</span>;
}

export function RangeLinks({ base, sp, keyName = "range", options, withCustom = true }: {
  base: string; sp: SP; keyName?: string; options: { key: string; label: string }[]; withCustom?: boolean;
}) {
  const cur = sp1(sp, keyName) || options[0]?.key;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((o) => (
        <Link key={o.key} href={qs(base, sp, { [keyName]: o.key, from: null, to: null, page: null })}
          className={`btn btn-sm ${cur === o.key ? "!border-blue-600 !bg-blue-600 !text-white" : ""}`}>{o.label}</Link>
      ))}
      {withCustom && (
        <form className="flex items-center gap-1" action={base}>
          {Object.entries(sp).filter(([k]) => ![keyName, "from", "to", "page"].includes(k)).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={Array.isArray(v) ? v[0] : v ?? ""} />
          ))}
          <input type="hidden" name={keyName} value="custom" />
          <input type="date" name="from" defaultValue={sp1(sp, "from")} className="input !w-auto !py-1" />
          <span className="text-xs">to</span>
          <input type="date" name="to" defaultValue={sp1(sp, "to")} className="input !w-auto !py-1" />
          <button className="btn btn-sm">Go</button>
        </form>
      )}
    </div>
  );
}

export function Section({ title, children, right }: { title: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{title}</h2>{right}</div>
      {children}
    </section>
  );
}

export function Table({ head, rows, empty = "Koi record nahi" }: { head: React.ReactNode[]; rows: React.ReactNode[][]; empty?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={head.length} className="py-6 text-center text-slate-400">{empty}</td></tr>}
          {rows.map((r, i) => <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export function Bar({ label, value, max, right }: { label: string; value: number; max: number; right?: React.ReactNode }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-sm"><span>{label}</span><span className="font-semibold">{right ?? value}</span></div>
      <div className="h-2 rounded bg-slate-100 dark:bg-slate-700"><div className="h-2 rounded bg-blue-600" style={{ width: `${w}%` }} /></div>
    </div>
  );
}
