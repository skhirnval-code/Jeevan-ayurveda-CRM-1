import { INCENTIVE } from "./constants";
import { prisma } from "./db";

export type IncRow = { total: number; online: number; balance: number };
export type IncRules = typeof INCENTIVE;

/** Settings > CRM Preferences se rules (na ho to defaults) */
export async function loadIncentiveRules(): Promise<IncRules> {
  const s = await prisma.setting.findUnique({ where: { key: "prefs" } }).catch(() => null);
  const p = (s?.value as Record<string, number>) || {};
  return {
    wfh: { onlinePct: p.wfhOnline ?? INCENTIVE.wfh.onlinePct, codPct: p.wfhCod ?? INCENTIVE.wfh.codPct },
    office: {
      minOrder: p.officeMin ?? INCENTIVE.office.minOrder, onlinePct: p.officeOnline ?? INCENTIVE.office.onlinePct,
      codPct: p.officeCod ?? INCENTIVE.office.codPct, codDeduct: p.officeDeduct ?? INCENTIVE.office.codDeduct,
    },
  };
}

/** WFH: online 15% + COD 10%. Office: <=1000 -> 0, warna online 15% + (COD-1000) ka 10% */
export function incentiveFor(o: IncRow, mode: "WFH" | "OFFICE", R: IncRules = INCENTIVE) {
  const online = o.online || 0;
  const cod = Math.max(0, (o.total || 0) - online);
  if (mode === "WFH") {
    const a = (online * R.wfh.onlinePct) / 100;
    const b = (cod * R.wfh.codPct) / 100;
    return { onlinePart: a, codPart: b, total: a + b };
  }
  if ((o.total || 0) <= R.office.minOrder) return { onlinePart: 0, codPart: 0, total: 0 };
  const a = (online * R.office.onlinePct) / 100;
  const b = (Math.max(0, cod - R.office.codDeduct) * R.office.codPct) / 100;
  return { onlinePart: a, codPart: b, total: a + b };
}
