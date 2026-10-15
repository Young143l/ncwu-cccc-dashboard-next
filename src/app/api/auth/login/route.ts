import { NextRequest, NextResponse } from "next/server";
import { signCookieValue, ADMIN_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, signCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE !== "false",
    path: "/",
  });
  return res;
}
