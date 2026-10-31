import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

import { signCookieValue, ADMIN_COOKIE } from "@/lib/auth";
import {
  getClientIp,
  hitRateLimit,
  peekRateLimit,
  resetRateLimit,
} from "@/lib/rate-limit";

/** 同一 IP 每 60 秒最多允许 5 次密码错误，避免公网暴力破解 */
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 60_000;

/** 常数时间比较，避免按字符差异泄露密码前缀 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // 长度不同也要走一次比较，避免长度差异造成的时序差
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const bucketKey = `login:${ip}`;

  const precheck = peekRateLimit(bucketKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!precheck.allowed) {
    return NextResponse.json(
      { error: `密码错误次数过多，请 ${precheck.retryAfterSec} 秒后再试` },
      {
        status: 429,
        headers: { "Retry-After": String(precheck.retryAfterSec) },
      }
    );
  }

  const body = await req.json().catch(() => ({}) as { password?: string });
  const password = typeof body.password === "string" ? body.password : "";

  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected || !safeEqual(password, expected)) {
    const result = hitRateLimit(bucketKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
    if (!result.allowed) {
      return NextResponse.json(
        { error: `密码错误次数过多，请 ${result.retryAfterSec} 秒后再试` },
        {
          status: 429,
          headers: { "Retry-After": String(result.retryAfterSec) },
        }
      );
    }
    return NextResponse.json(
      { error: "密码错误", remainingAttempts: result.remaining },
      { status: 401 }
    );
  }

  resetRateLimit(bucketKey);

  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, signCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE !== "false",
    path: "/",
  });
  return res;
}
