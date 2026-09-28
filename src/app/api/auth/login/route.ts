import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { COOKIE, signSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, handle, ok } from "@/lib/api";

export const POST = handle(async (req: Request) => {
  const { id, password } = await req.json();
  const login = String(id || "").trim().toLowerCase();
  const u = await prisma.user.findFirst({ where: { OR: [{ email: login }, { username: login }] } });
  if (!u || !u.active || !(await bcrypt.compare(String(password || ""), u.passwordHash))) {
    await audit(u?.id ?? null, "auth.login_failed", login);
    return fail("Galat email/username ya password", 401);
  }
  const token = await signSession(u.id, u.tokenVersion);
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 86400 });
  await prisma.user.update({ where: { id: u.id }, data: { lastLoginAt: new Date() } });
  await audit(u.id, "auth.login", u.username);
  return ok({ ok: true });
});
