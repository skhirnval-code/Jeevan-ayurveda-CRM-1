"use client";
import { useEffect, useState } from "react";

export type Meta = {
  me: { id: number; name: string; role: string; permissions: Record<string, boolean> };
  sources: string[]; statuses: string[]; products: string[];
  agents: { id: number; name: string; role: string }[];
  allUsers: { id: number; name: string; role: string }[];
  zms: { id: number; name: string }[];
  dealers: { id: number; name: string; code: string; city: string | null; zmId: number | null }[];
  states: { name: string; districts: string[] }[];
  couriers: string[];
};

let cache: Meta | null = null;

export function useMeta() {
  const [m, setM] = useState<Meta | null>(cache);
  useEffect(() => {
    if (cache) return;
    fetch("/api/meta").then((r) => r.json()).then((j) => { cache = j; setM(j); });
  }, []);
  return m;
}

export const canM = (m: Meta | null, k: string) => !!m && (m.me.role === "SUPER_ADMIN" || !!m.me.permissions[k]);

export async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j as T;
}
