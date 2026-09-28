import { prisma } from "@/lib/db";
import { HttpError, requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, handle, ok, str } from "@/lib/api";
import { can } from "@/lib/permissions";

export const GET = handle(async () => {
  await requireApi("settings.open");
  const [sources, stores, statuses, rules, settings, trash, counts] = await Promise.all([
    prisma.source.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.storeMapping.findMany({ include: { source: true } }),
    prisma.statusMaster.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.followupRule.findMany({ orderBy: { status: "asc" } }),
    prisma.setting.findMany(),
    prisma.order.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 200, select: { id: true, orderNo: true, customerName: true, phone: true, deletedAt: true, deletedReason: true } }),
    prisma.order.groupBy({ by: ["source"], _count: true, where: { deletedAt: null } }),
  ]);
  return ok({
    sources: sources.map((s) => ({ ...s, orders: counts.find((c) => c.source === s.name)?._count ?? 0 })),
    stores, statuses, rules, settings: Object.fromEntries(settings.map((s) => [s.key, s.value])), trash,
  });
});

export const POST = handle(async (req: Request) => {
  const me = await requireApi("settings.open");
  const b = await req.json();
  const need = (p: string) => { if (!can(me, p)) throw new HttpError(403, "Permission nahi hai"); };
  switch (b.action) {
    case "source.add": {
      need("settings.sources");
      const name = str(b.name); if (!name) return fail("Naam do");
      await prisma.source.upsert({ where: { name }, create: { name }, update: { active: true } });
      await audit(me.id, "master.source.add", name); break;
    }
    case "source.toggle": {
      need("settings.sources");
      const s = await prisma.source.update({ where: { id: +b.id }, data: { active: !!b.active } });
      await audit(me.id, "master.source.toggle", s.name, { active: s.active }); break;
    }
    case "source.merge": {
      need("settings.sources");
      const from = await prisma.source.findUniqueOrThrow({ where: { id: +b.from } });
      const to = await prisma.source.findUniqueOrThrow({ where: { id: +b.to } });
      if (from.id === to.id) return fail("Dono same hain");
      const r = await prisma.order.updateMany({ where: { source: from.name }, data: { source: to.name } });
      await prisma.storeMapping.updateMany({ where: { sourceId: from.id }, data: { sourceId: to.id } });
      await prisma.source.update({ where: { id: from.id }, data: { active: false } });
      await audit(me.id, "master.source.merge", `${from.name} -> ${to.name}`, { orders: r.count });
      return ok({ moved: r.count });
    }
    case "stores.save": {
      need("settings.storeMap");
      const rows: { storeKey: string; sourceId: number }[] = (b.rows || []).filter((r: { storeKey: string; sourceId: number }) => r.storeKey && r.sourceId);
      await prisma.$transaction([prisma.storeMapping.deleteMany({}), prisma.storeMapping.createMany({ data: rows.map((r) => ({ storeKey: r.storeKey.trim().toLowerCase(), sourceId: +r.sourceId })) })]);
      await audit(me.id, "settings.update", "store-mapping", { count: rows.length }); break;
    }
    case "status.save": {
      need("settings.statuses");
      const d = { color: b.color || "slate", terminal: !!b.terminal, revenue: !!b.revenue, sortOrder: +b.sortOrder || 0, active: b.active !== false };
      if (b.id) await prisma.statusMaster.update({ where: { id: +b.id }, data: d });
      else { const name = str(b.name); if (!name) return fail("Naam do"); await prisma.statusMaster.create({ data: { name, ...d } }); }
      await audit(me.id, "settings.update", "status", b); break;
    }
    case "rules.save": {
      need("settings.followup");
      const rows: { status: string; afterDays: number }[] = b.rows || [];
      await prisma.$transaction([prisma.followupRule.deleteMany({}), prisma.followupRule.createMany({ data: rows.filter((r) => r.status).map((r) => ({ status: r.status, afterDays: Math.max(0, +r.afterDays || 0) })) })]);
      await audit(me.id, "settings.update", "followup-rules"); break;
    }
    case "setting.save": {
      need(b.key?.startsWith("assign") ? "settings.prefs" : "settings.prefs");
      await prisma.setting.upsert({ where: { key: String(b.key) }, create: { key: String(b.key), value: b.value }, update: { value: b.value } });
      await audit(me.id, "settings.update", String(b.key)); break;
    }
    case "trash.restore": {
      need("settings.prefs");
      await prisma.order.update({ where: { id: +b.id }, data: { deletedAt: null, deletedReason: null } });
      await audit(me.id, "order.restore", String(b.id)); break;
    }
    case "trash.purge": {
      if (me.role !== "SUPER_ADMIN") return fail("Permanent delete sirf SUPER_ADMIN", 403);
      await prisma.order.delete({ where: { id: +b.id } });
      await audit(me.id, "order.purge", String(b.id)); break;
    }
    default: return fail("Unknown action");
  }
  return ok({ ok: true });
});
