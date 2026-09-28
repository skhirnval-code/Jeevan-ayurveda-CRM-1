import { NextResponse } from "next/server";
import { HttpError } from "./auth";

export const ok = (data: unknown, init?: number) => NextResponse.json(data, { status: init ?? 200 });
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** Route handler wrapper: errors ko JSON me badalta hai */
export function handle<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.message, e.status);
      console.error(e);
      return fail((e as Error).message || "Server error", 500);
    }
  };
}

export const num = (v: unknown, d = 0) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : d;
};
export const str = (v: unknown) => {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
};
