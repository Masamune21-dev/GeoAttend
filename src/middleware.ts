import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/**
 * Pemeriksaan optimistik berbasis cookie (praktik standar Better Auth untuk middleware).
 * Validasi session sesungguhnya dilakukan di server layout & setiap API route.
 */
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');

  if (!sessionCookie && !isAuthPage) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('reason', 'expired');
    return NextResponse.redirect(loginUrl);
  }

  if (sessionCookie && isAuthPage) {
    return NextResponse.redirect(new URL('/checkin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/checkin',
    '/history',
    '/profile',
    '/admin/:path*',
    '/login',
    '/register',
  ],
};
