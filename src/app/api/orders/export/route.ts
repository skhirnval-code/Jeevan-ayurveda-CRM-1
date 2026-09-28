import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { buildOrderWhere } from "@/lib/orderFilters";
import { audit } from "@/lib/audit";
import { handle } from "@/lib/api";

export const GET = handle(async (req: Request) => {
  const me = await requireApi("orders.export");
  const p = new URL(req.url).searchParams;
  const ids = p.get("ids");
  const where = ids ? { id: { in: ids.split(",").map(Number) }, deletedAt: null } : buildOrderWhere(p, me);
  const rows = await prisma.order.findMany({
    where, orderBy: { createdAt: "desc" }, take: 50000,
    include: { leadOwner: { select: { name: true } }, dealer: { select: { name: true, code: true } } },
  });
  const data = rows.map((o) => ({
    "Order ID": o.orderNo, Date: o.createdAt.toISOString(), Customer: o.customerName, Phone: o.phone, "Alt Phone": o.altPhone,
    Product: o.product, Extra: o.extra, Qty: o.qty, "Unit Price": o.unitPrice, Total: o.total, Online: o.online, Balance: o.balance,
    Status: o.status, "Payment Mode": o.paymentMode, Payment: o.paymentStatus, Source: o.source, Address: o.address, City: o.city,
    District: o.district, State: o.state, Pincode: o.pincode, "Follow-up": o.followupAt?.toISOString() ?? "",
    "Lead Owner": o.leadOwner?.name ?? "", Dealer: o.dealer ? `${o.dealer.name} (${o.dealer.code})` : "",
    Courier: o.courier, AWB: o.awb, Shipping: o.shipStatus, Remark: o.remark,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Orders");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  await audit(me.id, "order.export", `${rows.length} rows`);
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="orders-${Date.now()}.xlsx"`,
    },
  });
});
