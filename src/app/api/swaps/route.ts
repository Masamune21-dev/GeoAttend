import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db';
import { scheduleEntries, shiftSwapRequests, user } from '@/lib/db/schema';
import { getApiSession, isAdmin, unauthorizedResponse } from '@/lib/auth/utils';
import { CreateSwapSchema, type SwapRequestResponse, type SwapStatus } from '@/types/api';
import { toLocalDateString } from '@/lib/leaves';

export const dynamic = 'force-dynamic';

const requester = alias(user, 'requester');
const target = alias(user, 'target');
const reviewer = alias(user, 'swap_reviewer');

const ACTIVE_STATUSES = ['pending_peer', 'pending_admin'];

type SwapRow = {
  swap: typeof shiftSwapRequests.$inferSelect;
  requesterName: string | null;
  targetName: string | null;
  reviewerName: string | null;
};

function toResponse(row: SwapRow): SwapRequestResponse {
  const { swap } = row;
  return {
    id: swap.id,
    requesterId: swap.requesterId,
    requesterName: row.requesterName ?? 'Pengguna terhapus',
    targetId: swap.targetId,
    targetName: row.targetName ?? 'Pengguna terhapus',
    date: swap.date,
    requesterShift: swap.requesterShift,
    targetShift: swap.targetShift,
    status: swap.status as SwapStatus,
    reason: swap.reason,
    reviewedByName: row.reviewerName,
    reviewNote: swap.reviewNote,
    createdAt: swap.createdAt.toISOString(),
  };
}

/**
 * GET /api/swaps?status=<status>
 * - Administrator: semua (opsional filter status).
 * - Karyawan: hanya yang melibatkan dirinya (sebagai pengaju atau rekan tujuan).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const status = req.nextUrl.searchParams.get('status');
    const conditions = [];
    if (!isAdmin(session)) {
      conditions.push(
        or(
          eq(shiftSwapRequests.requesterId, session.user.id),
          eq(shiftSwapRequests.targetId, session.user.id)
        )
      );
    }
    if (status) conditions.push(eq(shiftSwapRequests.status, status));

    const rows = await db
      .select({
        swap: shiftSwapRequests,
        requesterName: requester.name,
        targetName: target.name,
        reviewerName: reviewer.name,
      })
      .from(shiftSwapRequests)
      .leftJoin(requester, eq(shiftSwapRequests.requesterId, requester.id))
      .leftJoin(target, eq(shiftSwapRequests.targetId, target.id))
      .leftJoin(reviewer, eq(shiftSwapRequests.reviewedBy, reviewer.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(shiftSwapRequests.createdAt))
      .limit(500);

    return NextResponse.json({ data: rows.map(toResponse) });
  } catch (error) {
    console.error('GET /api/swaps error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

/**
 * POST /api/swaps — ajukan tukar shift dengan rekan (satu role, beda shift).
 * Hanya untuk tanggal ke depan yang sudah terjadwal untuk kedua orang.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    const parsed = CreateSwapSchema.safeParse(body);
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

    const { date, targetUserId, reason } = parsed.data;
    const selfId = session.user.id;
    const today = toLocalDateString(new Date());

    const fail = (code: string, message: string, statusCode = 422) =>
      NextResponse.json({ code, message, timestamp: new Date().toISOString() }, { status: statusCode });

    if (targetUserId === selfId) return fail('INVALID_SWAP', 'Tidak bisa menukar shift dengan diri sendiri');
    if (date <= today) return fail('INVALID_SWAP_DATE', 'Tukar shift hanya untuk tanggal ke depan');

    // Rekan tujuan harus ada & satu role
    const [targetUser] = await db
      .select({ id: user.id, name: user.name, role: user.role })
      .from(user)
      .where(eq(user.id, targetUserId))
      .limit(1);
    if (!targetUser) return fail('NOT_FOUND', 'Rekan tidak ditemukan', 404);
    if (targetUser.role !== session.user.role) {
      return fail('INVALID_SWAP', 'Rekan harus dari role yang sama');
    }

    // Kedua orang harus terjadwal shift (bukan libur) & shift-nya beda
    const sched = await db
      .select({ userId: scheduleEntries.userId, shift: scheduleEntries.shift })
      .from(scheduleEntries)
      .where(and(eq(scheduleEntries.date, date), inArray(scheduleEntries.userId, [selfId, targetUserId])));
    const myShift = sched.find((s) => s.userId === selfId)?.shift;
    const targetShift = sched.find((s) => s.userId === targetUserId)?.shift;

    if (myShift !== '1' && myShift !== '2') {
      return fail('NO_SHIFT', 'Kamu tidak terjadwal shift pada tanggal itu');
    }
    if (targetShift !== '1' && targetShift !== '2') {
      return fail('NO_SHIFT', 'Rekan tidak terjadwal shift pada tanggal itu');
    }
    if (myShift === targetShift) {
      return fail('SAME_SHIFT', 'Rekan harus punya shift yang berbeda');
    }

    // Tidak boleh ada pengajuan aktif yang menyangkut salah satu pihak di tanggal itu
    const conflict = await db
      .select({ id: shiftSwapRequests.id })
      .from(shiftSwapRequests)
      .where(
        and(
          eq(shiftSwapRequests.date, date),
          inArray(shiftSwapRequests.status, ACTIVE_STATUSES),
          or(
            inArray(shiftSwapRequests.requesterId, [selfId, targetUserId]),
            inArray(shiftSwapRequests.targetId, [selfId, targetUserId])
          )
        )
      )
      .limit(1);
    if (conflict.length > 0) {
      return fail('SWAP_EXISTS', 'Sudah ada pengajuan tukar aktif untuk tanggal ini', 409);
    }

    const inserted = await db
      .insert(shiftSwapRequests)
      .values({
        requesterId: selfId,
        targetId: targetUserId,
        date,
        requesterShift: myShift,
        targetShift,
        status: 'pending_peer',
        reason: reason?.trim() || null,
      })
      .returning();

    return NextResponse.json(
      toResponse({
        swap: inserted[0],
        requesterName: session.user.name,
        targetName: targetUser.name,
        reviewerName: null,
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/swaps error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
