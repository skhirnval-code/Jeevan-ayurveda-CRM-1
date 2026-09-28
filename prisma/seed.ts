/**
 * Pehli baar setup: `npm run db:push && npm run db:seed`
 * SUPER_ADMIN login: env SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (default admin@example.com / Admin@12345)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_PRODUCTS, DEFAULT_SOURCES, STATUSES, STATES, REVENUE_STATUSES, TERMINAL_STATUSES } from "../src/lib/constants";

const prisma = new PrismaClient();

// Kuch sample districts (poori list apne hisaab se import karein)
const DISTRICTS: Record<string, string[]> = {
  Rajasthan: ["Ajmer", "Alwar", "Bikaner", "Jaipur", "Jodhpur", "Kota", "Nagaur", "Sikar", "Udaipur"],
  "Uttar Pradesh": ["Agra", "Aligarh", "Ghaziabad", "Kanpur Nagar", "Lucknow", "Meerut", "Moradabad", "Varanasi"],
  Haryana: ["Faridabad", "Gurugram", "Hisar", "Panipat", "Rewari", "Sonipat"],
  Delhi: ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "South Delhi", "West Delhi"],
  Maharashtra: ["Mumbai", "Nagpur", "Nashik", "Pune", "Aurangabad"],
};

async function main() {
  for (const [i, name] of STATUSES.entries()) {
    await prisma.statusMaster.upsert({ where: { name }, create: { name, sortOrder: i + 1, terminal: TERMINAL_STATUSES.includes(name), revenue: REVENUE_STATUSES.includes(name) }, update: {} });
  }
  for (const [i, name] of DEFAULT_SOURCES.entries()) await prisma.source.upsert({ where: { name }, create: { name, sortOrder: i }, update: {} });
  for (const name of DEFAULT_PRODUCTS) await prisma.product.upsert({ where: { name }, create: { name, price: 999 }, update: {} });
  for (const name of STATES) {
    const s = await prisma.state.upsert({ where: { name }, create: { name }, update: {} });
    for (const d of DISTRICTS[name] ?? []) await prisma.district.upsert({ where: { stateId_name: { stateId: s.id, name: d } }, create: { stateId: s.id, name: d }, update: {} });
  }
  for (const [status, afterDays] of [["Callback", 1], ["Pending", 2], ["Confirm Pending", 1], ["UNA", 1], ["Future Delivery", 7], ["NDR", 1]] as const) {
    await prisma.followupRule.upsert({ where: { status }, create: { status, afterDays }, update: {} });
  }
  const email = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const pw = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
  await prisma.user.upsert({
    where: { username: "admin" },
    create: { name: "Admin", username: "admin", email, role: "SUPER_ADMIN", passwordHash: await bcrypt.hash(pw, 10) },
    // RESET_ADMIN_PASSWORD=1 ho to har build par admin ka password SEED_ADMIN_PASSWORD par reset hoga
    update: process.env.RESET_ADMIN_PASSWORD === "1" ? { role: "SUPER_ADMIN", active: true, tokenVersion: { increment: 1 }, passwordHash: await bcrypt.hash(pw, 10) } : {},
  });
  console.log(`✓ Seed ho gaya. Login: ${email} / ${pw}  (turant password badlein)`);
}

main().finally(() => prisma.$disconnect());
