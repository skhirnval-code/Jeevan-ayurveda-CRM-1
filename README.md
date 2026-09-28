# Herbs CRM — Orders · Dealers · Couriers · Reports

Live CRM ke har page/option ko dekh kar banaya gaya clone. Poori feature list: **[FEATURES.md](FEATURES.md)**

**Stack:** Next.js 14 (App Router) · React 18 · Tailwind CSS · PostgreSQL · Prisma · JWT cookie auth

## 1. Setup (local)

```bash
# Node 18+ aur PostgreSQL 14+ chahiye
cp .env.example .env          # DATABASE_URL, JWT_SECRET waghera bharein
npm install
npm run db:push               # tables banayega (prisma/schema.prisma)
npm run db:seed               # statuses, sources, states, follow-up rules + SUPER_ADMIN
npm run dev                   # http://localhost:3000
```

Default login (seed): `admin@example.com` / `Admin@12345` — pehli login ke baad **🔑 Change Password** se badlein
(ya seed se pehle `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env set karein).

## 2. Production (VPS)

```bash
npm ci && npm run build
npm start                     # port 3000 — nginx se reverse proxy karein, HTTPS zaroori
```
PM2: `pm2 start npm --name crm -- start`

**Nightly backup (cron):**
```
0 8 * * * pg_dump "$DATABASE_URL" | gzip > /var/backups/crm/crm-$(date +\%F).sql.gz && ls -1t /var/backups/crm/*.gz | tail -n +15 | xargs -r rm
```

## 3. Folder structure

```
prisma/schema.prisma        # sabhi tables (User, Order, OrderHistory, Dealer, Ledger, Invoice, AuditLog, CallLog, Shiprocket...)
prisma/seed.ts              # master data + admin
src/middleware.ts           # /crm/* bina login ke /login par
src/lib/
  auth.ts                   # JWT session, requirePage / requireApi (permission check)
  permissions.ts            # sabhi permission keys, role defaults, sidebar NAV
  constants.ts              # statuses, sources, states, couriers, incentive rules
  orderFilters.ts           # Manage Orders ke sabhi filters -> Prisma where
  orders.ts                 # order update + history + follow-up rule + audit
  shipping.ts               # Shiprocket / India Post booking, tracking, webhook events
  shiprocket.ts             # Shiprocket API client (login, adhoc order, AWB, pickup, label, manifest, track, cancel)
  indiapost.ts              # India Post adapter (apne DoP contract ke hisaab se endpoints bharein)
  dealers.ts                # dealer ledger + cumulative report logic
  incentive.ts              # WFH / Office incentive formula
src/app/crm/...             # har page (dashboard, orders, dealers, reports, users, settings, system, audit, shiprocket, indiapost)
src/app/api/...             # REST APIs
src/components/...          # client components (OrdersClient, OrderForm, DealersClient, UsersClient, SettingsClient ...)
```

## 4. Webhooks / Integrations

| Kaam | Endpoint | Auth |
|---|---|---|
| Website/Shopify se naya order | `POST /api/ingest` | header `x-api-key: INGEST_TOKEN` |
| Shiprocket status webhook | `POST /api/delivery/notify` | header `x-api-key: SHIPROCKET_WEBHOOK_TOKEN` |
| India Post booking scan | `POST /api/delivery/postal/booking` | `x-api-key: INGEST_TOKEN` |
| India Post tracking events | `POST /api/delivery/postal/events` | `x-api-key: INGEST_TOKEN` |
| Airtel IQ call logs | `POST /api/calls/webhook` | `x-api-key: CALLS_WEBHOOK_TOKEN` |

`/api/ingest` body example:
```json
{ "storeKey": "mystore.com", "externalId": "1001", "name": "Ramesh", "phone": "9876543210",
  "product": "Sutra Gold+", "qty": 1, "total": 999, "online": 0,
  "address": "...", "pincode": "302001", "city": "Jaipur", "state": "Rajasthan" }
```
`storeKey` → **Settings › Store Mapping** se source apne aap lagta hai.

**Shiprocket:** Shiprocket panel → Settings → API → API user banayein → CRM ke **Shiprocket** page par "+ Add Account".
Pickup pincode ke liye `.env` me `PICKUP_PINCODE` set karein.

**India Post:** DoP ka API contract-specific hai. `src/lib/indiapost.ts` me `bookArticle / trackArticle / cancelArticle`
ke endpoint aur field names apne contract docs ke hisaab se bharein. Article numbers **India Post › Barcode Manager** me daalein.

## 5. Roles & Permissions

`SUPER_ADMIN` sab kuch. Baaki roles (MANAGER, ZM, AGENT, VIEWER, DEALER) ko role chunte hi default permissions milti hain,
jinhe **Users & Access › Manage Access** me har user ke liye alag se on/off kar sakte hain (page access bhi).
- AGENT: sirf apne (Lead Owner) orders — jab tak "See ALL agents orders" na mile
- ZM: apne dealers ke orders
- DEALER: sirf apne orders + apna ledger

## 6. Business rules (short)

- **Revenue statuses:** Delivered, GPO Delivered (deliveredAt set hota hai, Payment = Completed)
- **Follow-up:** status lagte hi Settings › Follow-up Rules se agli date; terminal status par band
- **Incentive:** WFH = online 15% + COD 10% · Office = ₹1000 tak 0, upar online 15% + (COD − 1000) ka 10% (Settings › CRM Preferences se badlein)
- **Dealer ledger:** delivered order = debit (total − dealer margin), payment = credit, invoice = debit
- Har badlav `OrderHistory` + `AuditLog` me jaata hai; delete = soft delete (Settings › Trash se restore)
