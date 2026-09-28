import type { Order } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError, requireApi } from "@/lib/auth";
import { updateOrder } from "@/lib/orders";
import { audit } from "@/lib/audit";
import { handle, num, ok, str } from "@/lib/api";
import { can } from "@/lib/permissions";

type Ctx = { params: { id: string } };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const me = await requireApi("orders.view");
  const o = await prisma.order.findUnique({
    where: { id: +params.id },
    include: {
      leadOwner: { select: { id: true, name: true } }, dealer: true,
      history: { orderBy: { createdAt: "desc" }, take: 100 },
      calls: { orderBy: { startedAt: "desc" }, take: 20 },
    },
  });
  if (!o || o.deletedAt) throw new HttpError(404, "Order nahi mila");
  if (!can(me, "orders.viewAll") && o.leadOwnerId !== me.id && me.role !== "DEALER") throw new HttpError(403, "Ye order aapka nahi hai");
  const notes = can(me, "notes.view")
    ? await prisma.note.findMany({ where: { phone: o.phone }, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } })
    : [];
  const previous = await prisma.order.findMany({
    where: { phone: o.phone, id: { not: o.id }, deletedAt: null }, select: { id: true, orderNo: true, status: true, total: true, createdAt: true }, orderBy: { createdAt: "desc" },
  });
  return ok({ ...o, notes, previous });
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireApi("orders.edit");
  const b = await req.json();
  const patch: Partial<Order> = {};
  const strs = ["customerName", "altPhone", "email", "product", "extra", "paymentMode", "paymentStatus", "address", "pincode", "city", "state", "district", "source", "status", "remark", "courier", "awb"] as const;
  for (const k of strs) if (k in b) (patch as Record<string, unknown>)[k] = k === "status" || k === "customerName" || k === "product" || k === "source" ? String(b[k]) : str(b[k]);
  if ("phone" in b) patch.phone = String(b.phone).replace(/\D/g, "").slice(-10);
  for (const k of ["qty", "unitPrice", "total", "online"] as const) if (k in b) patch[k] = num(b[k]);
  if ("followupAt" in b) patch.followupAt = b.followupAt ? new Date(b.followupAt) : null;
  if ("leadOwnerId" in b) patch.leadOwnerId = b.leadOwnerId ? num(b.leadOwnerId) : null;
  if ("dealerId" in b) patch.dealerId = b.dealerId ? num(b.dealerId) : null;
  const o = await updateOrder(+params.id, patch, me);
  return ok(o);
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireApi("orders.delete");
  const reason = new URL(req.url).searchParams.get("reason") || null;
  const o = await prisma.order.update({ where: { id: +params.id }, data: { deletedAt: new Date(), deletedReason: reason } });
  await audit(me.id, "order.delete", o.orderNo, { reason });
  return ok({ ok: true });
});
