import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/api";

/** body: { action: "reset_password" | "force_logout" | "transfer_orders", password?, toUserId? } */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const me = await requireApi("users.admin");
  const b = await req.json();
  const u = await prisma.user.findUniqueOrThrow({ where: { id: +params.id } });
  if (b.action === "reset_password") {
    const pw = String(b.password || Math.random().toString(36).slice(2, 10) + "A1");
    if (pw.length < 8) return fail("Password min 8 chars");
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(pw, 10), tokenVersion: { increment: 1 } } });
    await audit(me.id, "user.password_reset", u.username);
    return ok({ password: pw });
  }
  if (b.action === "force_logout") {
    await prisma.user.update({ where: { id: u.id }, data: { tokenVersion: { increment: 1 } } });
    await audit(me.id, "user.force_logout", u.username);
    return ok({ ok: true });
  }
  if (b.action === "transfer_orders") {
    const to = Number(b.toUserId) || null;
    const r = await prisma.order.updateMany({ where: { leadOwnerId: u.id, deletedAt: null }, data: { leadOwnerId: to, agentAssignedAt: to ? new Date() : null } });
    await audit(me.id, "user.transfer_orders", u.username, { to, count: r.count });
    return ok({ count: r.count });
  }
  return fail("Unknown action");
});
