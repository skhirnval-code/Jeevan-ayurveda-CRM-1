import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { can, canPage, type SessionUser } from "./permissions";

export const COOKIE = "crm_session";
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");

export async function signSession(userId: number, tokenVersion: number) {
  return new SignJWT({ uid: userId, tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as { uid: number; tv: number };
  } catch {
    return null;
  }
}

/** Current logged-in user (DB se fresh — Force Logout / deactivate turant lagta hai) */
export async function getUser(): Promise<(SessionUser & { username: string; email: string | null; workMode: string }) | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const p = await verifyToken(token);
  if (!p) return null;
  const u = await prisma.user.findUnique({ where: { id: p.uid } });
  if (!u || !u.active || u.tokenVersion !== p.tv) return null;
  return {
    id: u.id, name: u.name, role: u.role, username: u.username, email: u.email, workMode: u.workMode,
    permissions: (u.permissions as Record<string, boolean>) || {},
  };
}

/** Server page ke liye: login + page access check */
export async function requirePage(href: string) {
  const u = await getUser();
  if (!u) redirect("/login");
  if (!canPage(u, href)) redirect("/crm/no-access");
  return u;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** API route ke liye */
export async function requireApi(perm?: string) {
  const u = await getUser();
  if (!u) throw new HttpError(401, "Login zaroori hai");
  if (perm && !can(u, perm)) throw new HttpError(403, "Aapke paas is kaam ki permission nahi hai");
  return u;
}
