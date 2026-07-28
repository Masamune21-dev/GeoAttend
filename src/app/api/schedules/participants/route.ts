import { NextRequest, NextResponse } from 'next/server';
import { asc, inArray, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { scheduleParticipants, user } from '@/lib/db/schema';
import {
  getApiSession,
  isAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/utils';
import { UpdateScheduleParticipantsSchema, type TechnicianTeam } from '@/types/api';
import { listScheduleParticipants } from '@/lib/schedule/participants';
import { ROLE_ORDER } from '@/lib/schedule/roles';

export const dynamic = 'force-dynamic';

/**
 * GET /api/schedules/participants — kandidat + peserta jadwal saat ini
 * (administrator saja).
 *
 * `candidates` = seluruh karyawan (selain administrator) sehingga admin bebas
 * memasukkan siapa pun, dikelompokkan menurut role masing-masing.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();
    if (!isAdmin(session)) return forbiddenResponse();

    const [candidates, current] = await Promise.all([
      db
        .select({
          id: user.id,
          name: user.name,
          role: user.role,
          image: user.image,
          technicianTeam: user.technicianTeam,
        })
        .from(user)
        .where(ne(user.role, 'administrator'))
        .orderBy(
          sql`CASE ${user.role} WHEN 'admin' THEN ${ROLE_ORDER.admin} WHEN 'noc' THEN ${ROLE_ORDER.noc} WHEN 'teknisi' THEN ${ROLE_ORDER.teknisi} ELSE 99 END`,
          asc(user.name)
        ),
      listScheduleParticipants(),
    ]);

    return NextResponse.json({
      candidates: candidates.map((c) => ({
        ...c,
        technicianTeam: (c.technicianTeam as TechnicianTeam | null) ?? null,
      })),
      participantIds: current.users.map((u) => u.id),
      configured: current.configured,
    });
  } catch (error) {
    console.error('GET /api/schedules/participants error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/schedules/participants — tetapkan daftar peserta jadwal
 * (administrator saja). Semantik replace: daftar lama diganti seluruhnya.
 *
 * Karyawan yang dikeluarkan tidak lagi muncul di grid, tetapi entri jadwal
 * yang sudah tersimpan sengaja TIDAK dihapus — riwayat jadwal tetap utuh.
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();
    if (!isAdmin(session)) return forbiddenResponse();

    const body = await req.json();
    const parsed = UpdateScheduleParticipantsSchema.safeParse(body);
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

    const requested = Array.from(new Set(parsed.data.userIds));

    // Hanya id yang benar-benar ada & bukan administrator yang disimpan
    const valid =
      requested.length > 0
        ? await db
            .select({ id: user.id })
            .from(user)
            .where(inArray(user.id, requested))
        : [];
    const validIds = valid.map((v) => v.id);

    await db.transaction(async (tx) => {
      await tx.delete(scheduleParticipants);
      if (validIds.length > 0) {
        await tx
          .insert(scheduleParticipants)
          .values(validIds.map((id) => ({ userId: id })));
      }
    });

    return NextResponse.json({ data: { saved: validIds.length } });
  } catch (error) {
    console.error('PUT /api/schedules/participants error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
