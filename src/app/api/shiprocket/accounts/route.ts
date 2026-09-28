import { prisma } from "@/lib/db";
import { requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { testAccount } from "@/lib/shiprocket";
import { fail, handle, ok, str } from "@/lib/api";

/** body.action: create | update | delete | test | activate | sync */
export const POST = handle(async (req: Request) => {
  const me = await requireApi("page./crm/shiprocket");
  const b = await req.json();
  switch (b.action) {
    case "create": {
      if (!str(b.email) || !str(b.password)) return fail("API user email + password do");
      const count = await prisma.shiprocketAccount.count();
      const a = await prisma.shiprocketAccount.create({ data: { name: str(b.name) || "Shiprocket", email: String(b.email), password: String(b.password), pickupLocation: str(b.pickupLocation) || "Primary", sandbox: !!b.sandbox, active: count === 0 } });
      await audit(me.id, "shiprocket.account.create", a.name); return ok(a);
    }
    case "update": {
      const data: Record<string, unknown> = { name: str(b.name) ?? undefined, email: str(b.email) ?? undefined, pickupLocation: str(b.pickupLocation) ?? undefined, sandbox: !!b.sandbox, token: null };
      if (str(b.password)) data.password = b.password;
      await prisma.shiprocketAccount.update({ where: { id: +b.id }, data });
      await audit(me.id, "shiprocket.account.update", String(b.id)); return ok({ ok: true });
    }
    case "delete":
      await prisma.shiprocketAccount.delete({ where: { id: +b.id } });
      await audit(me.id, "shiprocket.account.delete", String(b.id)); return ok({ ok: true });
    case "activate":
      await prisma.$transaction([prisma.shiprocketAccount.updateMany({ data: { active: false } }), prisma.shiprocketAccount.update({ where: { id: +b.id }, data: { active: true } })]);
      await audit(me.id, "shiprocket.account.activate", String(b.id)); return ok({ ok: true });
    case "test": case "sync": {
      const r = await testAccount(+b.id);
      const locs = (r?.data?.shipping_address || []).map((x: { pickup_location: string; pin_code: string }) => `${x.pickup_location} (${x.pin_code})`);
      await audit(me.id, b.action === "test" ? "shiprocket.account.test" : "shiprocket.account.pickup", String(b.id));
      return ok({ ok: true, pickupLocations: locs });
    }
  }
  return fail("Unknown action");
});
