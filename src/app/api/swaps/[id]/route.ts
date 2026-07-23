import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { scheduleEntries, shiftSwapRequests } from '@/lib/db/schema';
import {
  getApiSession,
  isAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/utils';
import { ReviewSwapSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

function notFound() {
  return NextResponse.json(
    { code: 'NOT_FOUND', message: 'Pengajuan tukar tidak ditemukan', timestamp: new Date().toISOString() },
    { status: 404 }
  );
}

function conflict(message: string) {
  return NextResponse.json(
    { code: 'INVALID_STATE', message, timestamp: new Date().toISOString() },
    { status: 409 }
  );
}

/**
 * PATCH /api/swaps/[id] — aksi pada pengajuan tukar shift.
 * - peer_accept / peer_reject: hanya rekan tujuan, saat status pending_peer.
 * - approve / reject: hanya administrator, saat status pending_admin.
 *   approve → entri jadwal kedua orang ditukar (transaksi).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    const parsed = ReviewSwapSchema.safeParse(body);
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

    const { action, reviewNote } = parsed.data;
    const [swap] = await db
      .select()
      .from(shiftSwapRequests)
      .where(eq(shiftSwapRequests.id, params.id))
      .limit(1);
    if (!swap) return notFound();

    const note = reviewNote?.trim() || null;

    // --- Persetujuan rekan tujuan ---
    if (action === 'peer_accept' || action === 'peer_reject') {
      if (swap.targetId !== session.user.id) return forbiddenResponse();
      if (swap.status !== 'pending_peer') return conflict('Pengajuan sudah tidak menunggu responsmu');

      const updated = await db
        .update(shiftSwapRequests)
        .set({
          status: action === 'peer_accept' ? 'pending_admin' : 'rejected',
          reviewNote: action === 'peer_reject' ? note : swap.reviewNote,
          peerRespondedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(shiftSwapRequests.id, params.id))
        .returning({ id: shiftSwapRequests.id, status: shiftSwapRequests.status });
      return NextResponse.json({ data: updated[0] });
    }

    // --- Persetujuan administrator ---
    if (!isAdmin(session)) return forbiddenResponse();
    if (swap.status !== 'pending_admin') {
      return conflict('Pengajuan belum disetujui rekan atau sudah diproses');
    }

    if (action === 'reject') {
      const updated = await db
        .update(shiftSwapRequests)
        .set({
          status: 'rejected',
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          reviewNote: note,
          updatedAt: new Date(),
        })
        .where(eq(shiftSwapRequests.id, params.id))
        .returning({ id: shiftSwapRequests.id, status: shiftSwapRequests.status });
      return NextResponse.json({ data: updated[0] });
    }

    // action === 'approve' → tukar entri jadwal (transaksi), setelah cek jadwal tak berubah
    const current = await db
      .select({ userId: scheduleEntries.userId, shift: scheduleEntries.shift })
      .from(scheduleEntries)
      .where(
        and(
          eq(scheduleEntries.date, swap.date),
          inArray(scheduleEntries.userId, [swap.requesterId, swap.targetId])
        )
      );
    const reqNow = current.find((c) => c.userId === swap.requesterId)?.shift;
    const tgtNow = current.find((c) => c.userId === swap.targetId)?.shift;
    if (reqNow !== swap.requesterShift || tgtNow !== swap.targetShift) {
      return conflict('Jadwal sudah berubah sejak pengajuan; tukar tidak bisa diterapkan');
    }

    await db.transaction(async (tx) => {
      // requester dapat shift target, target dapat shift requester
      for (const [userId, shift] of [
        [swap.requesterId, swap.targetShift],
        [swap.targetId, swap.requesterShift],
      ] as const) {
        await tx
          .insert(scheduleEntries)
          .values({ userId, date: swap.date, shift })
          .onConflictDoUpdate({
            target: [scheduleEntries.userId, scheduleEntries.date],
            set: { shift, updatedAt: new Date() },
          });
      }
      await tx
        .update(shiftSwapRequests)
        .set({
          status: 'approved',
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          reviewNote: note,
          updatedAt: new Date(),
        })
        .where(eq(shiftSwapRequests.id, params.id));
    });

    return NextResponse.json({ data: { id: swap.id, status: 'approved' } });
  } catch (error) {
    console.error('PATCH /api/swaps/[id] error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/swaps/[id] — batalkan pengajuan.
 * Pengaju: miliknya sendiri selama belum disetujui. Administrator: bebas.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const [swap] = await db
      .select({
        id: shiftSwapRequests.id,
        requesterId: shiftSwapRequests.requesterId,
        status: shiftSwapRequests.status,
      })
      .from(shiftSwapRequests)
      .where(eq(shiftSwapRequests.id, params.id))
      .limit(1);
    if (!swap) return notFound();

    if (!isAdmin(session)) {
      const isOwner = swap.requesterId === session.user.id;
      const cancellable = swap.status === 'pending_peer' || swap.status === 'pending_admin';
      if (!isOwner || !cancellable) return forbiddenResponse();
    }

    await db.delete(shiftSwapRequests).where(eq(shiftSwapRequests.id, params.id));
    return NextResponse.json({ data: { id: swap.id } });
  } catch (error) {
    console.error('DELETE /api/swaps/[id] error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
