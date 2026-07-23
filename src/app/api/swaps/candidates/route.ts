import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { scheduleEntries, user } from '@/lib/db/schema';
import { getApiSession, unauthorizedResponse } from '@/lib/auth/utils';
import type { SwapCandidate } from '@/types/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/swaps/candidates?date=YYYY-MM-DD
 * Rekan yang bisa diajak tukar: satu role, terjadwal shift BEDA pada tanggal itu.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const date = req.nextUrl.searchParams.get('date');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Parameter date (yyyy-MM-dd) wajib', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // Shift pengaju pada tanggal itu
    const [mine] = await db
      .select({ shift: scheduleEntries.shift })
      .from(scheduleEntries)
      .where(and(eq(scheduleEntries.userId, session.user.id), eq(scheduleEntries.date, date)))
      .limit(1);

    const requesterShift = mine?.shift ?? null;
    if (requesterShift !== '1' && requesterShift !== '2') {
      return NextResponse.json({ requesterShift: null, candidates: [] });
    }

    // User satu role dengan shift berbeda pada tanggal itu
    const rows = await db
      .select({ id: user.id, name: user.name, shift: scheduleEntries.shift })
      .from(scheduleEntries)
      .innerJoin(user, eq(scheduleEntries.userId, user.id))
      .where(
        and(
          eq(scheduleEntries.date, date),
          eq(user.role, session.user.role ?? ''),
          ne(user.id, session.user.id),
          inArray(scheduleEntries.shift, ['1', '2']),
          ne(scheduleEntries.shift, requesterShift)
        )
      )
      .orderBy(user.name);

    const candidates: SwapCandidate[] = rows.map((r) => ({ id: r.id, name: r.name, shift: r.shift }));
    return NextResponse.json({ requesterShift, candidates });
  } catch (error) {
    console.error('GET /api/swaps/candidates error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
