import { NextRequest, NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { shiftSettings } from '@/lib/db/schema';
import {
  getApiSession,
  isAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/utils';
import { UpsertShiftsSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

/** GET /api/shifts — daftar konfigurasi jam kerja SOP per role. */
export async function GET(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const rows = await db
      .select({
        id: shiftSettings.id,
        role: shiftSettings.role,
        shiftNumber: shiftSettings.shiftNumber,
        startTime: shiftSettings.startTime,
        endTime: shiftSettings.endTime,
      })
      .from(shiftSettings)
      .orderBy(asc(shiftSettings.role), asc(shiftSettings.shiftNumber));

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error('GET /api/shifts error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/shifts — ganti seluruh konfigurasi shift (admin saja).
 * Body: { shifts: [{ role, shiftNumber, startTime, endTime }] }
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();
    if (!isAdmin(session)) return forbiddenResponse();

    const body = await req.json();
    const parsed = UpsertShiftsSchema.safeParse(body);
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

    const result = await db.transaction(async (tx) => {
      await tx.delete(shiftSettings);
      return tx
        .insert(shiftSettings)
        .values(
          parsed.data.shifts.map((shift) => ({
            role: shift.role,
            shiftNumber: shift.shiftNumber,
            startTime: shift.startTime,
            endTime: shift.endTime,
          }))
        )
        .returning({
          id: shiftSettings.id,
          role: shiftSettings.role,
          shiftNumber: shiftSettings.shiftNumber,
          startTime: shiftSettings.startTime,
          endTime: shiftSettings.endTime,
        });
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('PUT /api/shifts error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
