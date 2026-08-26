import { NextRequest, NextResponse } from 'next/server';

/**
 * Lightweight middleware for route protection.
 *
 * Currently protects /dashboard/admin by checking for the presence of a
 * Firebase auth token cookie. Full session-cookie auth (Admin SDK) is a
 * future enhancement — the client-side auth guard in dashboard/layout.tsx
 * handles the general dashboard protection.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin route protection — check for auth token cookie
  if (pathname.startsWith('/dashboard/admin')) {
    const authToken = request.cookies.get('firebaseAuthToken') ||
                      request.cookies.get('__session');
    if (!authToken) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/admin/:path*'],
};
