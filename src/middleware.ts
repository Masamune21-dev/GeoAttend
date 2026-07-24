import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { resolveBrand, type Brand } from '@/lib/brand';

/** Brand dari request (Host header), dengan override cookie `brand` saat dev. */
function brandOf(request: NextRequest): Brand {
  if (process.env.NODE_ENV !== 'production') {
    const c = request.cookies.get('brand')?.value;
    if (c === 'stok' || c === 'geoattend') return c;
  }
  return resolveBrand(request.headers.get('host'));
}

/**
 * Pemeriksaan optimistik berbasis cookie (praktik standar Better Auth untuk middleware).
 * Validasi session sesungguhnya dilakukan di server layout & setiap API route.
 */
export function middleware(request: NextRequest) {
  // Pratinjau brand saat dev: ?brand=stok|geoattend → simpan cookie, bersihkan URL.
  if (process.env.NODE_ENV !== 'production') {
    const q = request.nextUrl.searchParams.get('brand');
    if (q === 'stok' || q === 'geoattend') {
      const url = request.nextUrl.clone();
      url.searchParams.delete('brand');
      const res = NextResponse.redirect(url);
      res.cookies.set('brand', q, { path: '/' });
      return res;
    }
  }

  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
  const home = brandOf(request) === 'stok' ? '/stock' : '/checkin';

  if (!sessionCookie && !isAuthPage) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('reason', 'expired');
    return NextResponse.redirect(loginUrl);
  }

  if (sessionCookie && isAuthPage) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/checkin',
    '/history',
    '/profile',
    '/stock/:path*',
    '/admin/:path*',
    '/login',
    '/register',
  ],
};
