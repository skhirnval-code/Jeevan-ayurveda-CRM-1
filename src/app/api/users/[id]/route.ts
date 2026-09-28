import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, handle, ok, str } from "@/lib/api";

type Ctx = { params: { id: string } };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireApi("users.admin");
  const b = await req.json();
  const old = await prisma.user.findUniqueOrThrow({ where: { id: +params.id } });
  if (old.role === "SUPER_ADMIN" && me.role !== "SUPER_ADMIN") return fail("SUPER_ADMIN ko sirf SUPER_ADMIN badal sakta hai", 403);
  if (b.role === "SUPER_ADMIN" && me.role !== "SUPER_ADMIN") return fail("Permission nahi", 403);
  const data: Record<string, unknown> = {};
  for (const k of ["name", "phone", "extension"]) if (k in b) data[k] = str(b[k]);
  if ("email" in b) data.email = str(b.email)?.toLowerCase() ?? null;
  if ("role" in b) data.role = b.role;
  if ("active" in b) data.active = !!b.active;
  if ("permissions" in b) data.permissions = b.permissions;
  if ("workMode" in b) data.workMode = b.workMode;
  await prisma.user.update({ where: { id: old.id }, data });
  if ("role" in b && b.role !== old.role) await audit(me.id, "user.role_change", old.username, { from: old.role, to: b.role });
  if ("permissions" in b) await audit(me.id, "user.permission_change", old.username);
  if ("active" in b && !!b.active !== old.active) await audit(me.id, b.active ? "user.activate" : "user.deactivate", old.username);
  if ("extension" in b && b.extension !== old.extension) await audit(me.id, "user.extension_change", old.username);
  return ok({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const me = await requireApi("users.admin");
  const u = await prisma.user.findUniqueOrThrow({ where: { id: +params.id } });
  if (u.role === "SUPER_ADMIN") return fail("SUPER_ADMIN delete nahi ho sakta");
  if (u.id === me.id) return fail("Khud ko delete nahi kar sakte");
  const used = await prisma.order.count({ where: { leadOwnerId: u.id } });
  if (used) {
    // Orders se juda hai: history bachane ke liye sirf deactivate
    await prisma.user.update({ where: { id: u.id }, data: { active: false, tokenVersion: { increment: 1 } } });
    await audit(me.id, "user.deactivate", u.username, { reason: `${used} orders se juda` });
    return ok({ deactivated: true, message: `${used} orders se juda hai isliye deactivate kiya. Orders transfer karke phir delete karein.` });
  }
  await prisma.user.delete({ where: { id: u.id } });
  await audit(me.id, "user.delete", u.username);
  return ok({ deleted: true });
});
