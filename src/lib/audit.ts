import { headers } from "next/headers";
import { prisma } from "./db";

export function moduleOf(action: string) {
  if (action.startsWith("auth.") || action.startsWith("user.")) return "security";
  if (action.startsWith("shiprocket.") || action.startsWith("indiapost.") || action.startsWith("ndr.")) return "shipping";
  if (action.startsWith("settings.") || action.startsWith("master.")) return "settings";
  return "data";
}

export async function audit(userId: number | null, action: string, target?: string | null, meta?: unknown) {
  let ip: string | null = null;
  try { ip = headers().get("x-forwarded-for")?.split(",")[0] ?? null; } catch { /* outside request */ }
  await prisma.auditLog.create({
    data: { userId, action, module: moduleOf(action), target: target ?? null, meta: (meta ?? undefined) as never, ip },
  }).catch((e) => console.error("audit failed", e));
}
