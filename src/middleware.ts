import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const authCookie = request.cookies.get("admin_auth");

  if (!authCookie || authCookie.value !== "authenticated") {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api/auth|mcp|\\.well-known|_next/static|_next/image|favicon.ico|manifest.json|sw.js|apple-touch-icon.png|icons/).*)",
  ],
};
