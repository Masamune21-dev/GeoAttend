import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { pushTokens, user } from '@/lib/db/schema';
import { forbiddenResponse, getApiSession, isAdmin, unauthorizedResponse } from '@/lib/auth/utils';
import type { PushDeviceResponse } from '@/types/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/push/devices — daftar perangkat yang siap menerima notifikasi.
 *
 * Administrator saja. Daftar ini memetakan HP ke karyawan, jadi bagi karyawan
 * biasa isinya tidak berguna sekaligus membuka siapa saja yang sedang aktif.
 *
 * Token TIDAK pernah dikirim utuh — hanya enam karakter terakhirnya. Token
 * Expo adalah kapabilitas: siapa pun yang memegangnya bisa mengirim notifikasi
 * ke HP itu tanpa melewati aplikasi ini sama sekali. Enam karakter cukup untuk
 * membedakan dua perangkat milik satu orang, dan itu satu-satunya kegunaan
 * token di layar.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();
    if (!isAdmin(session)) return forbiddenResponse();

    const rows = await db
      .select({
        token: pushTokens.token,
        userId: pushTokens.userId,
        userName: user.name,
        userRole: user.role,
        platform: pushTokens.platform,
        appVersion: pushTokens.appVersion,
        createdAt: pushTokens.createdAt,
        lastSeenAt: pushTokens.lastSeenAt,
      })
      .from(pushTokens)
      .innerJoin(user, eq(user.id, pushTokens.userId))
      .orderBy(desc(pushTokens.lastSeenAt));

    const data: PushDeviceResponse[] = rows.map((row) => ({
      tokenSuffix: row.token.replace(/\]$/, '').slice(-6),
      userId: row.userId,
      userName: row.userName,
      userRole: row.userRole ?? '',
      platform: row.platform,
      appVersion: row.appVersion,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error('GET /api/push/devices error:', error);
    return NextResponse.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'Terjadi kesalahan sistem',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
