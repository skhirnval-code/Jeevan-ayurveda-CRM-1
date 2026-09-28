import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { handle, num, ok, str } from "@/lib/api";
import { pickDealer } from "@/lib/dealers";

type Ctx = { params: { id: string } };

export const GET = handle(async (_r: Request, { params }: Ctx) => {
  await requireApi("masters.view");
  return ok(await prisma.dealer.findUniqueOrThrow({ where: { id: +params.id }, include: { territories: true, zm: { select: { id: true, name: true } } } }));
});

/** Poora edit, ya sirf { zmId } / { active } */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireApi("masters.edit");
  const b = await req.json();
  const id = +params.id;
  let data: Record<string, unknown>;
  if (Object.keys(b).length <= 2 && ("zmId" in b || "active" in b)) {
    data = {};
    if ("zmId" in b) data.zmId = b.zmId ? num(b.zmId) : null;
    if ("active" in b) data.active = !!b.active;
  } else {
    data = { ...pickDealer(b), name: str(b.name) ?? undefined };
    if (str(b.code)) data.code = str(b.code);
  }
  const d = await prisma.dealer.update({ where: { id }, data });
  if ("active" in b && d.loginUserId) await prisma.user.update({ where: { id: d.loginUserId }, data: { active: !!b.active } });
  await audit(me.id, "master.dealer.update", d.code, Object.keys(data));
  return ok(d);
});
