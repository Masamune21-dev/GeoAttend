import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { Expo } from 'expo-server-sdk';
import { db } from '@/lib/db';
import { pushTokens } from '@/lib/db/schema';
import { getApiSession, unauthorizedResponse } from '@/lib/auth/utils';
import { RegisterPushTokenSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

function serverError(where: string, error: unknown) {
  console.error(`${where} error:`, error);
  return NextResponse.json(
    { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
    { status: 500 }
  );
}

/**
 * POST /api/push/register — daftarkan / segarkan token perangkat.
 *
 * Dipanggil app tiap kali dibuka, bukan hanya sekali saat login: Expo bisa
 * mengganti token kapan saja (pemulihan backup, clear data, reinstall).
 * Karena itu operasinya upsert, dan aman dipanggil berulang.
 *
 * Konflik di-resolve pada kolom `token`, bukan `(user, token)`. Satu HP yang
 * berganti pemilik akan menimpa `user_id` lama sehingga notifikasi ikut pindah
 * ke pemilik baru — kalau tidak, HP itu terus menerima notifikasi karyawan
 * sebelumnya.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const parsed = RegisterPushTokenSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Data tidak valid',
          details: parsed.error.flatten(),
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { token, platform, appVersion } = parsed.data;
    if (!Expo.isExpoPushToken(token)) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Token push tidak dikenali',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    await db
      .insert(pushTokens)
      .values({ token, userId: session.user.id, platform, appVersion: appVersion ?? null })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: {
          userId: session.user.id,
          platform,
          appVersion: appVersion ?? null,
          lastSeenAt: new Date(),
        },
      });

    return NextResponse.json({ data: { registered: true } });
  } catch (error) {
    return serverError('POST /api/push/register', error);
  }
}

/**
 * DELETE /api/push/register?token=... — cabut token saat logout.
 *
 * Token dibaca dari query DAN body: sebagian klien HTTP membuang body pada
 * DELETE. Penghapusan dibatasi pada token milik pemanggil sendiri supaya
 * seseorang yang tahu token orang lain tidak bisa membungkam notifikasinya.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    let token = req.nextUrl.searchParams.get('token');
    if (!token) {
      const body = await req.json().catch(() => null);
      if (body && typeof body.token === 'string') token = body.token;
    }

    if (!token) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Token wajib diisi', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    await db
      .delete(pushTokens)
      .where(and(eq(pushTokens.token, token), eq(pushTokens.userId, session.user.id)));

    return NextResponse.json({ data: { removed: true } });
  } catch (error) {
    return serverError('DELETE /api/push/register', error);
  }
}
