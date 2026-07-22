import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth, type Session } from './index';

/** Ambil session di Server Component / Server Action. */
export async function getServerSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: headers() });
}

/** Ambil session dari Request di API route. */
export async function getApiSession(req: Request): Promise<Session | null> {
  return auth.api.getSession({ headers: req.headers });
}

export function unauthorizedResponse() {
  return NextResponse.json(
    {
      code: 'UNAUTHORIZED',
      message: 'Silakan login terlebih dahulu',
      timestamp: new Date().toISOString(),
    },
    { status: 401 }
  );
}

export function forbiddenResponse() {
  return NextResponse.json(
    {
      code: 'FORBIDDEN',
      message: 'Anda tidak memiliki akses untuk melakukan aksi ini',
      timestamp: new Date().toISOString(),
    },
    { status: 403 }
  );
}

/**
 * Administrator = pengelola sistem (akses penuh panel admin).
 * Role 'admin' adalah role KERJA (staf administrasi dengan SOP shift),
 * bukan pengelola sistem.
 */
export function isAdmin(session: Session | null): boolean {
  return session?.user.role === 'administrator';
}
