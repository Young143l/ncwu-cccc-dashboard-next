import { createHmac, timingSafeEqual } from "crypto";

const PASSWORD = process.env.ADMIN_PASSWORD;
const COOKIE_PAYLOAD = "admin-session-v1";

if (!PASSWORD) {
  throw new Error("ADMIN_PASSWORD 环境变量未设置");
}

export function signCookieValue(): string {
  return createHmac("sha256", PASSWORD!).update(COOKIE_PAYLOAD).digest("hex");
}

export function verifyCookieValue(value: string | undefined): boolean {
  if (!value || !PASSWORD) return false;
  const expected = signCookieValue();
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const ADMIN_COOKIE = "admin_auth";
