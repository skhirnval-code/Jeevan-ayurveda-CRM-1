import { cookies } from "next/headers";
import { COOKIE } from "@/lib/auth";
import { ok } from "@/lib/api";

export async function POST() {
  cookies().delete(COOKIE);
  return ok({ ok: true });
}
