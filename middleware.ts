import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE } from "@/lib/auth-cookie";

// Assigns a stable anonymous user id on first visit. Auth providers (e.g. Clerk)
// can replace this later; everything downstream only depends on the user id.
export function middleware(request: NextRequest) {
  if (request.cookies.has(USER_COOKIE)) {
    return NextResponse.next();
  }

  const id = crypto.randomUUID();
  // Mutate the request cookies too so the very first render already sees the id.
  request.cookies.set(USER_COOKIE, id);
  const response = NextResponse.next({ request });
  response.cookies.set(USER_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
