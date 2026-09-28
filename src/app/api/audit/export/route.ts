import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { auditWhere } from "@/lib/auditWhere";
import { canPage } from "@/lib/permissions";
import { fail, handle } from "@/lib/api";

export const GET = handle(async (req: Request) => {
  const me = await requireApi();
  if (!canPage(me, "/crm/audit")) return fail("Permission nahi", 403);
  const f = Object.fromEntries(new URL(req.url).searchParams);
  const rows = await prisma.auditLog.findMany({ where: auditWhere(f), orderBy: { createdAt: "desc" }, take: 50000, include: { user: { select: { name: true } } } });
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = ["time,user,module,action,target,meta", ...rows.map((r) => [r.createdAt.toISOString(), r.user?.name ?? "System", r.module, r.action, r.target, r.meta ? JSON.stringify(r.meta) : ""].map(esc).join(","))].join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="audit.csv"' } });
});
