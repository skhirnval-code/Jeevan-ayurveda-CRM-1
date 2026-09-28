import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/api";

export const POST = handle(async (req: Request) => {
  const me = await requireApi();
  const { oldPassword, newPassword } = await req.json();
  if (!newPassword || String(newPassword).length < 8) return fail("Naya password kam se kam 8 characters ka ho");
  const u = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(String(oldPassword || ""), u.passwordHash))) {
    await audit(me.id, "auth.password_change_failed", u.username);
    return fail("Purana password galat hai");
  }
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  await audit(me.id, "user.password_change", u.username);
  return ok({ ok: true });
});
