import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { scheduleEntries, user } from '@/lib/db/schema';
import {
  getApiSession,
  isAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/utils';
import { UpsertScheduleSchema, type ScheduleShift } from '@/types/api';
import { monthDates, toLocalMonth } from '@/lib/schedule/rotation';

export const dynamic = 'force-dynamic';

/** Role yang dijadwalkan shift (punya 2 shift). */
const SCHEDULABLE_ROLES = ['admin', 'noc'];

/**
 * GET /api/schedules?month=YYYY-MM&userId=self|<id>
 * - Administrator tanpa userId → grid penuh: daftar user admin/noc + entri bulan.
 * - Karyawan / userId=self → hanya entri jadwal miliknya.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const params = req.nextUrl.searchParams;
    const month = params.get('month') ?? toLocalMonth(new Date());
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Format bulan harus yyyy-MM', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const admin = isAdmin(session);
    let targetUserId = params.get('userId');
    if (targetUserId === 'self') targetUserId = session.user.id;
    if (!admin) targetUserId = session.user.id;

    const dates = monthDates(month);
    const start = dates[0];
    const end = dates[dates.length - 1];

    const entryConds = [gte(scheduleEntries.date, start), lte(scheduleEntries.date, end)];
    if (targetUserId) entryConds.push(eq(scheduleEntries.userId, targetUserId));

    const entries = await db
      .select({
        userId: scheduleEntries.userId,
        date: scheduleEntries.date,
        shift: scheduleEntries.shift,
      })
      .from(scheduleEntries)
      .where(and(...entryConds));

    // Daftar user hanya untuk tampilan grid administrator
    const users =
      admin && !targetUserId
        ? await db
            .select({ id: user.id, name: user.name, role: user.role })
            .from(user)
            .where(inArray(user.role, SCHEDULABLE_ROLES))
            .orderBy(
              sql`CASE ${user.role} WHEN 'admin' THEN 0 WHEN 'noc' THEN 1 ELSE 2 END`,
              asc(user.name)
            )
        : [];

    return NextResponse.json({
      users,
      entries: entries.map((e) => ({ ...e, shift: e.shift as ScheduleShift })),
    });
  } catch (error) {
    console.error('GET /api/schedules error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/schedules — simpan jadwal satu bulan (administrator saja).
 * Semantik replace-bulan: entri bulan itu untuk user admin/noc diganti seluruhnya.
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();
    if (!isAdmin(session)) return forbiddenResponse();

    const body = await req.json();
    const parsed = UpsertScheduleSchema.safeParse(body);
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

    const { month, entries } = parsed.data;
    const dates = monthDates(month);
    const start = dates[0];
    const end = dates[dates.length - 1];
    const validDates = new Set(dates);

    // Hanya user admin/noc yang boleh dijadwalkan
    const schedulable = await db
      .select({ id: user.id })
      .from(user)
      .where(inArray(user.role, SCHEDULABLE_ROLES));
    const schedulableIds = new Set(schedulable.map((u) => u.id));

    // Dedupe (userId|date) — sel terakhir menang; abaikan tanggal luar bulan / user non-jadwal
    const dedup = new Map<string, { userId: string; date: string; shift: ScheduleShift }>();
    for (const e of entries) {
      if (!validDates.has(e.date) || !schedulableIds.has(e.userId)) continue;
      dedup.set(`${e.userId}|${e.date}`, e);
    }
    const rows = Array.from(dedup.values());
    const schedulableIdList = Array.from(schedulableIds);

    await db.transaction(async (tx) => {
      await tx
        .delete(scheduleEntries)
        .where(
          and(
            gte(scheduleEntries.date, start),
            lte(scheduleEntries.date, end),
            inArray(scheduleEntries.userId, schedulableIdList)
          )
        );
      if (rows.length > 0) {
        await tx.insert(scheduleEntries).values(
          rows.map((r) => ({ userId: r.userId, date: r.date, shift: r.shift }))
        );
      }
    });

    return NextResponse.json({ data: { month, saved: rows.length } });
  } catch (error) {
    console.error('PUT /api/schedules error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
