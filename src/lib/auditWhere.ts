import type { Prisma } from "@prisma/client";
import { rangeOf } from "./dates";

export function auditWhere(sp: Record<string, string | undefined>): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (sp.module) and.push({ module: sp.module });
  if (sp.from || sp.to) and.push({ createdAt: rangeOf("custom", sp.from, sp.to) });
  if (sp.user) and.push({ userId: +sp.user });
  if (sp.action) and.push({ action: sp.action });
  if (sp.q) and.push({ OR: [{ action: { contains: sp.q } }, { target: { contains: sp.q, mode: "insensitive" } }] });
  return { AND: and };
}

