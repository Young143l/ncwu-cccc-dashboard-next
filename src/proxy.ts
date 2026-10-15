import { NextResponse, NextRequest } from "next/server";
import { verifyCookieValue, ADMIN_COOKIE } from "@/lib/auth";

const PUBLIC_API_PATHS = ["/api/auth/login", "/api/auth/logout"];

const PUBLIC_PAGE_PATHS = ["/login"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_API_PATHS.includes(pathname)) return true;
  if (PUBLIC_PAGE_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (/^\/live\/[^/]+\/official\/?$/.test(pathname)) return true;
  return false;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  if (pathname.startsWith("/api/") && req.method === "GET") {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  if (verifyCookieValue(cookie)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|gplt).*)"],
};
