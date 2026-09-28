import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, handle, num, ok, str } from "@/lib/api";
import { ROLE_DEFAULTS } from "@/lib/permissions";
import { dealerWhere, nextDealerCode, pickDealer } from "@/lib/dealers";

export const GET = handle(async (req: Request) => {
  const me = await requireApi("masters.view");
  const p = new URL(req.url).searchParams;
  const size = Math.min(1000, num(p.get("size"), 25)); const page = Math.max(1, num(p.get("page"), 1));
  const where = dealerWhere(p, me);
  const sort = p.get("sort") === "desc" ? "desc" : "asc";
  const [rows, total, facets, territories] = await Promise.all([
    prisma.dealer.findMany({ where, orderBy: { name: sort }, skip: (page - 1) * size, take: size, include: { zm: { select: { id: true, name: true } }, loginUser: { select: { username: true } } } }),
    prisma.dealer.count({ where }),
    prisma.dealer.findMany({ select: { state: true, district: true, city: true, territory: true } }),
    prisma.dealerTerritory.findMany({ include: { dealer: { select: { name: true, code: true } } }, orderBy: [{ value: "asc" }, { priority: "asc" }] }),
  ]);
  const uniq = (k: "state" | "district" | "city" | "territory") => [...new Set(facets.map((f) => f[k]).filter(Boolean))].sort() as string[];
  return ok({ rows, total, page, size, facets: { states: uniq("state"), districts: uniq("district"), cities: uniq("city"), territories: uniq("territory") }, territories });
});

export const POST = handle(async (req: Request) => {
  const me = await requireApi("masters.edit");
  const b = await req.json();
  const name = str(b.name); if (!name) return fail("Dealer Name zaroori hai");
  const code = str(b.code) || (await nextDealerCode());
  if (await prisma.dealer.findUnique({ where: { code } })) return fail("Dealer ID pehle se hai");
  let loginUserId: number | null = null; let tempPw: string | null = null;
  if (b.createLogin) {
    const email = str(b.loginEmail || b.email)?.toLowerCase();
    if (!email) return fail("Login ke liye email do");
    tempPw = str(b.password) || Math.random().toString(36).slice(2, 10) + "A1";
    const username = str(b.username)?.toLowerCase() || name.toLowerCase().replace(/[^a-z0-9]+/g, ".");
    const u = await prisma.user.create({ data: { name, username, email, role: "DEALER", passwordHash: await bcrypt.hash(tempPw, 10), permissions: ROLE_DEFAULTS.DEALER } });
    loginUserId = u.id;
  }
  const d = await prisma.dealer.create({ data: { ...pickDealer(b), name, code, loginUserId } });
  await audit(me.id, "master.dealer.add", d.code);
  return ok({ id: d.id, code: d.code, tempPassword: tempPw }, 201);
});

