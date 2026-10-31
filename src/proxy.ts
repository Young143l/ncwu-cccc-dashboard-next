import { NextResponse, NextRequest } from "next/server";
import { verifyCookieValue, ADMIN_COOKIE } from "@/lib/auth";

const PUBLIC_API_PATHS = ["/api/auth/login", "/api/auth/logout"];

// 免登录的 GET 接口：观赛页只需要比赛详情（官方版/投屏版都只用它），
// 再加上健康检查。其余 GET（比赛列表、同步状态里的学生学号姓名、分数明细）
// 一律要求登录，避免名单类个人信息在公网裸奔。
const PUBLIC_API_GET = [
  /^\/api\/health\/?$/,
  /^\/api\/competitions\/\d+\/?$/,
];

const PUBLIC_PAGE_PATHS = ["/login"];

function isPublicApiGet(pathname: string, method: string): boolean {
  return method === "GET" && PUBLIC_API_GET.some((re) => re.test(pathname));
}

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

  if (isPublicApiGet(pathname, req.method)) return NextResponse.next();

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
