import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { piketAssignments, user } from '@/lib/db/schema';
import {
  getApiSession,
  isAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/utils';
import { UpsertPiketSchema, MarkPiketDoneSchema, type PiketAssignment } from '@/types/api';
import { monthDates, toLocalMonth } from '@/lib/schedule/rotation';

export const dynamic = 'force-dynamic';

const SCHEDULABLE_ROLES = ['admin', 'noc'];

/**
 * GET /api/piket?month=YYYY-MM — jadwal piket sebulan (semua user login boleh baca).
 * Daftar `users` (kandidat piket) hanya disertakan untuk administrator.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const month = req.nextUrl.searchParams.get('month') ?? toLocalMonth(new Date());
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Format bulan harus yyyy-MM', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const dates = monthDates(month);
    const start = dates[0];
    const end = dates[dates.length - 1];

    const rows = await db
      .select({
        date: piketAssignments.date,
        userId: piketAssignments.userId,
        userName: user.name,
        done: piketAssignments.done,
      })
      .from(piketAssignments)
      .leftJoin(user, eq(piketAssignments.userId, user.id))
      .where(and(gte(piketAssignments.date, start), lte(piketAssignments.date, end)));

    const assignments: PiketAssignment[] = rows.map((r) => ({
      date: r.date,
      userId: r.userId,
      userName: r.userName ?? 'Pengguna terhapus',
      done: r.done,
    }));

    const users = isAdmin(session)
      ? await db
          .select({ id: user.id, name: user.name, role: user.role })
          .from(user)
          .where(inArray(user.role, SCHEDULABLE_ROLES))
          .orderBy(
            sql`CASE ${user.role} WHEN 'admin' THEN 0 WHEN 'noc' THEN 1 ELSE 2 END`,
            asc(user.name)
          )
      : [];

    return NextResponse.json({ users, assignments });
  } catch (error) {
    console.error('GET /api/piket error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/piket — simpan jadwal piket sebulan (administrator).
 * Upsert per tanggal; bila petugas berubah, penanda `done` di-reset.
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();
    if (!isAdmin(session)) return forbiddenResponse();

    const body = await req.json();
    const parsed = UpsertPiketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.flatten(), timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const { month, assignments } = parsed.data;
    const dates = monthDates(month);
    const validDates = new Set(dates);

    const schedulable = await db
      .select({ id: user.id })
      .from(user)
      .where(inArray(user.role, SCHEDULABLE_ROLES));
    const schedulableIds = new Set(schedulable.map((u) => u.id));

    // Dedupe per tanggal; abaikan tanggal luar bulan / user non-jadwal
    const dedup = new Map<string, string>();
    for (const a of assignments) {
      if (!validDates.has(a.date) || !schedulableIds.has(a.userId)) continue;
      dedup.set(a.date, a.userId);
    }

    const existing = await db
      .select({ date: piketAssignments.date, userId: piketAssignments.userId })
      .from(piketAssignments)
      .where(and(gte(piketAssignments.date, dates[0]), lte(piketAssignments.date, dates[dates.length - 1])));
    const existingMap = new Map(existing.map((e) => [e.date, e.userId]));

    await db.transaction(async (tx) => {
      // Hapus tanggal yang tak lagi ada di payload
      const removed = existing.filter((e) => !dedup.has(e.date)).map((e) => e.date);
      if (removed.length > 0) {
        await tx.delete(piketAssignments).where(inArray(piketAssignments.date, removed));
      }
      // Upsert
      for (const [date, userId] of Array.from(dedup.entries())) {
        if (existingMap.get(date) === userId) continue; // tak berubah
        await tx
          .insert(piketAssignments)
          .values({ date, userId, done: false })
          .onConflictDoUpdate({
            target: piketAssignments.date,
            set: { userId, done: false, doneAt: null, updatedAt: new Date() },
          });
      }
    });

    return NextResponse.json({ data: { month, saved: dedup.size } });
  } catch (error) {
    console.error('PUT /api/piket error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/piket — tandai piket sudah/belum dilakukan.
 * Hanya petugas hari itu atau administrator.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    const parsed = MarkPiketDoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parsed.error.flatten(), timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const { date, done } = parsed.data;
    const [assignment] = await db
      .select({ userId: piketAssignments.userId })
      .from(piketAssignments)
      .where(eq(piketAssignments.date, date))
      .limit(1);
    if (!assignment) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Belum ada jadwal piket tanggal itu', timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }
    if (assignment.userId !== session.user.id && !isAdmin(session)) return forbiddenResponse();

    await db
      .update(piketAssignments)
      .set({ done, doneAt: done ? new Date() : null, updatedAt: new Date() })
      .where(eq(piketAssignments.date, date));

    return NextResponse.json({ data: { date, done } });
  } catch (error) {
    console.error('PATCH /api/piket error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
