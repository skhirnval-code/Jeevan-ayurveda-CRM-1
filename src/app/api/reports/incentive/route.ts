import { requireApi } from "@/lib/auth";
import { incentiveData } from "@/lib/incentiveData";
import { handle } from "@/lib/api";

const csv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const h = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [h.join(","), ...rows.map((r) => h.map((k) => esc(r[k])).join(","))].join("\n");
};

export const GET = handle(async (req: Request) => {
  await requireApi("reports.incentive");
  const p = Object.fromEntries(new URL(req.url).searchParams);
  const d = await incentiveData(p);
  const body = p.format === "order" ? csv(d.orderRows) : csv(d.agents);
  return new Response(body, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="incentive-${p.format || "agent"}.csv"` } });
});
