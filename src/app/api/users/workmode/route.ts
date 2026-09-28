import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { handle, ok } from "@/lib/api";

export const POST = handle(async (req: Request) => {
  const me = await requireApi("reports.incentive");
  const { userId, mode } = await req.json();
  await prisma.user.update({ where: { id: +userId }, data: { workMode: mode === "WFH" ? "WFH" : "OFFICE" } });
  await audit(me.id, "user.update", String(userId), { workMode: mode });
  return ok({ ok: true });
});
