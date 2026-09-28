// Sabhi dates IST (UTC+5:30) me
const IST = 330 * 60 * 1000;

/** IST ke hisaab se din ki shuruaat (UTC Date) */
export function istStartOfDay(d = new Date()) {
  const t = new Date(d.getTime() + IST);
  t.setUTCHours(0, 0, 0, 0);
  return new Date(t.getTime() - IST);
}
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** "2026-09-28" (IST date) -> UTC Date of IST midnight */
export function istDate(ymd: string) {
  return new Date(new Date(ymd + "T00:00:00Z").getTime() - IST);
}
export function toYMD(d: Date) {
  return new Date(d.getTime() + IST).toISOString().slice(0, 10);
}

export type Range = { gte?: Date; lt?: Date };

/** range key: all|today|yest|3d|7d|15d|30d|60d|90d|tm|lm|ty|custom */
export function rangeOf(key?: string | null, from?: string | null, to?: string | null): Range {
  const today = istStartOfDay();
  const tomorrow = addDays(today, 1);
  switch (key) {
    case "today": return { gte: today, lt: tomorrow };
    case "yest": return { gte: addDays(today, -1), lt: today };
    case "3d": return { gte: addDays(today, -2), lt: tomorrow };
    case "7d": return { gte: addDays(today, -6), lt: tomorrow };
    case "15d": return { gte: addDays(today, -14), lt: tomorrow };
    case "30d": return { gte: addDays(today, -29), lt: tomorrow };
    case "60d": return { gte: addDays(today, -59), lt: tomorrow };
    case "90d": return { gte: addDays(today, -89), lt: tomorrow };
    case "tm": {
      const t = new Date(today.getTime() + IST);
      const s = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1) - IST);
      return { gte: s, lt: tomorrow };
    }
    case "lm": {
      const t = new Date(today.getTime() + IST);
      const s = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1) - IST);
      const e = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1) - IST);
      return { gte: s, lt: e };
    }
    case "ty": {
      const t = new Date(today.getTime() + IST);
      return { gte: new Date(Date.UTC(t.getUTCFullYear(), 0, 1) - IST), lt: tomorrow };
    }
    case "custom":
    default: {
      const r: Range = {};
      if (from) r.gte = istDate(from);
      if (to) r.lt = addDays(istDate(to), 1);
      return r;
    }
  }
}

/** Pichla barabar period (vs prev % ke liye) */
export function prevRange(r: Range): Range | null {
  if (!r.gte || !r.lt) return null;
  const len = r.lt.getTime() - r.gte.getTime();
  return { gte: new Date(r.gte.getTime() - len), lt: r.gte };
}

export function fmtDateTime(d?: Date | string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function fmtDate(d?: Date | string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
}
export const rupee = (n?: number | null) =>
  "₹" + (n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
