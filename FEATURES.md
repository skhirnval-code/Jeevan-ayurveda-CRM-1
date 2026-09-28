# CRM — Poori Feature List (har page, har option)

Ye file live CRM (`/crm/*`) ke har page ko dekh kar banayi gayi hai. Is repo ka code isi list ko follow karta hai.
Tech (original jaisa hi): **Next.js 14 (App Router) + Tailwind CSS + PostgreSQL** (yahan Prisma ORM).

Roles: `SUPER_ADMIN`, `MANAGER`, `ZM` (Zone Manager), `AGENT`, `VIEWER`, `DEALER`

---

## 0. Layout (sabhi pages par)
- Top bar: hamburger (Open/Close menu) + "CRM" title
- Sidebar: Brand + tagline, menu links (permission ke hisaab se dikhte hain)
  - Dashboard, Manage Orders
  - **Dealer Management** (collapsible): Manage Dealer, Payment Ledger, Dealer Cumulative Report, Manage Invoice
  - Reports, Sales Report, Incentive, Courier Performance, Call Monitoring
  - Users & Access, Settings, System Health, Audit Logs, Shiprocket, India Post
- Neeche: user avatar + naam + role, **Dark Mode** toggle, **🔑 Change Password**, **Sign Out**

## 1. Dashboard (`/crm/dashboard`)
- Date range dikhata hai (from – to), **Open Orders →** link
- Range buttons: Today, Yesterday, 3 Days, 7 Days, 15 Days, 30 Days, This Month, Last Month, Custom
- "Numbers based on": **[D] Order Date** / **[S] Status Change Date**
- Alert strips: "Aaj X follow-up karne hain", "X Overdue follow-up — abhi call karein", "Kal X follow-up" (click → Orders filtered)
- KPI cards (har card par 🔍 = orders list khole, ▲▼ % vs previous period):
  Orders, Leads, Revenue, Online Received, COD Pending (delivered/cancel alag), Confirmed (% of total), Pending, Pipeline Value,
  Delivered (Total), Cancelled, Callback, New Customers, Repeat Customers, Follow-ups Today, Delivered, GPO Delivered, In Transit, GPO Done…
- Sections: **Order Status** (status-wise count), **Top Sources**, **Top Products**, **Top States**, **Payment Analysis** (Online / COD Pending / COD count)
- **Agent Status Breakdown**: filters (Today/Yesterday/Last 7/Last 30/All Time/Custom), Status, Agent → table Agent × har status
- **Recent Orders** (naam, order id, time, status, amount → order page)
- **Follow-ups Due Today (N)**: har row par Call (tel:) + WA (WhatsApp) link

## 2. Manage Orders (`/crm/orders`)
Header: "Manage Orders · N orders", buttons **Hide/Show Filters, Export, Bulk Upload, + New Order**

**Status tabs (count ke saath, horizontal scroll):** 🔥 Action Required, 📅 Tomorrow | All, New, Callback, Pending, Confirmed, In Transit, GPO, GPO Portal, GPO Done, Delivered, Future Delivery, UNA, Cancel pending …

**Work chips (tooltip ke saath):** Assigned Today (naye + dubara), Pool Remaining, Worked Today, Sutra (unassigned product pool), Nasha (unassigned), ♻️ Recycled New, Due Today, Overdue, Future Followups

**Top row:** Date (All Time/Today/Yesterday/Last 7/15/30 Days/This Month/Last Month), Quick Filters, Post Office, Shipment + 3 money cards: **ONLINE, COD, INCENTIVE**
- Quick Filters: Unassigned, Pending Followups, Online Paid, Confirmed, GPO Done (Booked), Delivered, High Value
- Post Office (India Post status): Action Required, Item Booked, Item Received, Item bagged, Bag Received, Item Dispatched, Item received at Destination, Item Invoiced to BO, Taken out for delivery, Item Delivered(Addressee), Item Kept on Hold, Item Redirected, Item Returned to Sender, RTO In Transit, RTO Out for Delivery, Portal file ka intezaar, Portal Pending, Bag Received for Forward
- Shipment (Shiprocket status): Action Required, AWB Assigned, Pickup Scheduled, In Transit, Out For Delivery, Delivered, NDR, RTO Initiated, RTO Delivered, Lost, Cancelled, Label Pending, Manifest Pending

**Advanced filters:** Status, Source, Payment (Pending/Completed), State, District (state par depend), Pincode, Phone, Order ID, AWB / Article No., Courier (India Post sabhi / Shiprocket sabhi / har courier), Customer, City, Product, Lead Owner (Unassigned + agents), Dealer, Dealer assignment (Assigned / Unassigned-coverage me), ZM,
date ranges: Order date, Booked date, Follow-up, Agent assign, Dealer assign, Status changed; "Status changed = (kaun-sa)", "Status badla kisne" (Kisi aur ne / Lead Owner ne khud / Webhook-Courier ne / specific user), button **Aaj jin par kaam hua**, **Clear**

**Table columns:** ☐, Order ID, Date, Customer (+Lead badge), Phone, Product, Qty, Amount, Total, Online, Balance, Status (inline dropdown), Payment, Source, City, State, District, Pincode, Address, Follow-up, Lead Owner, Agent Assign, Dealer, Dealer Assign, ZM, AWB, Shipping, Remark, Actions (WA, Edit, Inv, Del, 📦 Book with Shiprocket, 📮 India Post)
Pagination: page size 5/10/20/50/100/200/500, ← Prev, Go to page, Next →

**Bulk actions (rows select karne par):** Select all N matching, Set status + remark → Apply status, ♻️ Recycle to New, Change Lead Owner (Unassign/agent) → Set Lead Owner, Dealer → Assign Dealer / Remove Dealer, 📦 Book Auto (Shiprocket), 🔄 Sync Status (Shiprocket), 📦 Chune hue ka Excel, 📮 India Post (bulk), Delete selected, Clear selection

**Bulk Upload:** Smart Import (Excel/CSV) — columns auto-detect, preview + edit, phir import

## 3. New / Edit Order (`/crm/orders/new`, `/crm/orders/[id]`)
Top: Back, Order no. + order date (IST), **Copy Details, Guarantee Card, Locate on Map, Invoice, Delete, Save**; Sources badge; "Call this number"
- 👤 **Customer & Order:** Customer Name, Contact Number (10 digit), Alternate Mobile, Email, Product (Anti Addiction / Sutra Gold+ / Other – naya likhein), Extra (Majun, spray…), Quantity, Address, Pincode (6 digit), City, State, District, Source, Status, Remark
- 💰 **Payment Information:** Unit Price, Total Amount (auto = qty × price), Online Payment Received, Balance / COD Collectable (auto), Payment Mode (COD/Prepaid/Partial), Payment Status (Pending/Completed)
- 💼 **Lead Assignment:** Lead Owner (assign/change), Dealer (optional)
- Follow-up date, Status history, Notes (shared customer notes)

**Order statuses (23):** New, Confirm Pending, Confirmed, In Transit, Delivered, Callback, Pending, GPO, GPO Pending, GPO Portal, GPO Done, GPO Delivered, Confirm cancel, Cancel pending, Final cancel, Cancelled, Dealer Cancel, Future Delivery, UNA, NDR, Lost, RTO, Double Cancel
**Sources:** Abandoned Cart, Calling, Discount Lead, IND, IND MANDEEP, Nasha, Nasha Abandoned Cart, Nasha WhatsApp, Orders, Pincode, WhatsApp (Settings se dynamic)

## 4. Dealer Management
### 4a. Manage Dealer (`/crm/dealers`)
Buttons: Export to Excel, Territory Ownership (toggle: Territory, Level, Dealer, Code, Priority table), Create New Dealer
Filters: Search (name/Dealer ID/username), Status (Active/Disabled), State, District, City, Territory, ZM (ZM nahi diya / ZM list), page size 25–1000, Columns, CSV, Print/PDF
Table: Dealer ↑, Contact, Mobile, Location, ZM (inline dropdown), Status, Actions (Edit, Disable, Territory, ⋯, ⧉ copy)
**New Dealer form:** Dealer Name*, Dealer ID (auto PHD0001 ya manual), Username, Firm Name, Contact Person, Mobile, Alternate Mobile, Email, GST, PAN, Address, City, Pincode, Territory, State, District, Credit Limit, Opening Stock, Default Margin (₹/order), Zone Manager, Min Stock Level (default 20), Notes, ☐ "Login account bhi banao" → Login ID, Password
### 4b. Payment Ledger (`/crm/dealers/ledger`)
Export to Excel, **Add Payment**; cards: Dealer Code, Total Sale (orders), Total Payment, Net Balance, Records
Filters: Today / All Dates / Custom, Dealer Code, From, To, Search, Reset
Table: TXN, DATE, PARTICULAR, DEBIT, CREDIT, NET, RUNNING
### 4c. Dealer Cumulative Report (`/crm/dealers/cumulative`)
Export CSV; cards: Total Sale, Total Commission, Net Sale, Total Paid, Total Balance
Filters: Today/All Dates/Custom, From, To, Dealer Search; Tabs: **Summary, Status-wise, Stock / Recovery / Profit**
Table: Dealer (code, comm ₹/order), Orders, Qty, Total Sale, Total Commission, Net Sale, Total Paid, Total Balance
### 4d. Manage Invoice (`/crm/dealers/invoices`)
+ New Invoice, Aaj, From/To; Table: Invoice No (PH-DLR-xxx), Date, Dealer, Payment Mode, Status, Grand Total, Balance, Actions (View/Print, Edit, Delete)
**Naya Invoice:** Dealer (search), Payment Mode (Bank Transfer/Cash/UPI/Cheque), Paid Amount, Items (Product, HSN, Qty, Rate, Hatao, + Item jodein), Discount, Notes → Invoice Banayein (GST)

## 5. Reports & Analytics (`/crm/reports`)
Ranges (All Time…Last Month), From/To, Source filter
- 📣 Source Performance: Source, Total, Conf., Deliv., Conv%, Revenue
- 📡 Live Status Board (Aaj/Kal/date, Taaza karein): **Pipeline** (Agent, Confirmed, In Transit, GPO, GPO Done, Online, COD, Total), **Delivered** (Agent, Delivered, GPO Delivered, Online, COD, Total)
- 🗺️ Orders by State: State, Orders, Conf.
- 🏪 Dealer Cumulative: Dealer, Total, Delivered, Revenue

## 6. Sales Report (`/crm/reports/sales`)
Company naam header, "Delivered + GPO Delivered" basis; ranges + custom; Date basis: **Delivery ki tarikh / Order ki tarikh**; Source filter
Cards: Total Sales, Delivered, GPO Delivered, Revenue, AOV
Tables: Status Breakdown (Status, Count, %), Source-wise (Source, Delivered, GPO Delivered, Total, Share, Revenue — click karke drill down), Day-wise Sales (Date, Orders, Revenue)

## 7. Agent Incentive (`/crm/reports/incentive`)
Sirf is range me DELIVER hue orders (Delivered + GPO Delivered)
- 🏠 **Work From Home:** Online ka 15% + COD ka 10%, koi seema nahi
- 🏢 **Office:** order ≤ ₹1000 → 0; upar → Online ka 15% + (COD − ₹1000) ka 10%
Ranges: Aaj, Kal, 7/15/30 Din, Is Mahine, Pichhle Mahine, Is Saal, Sab, custom; Agent filter; Tarika (Dono / WFH / Office); Refresh, Agent-wise CSV, Order-wise CSV
Table: #, Agent, Tarika (inline Office/Ghar se), Orders, Kul Amount, Online, COD, Online 15%, COD 10%, INCENTIVE

## 8. Courier Performance (`/crm/reports/courier`)
📊 Cohort Tulna — Window 7d/15d/30d/60d/90d; Matured: 5/7/10/12/15/20 din; Refresh
Har courier (India Post, Shiprocket): Aaj buke, Immature, Maturing, Matured, Delivery Success %, RTO %, Median delivery, COD phansa; winner line
⏳ 10+ din se atke parcel: Order, Courier, Grahak, Kahan atka/kya karein, COD, Umar, Chup; Data Quality note

## 9. Call Monitoring (`/crm/call-monitoring`) — Airtel IQ
Ranges Aaj/Kal/7/30 din + From/To
Stat cards: Kul calls, Baat hui %, Nahi uthi, Missed (inbound), Voicemail, Kul baat ka samay, Bahar ki, Aane wali, Aausat lambai, Sabse lambi, Recording hai, Order se judi
Tabs: **Calls, Agent ki tulna, Ghanta / Din, Shak wali calls, ✨ Naye number, 🔧 Extension**
"Call ke baad agent ne kya status lagaya" (10 min ke andar)
Filters: Mobile number (ya aakhri 4), Order ID, Call ID, Agent, Dhang (Bahar/Aane wali), Kya hua (Answered/Attempted/Missed/Voicemail), Recording (Hai/Nahi), Lambai (0-10s … 10 min+), Reset
Table: Samay, Agent, Customer, Order, Dhang, Kya hua, Lambai, Baad me status, Recording

## 10. Users & Access (`/crm/users`)
+ New User, Search; Table: User ID (PHxx), Name, Username, Email, Role, Status, Access; Actions: Manage Access, Reset Password, Force Logout, Delete
**New User:** Name, Phone, Email (login id), Username (auto), Password (min 8), Role (MANAGER/ZM/AGENT/VIEWER/DEALER – defaults set karta hai)
**Permissions (checkbox):**
- Orders: View Orders module, See ALL agents orders, Create, Edit, Delete (SUPER_ADMIN/MANAGER), Export Excel, Bulk import, Assign Lead Owner, Assign Dealer, Change status, Delivered/GPO Delivered lagana-hataana
- Shiprocket: Book (create+AWB), Request pickup, Track, Label/manifest, Cancel
- India Post: Book, Track, Label/receipt, Cancel
- Masters: View, Add/edit; Admin: Create users & assign access
- Reports: View reports, View agent incentive; Notes: View / Add shared customer notes
- Page access: har sidebar page ka alag checkbox
- Settings: Open settings, Manage Sources, Manage Order Statuses, Manage CRM Preferences, Manage Store→Source Mapping, Manage Follow-up Rules

## 11. Settings — CRM Control Center (`/crm/settings`, sirf SUPER_ADMIN)
Tabs: **Sources** (add, list, enable/disable, Duplicate merge From→To), **Store Mapping** (storeKey/domain → Source; default "Orders"), **Statuses** (naam, color, terminal?, order), **Follow-up Rules** (status → X din baad follow-up), **Assignment** (kaun assign/reassign kar sake), **CRM Preferences**, **Trash** (soft-deleted restore, permanent delete)

## 12. System Health (`/crm/system`)
Auto-refresh 30s, Refresh; cards: API/Database (latency), Database Size, Total Users, Logged in 24h, Failed logins 24h, Pending follow-ups, Overdue follow-ups, New backlog, Database Backup, Admin→CRM Sync Status, Shiprocket/Webhook, India Post/Webhook (booked, errors 24h)

## 13. Audit Logs (`/crm/audit`)
Export CSV; tabs All / Security / Data Changes / Shipping; From, To, User, Action (order.update, auth.login, order.create, order.delete, order.bulkStatus, order.bulkAssign, user.*, shiprocket.*, indiapost.*, dealer.*, settings.update, master.* …), Search, Apply, Reset
Table: Time (IST), User, Module, Action, Target; Prev/Next

## 14. Shiprocket (`/crm/shiprocket`)
+ Add Account (multiple accounts, active selection, Test, Sync Pickup, Edit, Delete, 🧪 Sandbox Test, Activate, webhook Copy URL / Copy Token)
- 📦 Shipment Operations (date): Booked, Label Pending, Manifest Pending, Pickup Scheduled, AWB Assigned, In Transit, Out For Delivery, Delivered, NDR, RTO, Cancelled, Pickup Error (click → Orders filter)
- ⏳ Atke hue shipment: Sab atke, Godam se utha nahi, OFD me atka, Koi khabar nahi, NDR, Lost/Damaged, Wapsi atki, Wapas aa raha
- 🚚 Courier Scorecard (30/90/180 din): Courier, Booked, Delivered, RTO, RTO %, NDR %, Avg din, COD doobi
- 📞 NDR Action Center: Sab NDR, Baat nahi ho payi, Address dikkat, Grahak ne mana kiya
- 🖨 Document Centre: labels/manifest (Aaj/Kal/3/7/30 din/Sabhi/tareekh; Jo baaki / Jo nikal chuke), Download All Labels
- 💾 Backfill: From/To, Dry Run, Preview

## 15. India Post (`/crm/indiapost`)
📦 Shipment Operations, 💰 Wallet / Advance Contract Balance (Entry/Milan), 🧾 COD Cheque Milaan, 🧪 API Health, 🏷️ Barcode/Article Manager, 🚨 receipt chhapi par daakghar nahi pahunchi, ☎️ On Hold parcels (Door Locked, Addressee Absent…), ⏳ purane parcel (4+ din no event), 💰 Kis scan par kitna paisa kata, 🖨 Document Centre (print receipts, undo print), Setup checklist, Webhook setup, Booking settings, Account, Webhook events
