import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { fail, handle, ok } from "@/lib/api";

export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const me = await requireApi("notes.add");
  const { text } = await req.json();
  if (!String(text || "").trim()) return fail("Note khaali hai");
  const o = await prisma.order.findUniqueOrThrow({ where: { id: +params.id } });
  const n = await prisma.note.create({ data: { orderId: o.id, phone: o.phone, text: String(text).trim(), userId: me.id } });
  await prisma.order.update({ where: { id: o.id }, data: { lastHumanWorkAt: new Date() } });
  return ok(n, 201);
});
