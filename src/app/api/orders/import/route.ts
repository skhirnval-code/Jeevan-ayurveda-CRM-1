import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { computeAmounts, nextOrderNo } from "@/lib/orders";
import { audit } from "@/lib/audit";
import { fail, handle, num, ok, str } from "@/lib/api";

/** Smart Import: client ne columns map karke rows bheji hain (preview + edit ke baad) */
export const POST = handle(async (req: Request) => {
  const me = await requireApi("orders.import");
  const { rows } = await req.json();
  if (!Array.isArray(rows) || !rows.length) return fail("Koi row nahi");
  let created = 0; const errors: string[] = [];
  for (const [i, r] of rows.entries()) {
    const phone = String(r.phone || "").replace(/\D/g, "").slice(-10);
    if (!str(r.customerName) || phone.length !== 10) { errors.push(`Row ${i + 2}: naam/phone galat`); continue; }
    const amt = computeAmounts({ qty: num(r.qty, 1), unitPrice: num(r.unitPrice), total: num(r.total), online: num(r.online) });
    await prisma.order.create({
      data: {
        orderNo: await nextOrderNo(), customerName: String(r.customerName).trim(), phone, altPhone: str(r.altPhone),
        product: str(r.product) || "Other", ...amt, address: str(r.address), pincode: str(r.pincode), city: str(r.city),
        state: str(r.state), district: str(r.district), source: str(r.source) || "Orders", status: str(r.status) || "New", remark: str(r.remark),
        createdAt: r.date ? new Date(r.date) : undefined,
      },
    });
    created++;
  }
  await audit(me.id, "order.smartImport", `${created} orders`, { errors: errors.length });
  return ok({ created, errors });
});
