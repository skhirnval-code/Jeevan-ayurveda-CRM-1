import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, handle, num, ok, str } from "@/lib/api";

type Ctx = { params: { id: string } };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireApi("masters.edit");
  const b = await req.json();
  const value = str(b.value); if (!value) return fail("Value do");
  const t = await prisma.dealerTerritory.create({ data: { dealerId: +params.id, level: String(b.level || "CITY"), value: value.toUpperCase(), priority: num(b.priority, 1) } });
  await audit(me.id, "master.dealerTerritory.add", `${t.level}:${t.value}`);
  return ok(t, 201);
});

export const DELETE = handle(async (req: Request) => {
  const me = await requireApi("masters.edit");
  const tid = Number(new URL(req.url).searchParams.get("tid"));
  await prisma.dealerTerritory.delete({ where: { id: tid } });
  await audit(me.id, "master.dealerTerritory.delete", String(tid));
  return ok({ ok: true });
});
