import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, handle, ok, str } from "@/lib/api";
import { ROLE_DEFAULTS } from "@/lib/permissions";

export const GET = handle(async () => {
  await requireApi("users.admin");
  const users = await prisma.user.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true, username: true, email: true, phone: true, role: true, active: true, permissions: true, workMode: true, extension: true, lastLoginAt: true } });
  return ok(users);
});

export const POST = handle(async (req: Request) => {
  const me = await requireApi("users.admin");
  const b = await req.json();
  const name = str(b.name);
  if (!name) return fail("Name zaroori hai");
  if (!b.password || String(b.password).length < 8) return fail("Password kam se kam 8 characters");
  if (b.role === "SUPER_ADMIN" && me.role !== "SUPER_ADMIN") return fail("SUPER_ADMIN sirf SUPER_ADMIN bana sakta hai", 403);
  let username = str(b.username)?.toLowerCase() || name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
  let i = 1; const base = username;
  while (await prisma.user.findUnique({ where: { username } })) username = `${base}${i++}`;
  const u = await prisma.user.create({
    data: {
      name, username, email: str(b.email)?.toLowerCase() ?? null, phone: str(b.phone), role: b.role || "AGENT",
      passwordHash: await bcrypt.hash(String(b.password), 10),
      permissions: b.permissions ?? ROLE_DEFAULTS[b.role || "AGENT"] ?? {},
    },
  });
  await audit(me.id, "user.create", u.username, { role: u.role });
  return ok({ id: u.id }, 201);
});
