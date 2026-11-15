import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "./lib/admin-auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login" || pathname === "/admin/setup") {
      return NextResponse.next();
    }

    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!token || !(await verifyAdminToken(token))) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const sessionToken = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  });
  if (!sessionToken?.sub) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
