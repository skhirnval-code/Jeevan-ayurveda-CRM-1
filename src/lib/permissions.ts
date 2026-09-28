export type PermGroup = { title: string; items: { key: string; label: string }[] };

export const NAV = [
  { href: "/crm/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/crm/orders", label: "Manage Orders", icon: "📦" },
  {
    label: "Dealer Management", icon: "🏪", children: [
      { href: "/crm/dealers", label: "Manage Dealer" },
      { href: "/crm/dealers/ledger", label: "Payment Ledger" },
      { href: "/crm/dealers/cumulative", label: "Dealer Cumulative Report" },
      { href: "/crm/dealers/invoices", label: "Manage Invoice" },
    ],
  },
  { href: "/crm/reports", label: "Reports", icon: "📈" },
  { href: "/crm/reports/sales", label: "Sales Report", icon: "💰" },
  { href: "/crm/reports/incentive", label: "Incentive", icon: "🏆" },
  { href: "/crm/reports/courier", label: "Courier Performance", icon: "🚚" },
  { href: "/crm/call-monitoring", label: "Call Monitoring", icon: "📞" },
  { href: "/crm/users", label: "Users & Access", icon: "👤" },
  { href: "/crm/settings", label: "Settings", icon: "⚙️" },
  { href: "/crm/system", label: "System Health", icon: "🩺" },
  { href: "/crm/audit", label: "Audit Logs", icon: "📜" },
  { href: "/crm/shiprocket", label: "Shiprocket", icon: "🚚" },
  { href: "/crm/indiapost", label: "India Post", icon: "📮" },
] as const;

export const PAGE_KEYS: { key: string; label: string }[] = [
  { key: "page./crm/dashboard", label: "Dashboard" },
  { key: "page./crm/orders", label: "Manage Orders" },
  { key: "page./crm/dealers", label: "Dealer Management > Manage Dealer" },
  { key: "page./crm/dealers/ledger", label: "Dealer Management > Payment Ledger" },
  { key: "page./crm/dealers/cumulative", label: "Dealer Management > Dealer Cumulative Report" },
  { key: "page./crm/dealers/invoices", label: "Dealer Management > Manage Invoice" },
  { key: "page./crm/reports", label: "Reports" },
  { key: "page./crm/reports/sales", label: "Sales Report" },
  { key: "page./crm/reports/incentive", label: "Incentive" },
  { key: "page./crm/reports/courier", label: "Courier Performance" },
  { key: "page./crm/call-monitoring", label: "Call Monitoring" },
  { key: "page./crm/users", label: "Users & Access" },
  { key: "page./crm/settings", label: "Settings" },
  { key: "page./crm/system", label: "System Health" },
  { key: "page./crm/audit", label: "Audit Logs" },
  { key: "page./crm/shiprocket", label: "Shiprocket" },
  { key: "page./crm/indiapost", label: "India Post" },
];

export const PERM_GROUPS: PermGroup[] = [
  {
    title: "Orders (Manage Orders)", items: [
      { key: "orders.view", label: "View Orders module" },
      { key: "orders.viewAll", label: "See ALL agents orders (not just own)" },
      { key: "orders.create", label: "Create order" },
      { key: "orders.edit", label: "Edit order" },
      { key: "orders.delete", label: "Delete order (sirf SUPER_ADMIN/MANAGER)" },
      { key: "orders.export", label: "Export to Excel" },
      { key: "orders.import", label: "Bulk import (Excel upload)" },
      { key: "orders.assignOwner", label: "Assign / change Lead Owner" },
      { key: "orders.assignDealer", label: "Assign / change Dealer" },
      { key: "orders.status", label: "Change order status" },
      { key: "orders.revenueStatus", label: "Delivered / GPO Delivered lagana ya hataana (Revenue status)" },
    ],
  },
  {
    title: "Shiprocket Shipping", items: [
      { key: "sr.book", label: "Book order on Shiprocket (create + AWB)" },
      { key: "sr.pickup", label: "Request pickup" },
      { key: "sr.track", label: "Track shipment" },
      { key: "sr.label", label: "Generate label / manifest" },
      { key: "sr.cancel", label: "Cancel shipment" },
    ],
  },
  {
    title: "India Post Shipping", items: [
      { key: "ip.book", label: "Book order on India Post (article + AWB)" },
      { key: "ip.track", label: "Track India Post shipment" },
      { key: "ip.label", label: "India Post label / receipt" },
      { key: "ip.cancel", label: "Cancel India Post booking" },
    ],
  },
  {
    title: "Masters & Admin", items: [
      { key: "masters.view", label: "View masters" },
      { key: "masters.edit", label: "Add / edit masters" },
      { key: "users.admin", label: "Create users & assign access (admin)" },
    ],
  },
  {
    title: "Reports & Notes", items: [
      { key: "reports.view", label: "View reports / analytics" },
      { key: "reports.incentive", label: "View agent incentive (paisa)" },
      { key: "notes.view", label: "View shared customer notes" },
      { key: "notes.add", label: "Add shared customer notes" },
    ],
  },
  { title: "Page Access (Sidebar)", items: PAGE_KEYS },
  {
    title: "Settings", items: [
      { key: "settings.open", label: "Open Settings module (read config)" },
      { key: "settings.sources", label: "Manage Sources" },
      { key: "settings.statuses", label: "Manage Order Statuses" },
      { key: "settings.prefs", label: "Manage CRM Preferences" },
      { key: "settings.storeMap", label: "Manage Store -> Source Mapping" },
      { key: "settings.followup", label: "Manage Follow-up Rules" },
    ],
  },
];

export const ALL_PERM_KEYS = PERM_GROUPS.flatMap((g) => g.items.map((i) => i.key));

const on = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, true]));

export const ROLE_DEFAULTS: Record<string, Record<string, boolean>> = {
  MANAGER: on(ALL_PERM_KEYS.filter((k) => !k.startsWith("settings.") && k !== "page./crm/settings")),
  ZM: on([
    "orders.view", "orders.viewAll", "orders.edit", "orders.status", "orders.assignDealer", "notes.view", "notes.add",
    "reports.view", "page./crm/dashboard", "page./crm/orders", "page./crm/dealers", "page./crm/dealers/ledger",
    "page./crm/dealers/cumulative", "page./crm/reports",
  ]),
  AGENT: on([
    "orders.view", "orders.create", "orders.edit", "orders.status", "notes.view", "notes.add", "sr.track", "ip.track",
    "page./crm/dashboard", "page./crm/orders",
  ]),
  VIEWER: on(["orders.view", "orders.viewAll", "reports.view", "page./crm/dashboard", "page./crm/orders", "page./crm/reports"]),
  DEALER: on(["orders.view", "page./crm/orders", "page./crm/dealers/ledger"]),
};

export type SessionUser = {
  id: number; name: string; role: string; permissions: Record<string, boolean>;
};

export function can(u: SessionUser | null | undefined, key: string): boolean {
  if (!u) return false;
  if (u.role === "SUPER_ADMIN") return true;
  return !!u.permissions?.[key];
}

export function canPage(u: SessionUser | null | undefined, href: string) {
  return can(u, "page." + href);
}
