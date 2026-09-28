import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { dealerWhere } from "@/lib/dealers";
import { handle } from "@/lib/api";

export const GET = handle(async (req: Request) => {
  const me = await requireApi("masters.view");
  const p = new URL(req.url).searchParams;
  const rows = await prisma.dealer.findMany({ where: dealerWhere(p, me), orderBy: { name: "asc" }, include: { zm: { select: { name: true } } } });
  const data = rows.map((d) => ({
    "Dealer ID": d.code, Name: d.name, Firm: d.firmName, Contact: d.contactPerson, Mobile: d.mobile, "Alt Mobile": d.altMobile, Email: d.email,
    GST: d.gst, PAN: d.pan, Address: d.address, City: d.city, District: d.district, State: d.state, Pincode: d.pincode, Territory: d.territory,
    "Margin/order": d.defaultMargin, "Credit Limit": d.creditLimit, ZM: d.zm?.name ?? "", Status: d.active ? "Active" : "Disabled",
  }));
  const format = p.get("format");
  if (format === "csv") {
    const ws = XLSX.utils.json_to_sheet(data);
    return new Response(XLSX.utils.sheet_to_csv(ws), { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="dealers.csv"' } });
  }
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Dealers");
  return new Response(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="dealers.xlsx"' } });
});
