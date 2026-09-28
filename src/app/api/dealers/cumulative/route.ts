import { requireApi } from "@/lib/auth";
import { dealerCumulative } from "@/lib/dealers";
import { rangeOf } from "@/lib/dates";
import { handle } from "@/lib/api";

export const GET = handle(async (req: Request) => {
  const me = await requireApi("masters.view");
  const p = new URL(req.url).searchParams;
  const rows = await dealerCumulative(rangeOf(p.get("range") || "all", p.get("from"), p.get("to")), p.get("q"), me.role === "ZM" ? me.id : undefined);
  const h = ["Dealer", "Code", "Orders", "Qty", "Total Sale", "Commission", "Net Sale", "Paid", "Balance"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [h.join(","), ...rows.map((x) => [x.name, x.code, x.orders, x.qty, x.totalSale, x.commission, x.netSale, x.paid, x.balance].map(esc).join(","))].join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="dealer-cumulative.csv"' } });
});
