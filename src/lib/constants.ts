export const BRAND = process.env.BRAND_NAME || "Prakriti Herbs";
export const COMPANY = process.env.COMPANY_NAME || "PRAKRITI HERBS PRIVATE LIMITED";
export const ORDER_PREFIX = process.env.ORDER_PREFIX || "PHCRM";

export const STATUSES = [
  "New", "Confirm Pending", "Confirmed", "In Transit", "Delivered", "Callback", "Pending",
  "GPO", "GPO Pending", "GPO Portal", "GPO Done", "GPO Delivered", "Confirm cancel",
  "Cancel pending", "Final cancel", "Cancelled", "Dealer Cancel", "Future Delivery",
  "UNA", "NDR", "Lost", "RTO", "Double Cancel",
] as const;

export const REVENUE_STATUSES = ["Delivered", "GPO Delivered"];
export const TERMINAL_STATUSES = [
  "Delivered", "GPO Delivered", "Final cancel", "Cancelled", "Dealer Cancel", "Lost", "RTO", "Double Cancel",
];
export const CANCEL_STATUSES = ["Confirm cancel", "Cancel pending", "Final cancel", "Cancelled", "Dealer Cancel", "Double Cancel"];
export const PIPELINE_STATUSES = ["Confirmed", "In Transit", "GPO", "GPO Done"];

// Orders page par dikhne wale tabs
export const STATUS_TABS = [
  "New", "Callback", "Pending", "Confirmed", "In Transit", "GPO", "GPO Portal", "GPO Done",
  "Delivered", "Future Delivery", "UNA", "Cancel pending",
];

export const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-700 border-blue-200",
  "Confirm Pending": "bg-sky-100 text-sky-700 border-sky-200",
  Confirmed: "bg-green-100 text-green-700 border-green-200",
  "In Transit": "bg-indigo-100 text-indigo-700 border-indigo-200",
  Delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Callback: "bg-orange-100 text-orange-700 border-orange-200",
  Pending: "bg-amber-100 text-amber-700 border-amber-200",
  GPO: "bg-violet-100 text-violet-700 border-violet-200",
  "GPO Pending": "bg-violet-100 text-violet-700 border-violet-200",
  "GPO Portal": "bg-purple-100 text-purple-700 border-purple-200",
  "GPO Done": "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  "GPO Delivered": "bg-teal-100 text-teal-700 border-teal-200",
  "Future Delivery": "bg-cyan-100 text-cyan-700 border-cyan-200",
  UNA: "bg-yellow-100 text-yellow-800 border-yellow-200",
  NDR: "bg-rose-100 text-rose-700 border-rose-200",
};
export const statusClass = (s: string) =>
  STATUS_COLORS[s] || (CANCEL_STATUSES.includes(s) || ["RTO", "Lost"].includes(s)
    ? "bg-red-100 text-red-700 border-red-200"
    : "bg-slate-100 text-slate-700 border-slate-200");

export const DEFAULT_SOURCES = [
  "Orders", "Calling", "Abandoned Cart", "Discount Lead", "IND", "IND MANDEEP", "Nasha",
  "Nasha Abandoned Cart", "Nasha WhatsApp", "Pincode", "WhatsApp",
];

export const DEFAULT_PRODUCTS = ["Sutra Gold+", "Anti Addiction"];

export const PAYMENT_MODES = ["COD", "Prepaid", "Partial"];
export const PAYMENT_STATUSES = ["Pending", "Completed"];
export const INVOICE_PAY_MODES = ["Bank Transfer", "Cash", "UPI", "Cheque"];

export const STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttarakhand", "Uttar Pradesh",
  "West Bengal",
];

export const SHIPROCKET_COURIERS = [
  "Amazon COD Surface 500gm", "Blue Dart", "Blue Dart Air", "Delhivery Air", "Delhivery DS 250gm",
  "Delhivery DS 500gm", "Delhivery Surface", "DTDC Surface", "Ekart Logistics Surface",
  "Instant pickup - Shadowfax", "Shadowfax DS 500", "Shadowfax Surface", "Xpressbees Air",
  "Xpressbees DS New", "Xpressbees Surface",
];

export const SHIP_STATUSES = [
  "AWB Assigned", "Pickup Scheduled", "In Transit", "Out For Delivery", "Delivered", "NDR",
  "RTO Initiated", "RTO Delivered", "Lost", "Cancelled", "Pickup Error",
];

export const POST_EVENTS = [
  "Item Booked", "Item Received", "Item bagged", "Bag Received", "Item Dispatched",
  "Item received at Destination", "Item Invoiced to BO", "Taken out for delivery",
  "Item Delivered(Addressee)", "Item Kept on Hold", "Item Redirected", "Item Returned to Sender",
  "RTO In Transit", "RTO Out for Delivery", "Portal file ka intezaar", "Portal Pending",
  "Bag Received for Forward",
];

export const QUICK_FILTERS = [
  { key: "unassigned", label: "Unassigned" },
  { key: "pendingFollowups", label: "Pending Followups" },
  { key: "onlinePaid", label: "Online Paid" },
  { key: "confirmed", label: "Confirmed" },
  { key: "gpoDone", label: "GPO Done (Booked)" },
  { key: "delivered", label: "Delivered" },
  { key: "highValue", label: "High Value" },
];

export const DATE_RANGES = [
  { key: "all", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "yest", label: "Yesterday" },
  { key: "3d", label: "3 Days" },
  { key: "7d", label: "7 Days" },
  { key: "15d", label: "15 Days" },
  { key: "30d", label: "30 Days" },
  { key: "tm", label: "This Month" },
  { key: "lm", label: "Last Month" },
];

// Incentive rules (Settings > CRM Preferences se override ho sakte hain)
export const INCENTIVE = {
  wfh: { onlinePct: 15, codPct: 10 },
  office: { minOrder: 1000, onlinePct: 15, codPct: 10, codDeduct: 1000 },
};
