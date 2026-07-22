import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { attendanceRecords, liveLocations, user } from '@/lib/db/schema';
import {
  getApiSession,
  isAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/utils';
import { UpdateLocationSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/locations — karyawan mengirim posisi live miliknya.
 * Hanya diterima bila status hari ini masih clock-in (sedang hadir).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    const parsed = UpdateLocationSchema.safeParse(body);
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

    // Hanya lacak pengguna yang sedang hadir (record terakhir hari ini = clock_in)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const lastToday = await db
      .select({ type: attendanceRecords.type })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.userId, session.user.id),
          gte(attendanceRecords.timestamp, startOfDay)
        )
      )
      .orderBy(desc(attendanceRecords.timestamp))
      .limit(1);

    if (lastToday[0]?.type !== 'clock_in') {
      return NextResponse.json(
        {
          code: 'NOT_CLOCKED_IN',
          message: 'Pelacakan hanya aktif saat Anda berstatus hadir',
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }

    const input = parsed.data;
    await db
      .insert(liveLocations)
      .values({
        userId: session.user.id,
        latitude: String(input.latitude),
        longitude: String(input.longitude),
        accuracyMeters: input.accuracyMeters != null ? String(input.accuracyMeters) : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: liveLocations.userId,
        set: {
          latitude: String(input.latitude),
          longitude: String(input.longitude),
          accuracyMeters: input.accuracyMeters != null ? String(input.accuracyMeters) : null,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/locations error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

/**
 * GET /api/locations — posisi live seluruh karyawan (administrator saja).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();
    if (!isAdmin(session)) return forbiddenResponse();

    const rows = await db
      .select({
        userId: liveLocations.userId,
        latitude: liveLocations.latitude,
        longitude: liveLocations.longitude,
        accuracyMeters: liveLocations.accuracyMeters,
        updatedAt: liveLocations.updatedAt,
        userName: user.name,
        role: user.role,
      })
      .from(liveLocations)
      .leftJoin(user, eq(liveLocations.userId, user.id));

    return NextResponse.json({
      data: rows.map((row) => ({
        userId: row.userId,
        userName: row.userName ?? 'Pengguna terhapus',
        role: row.role ?? 'employee',
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        accuracyMeters: row.accuracyMeters ? Number(row.accuracyMeters) : null,
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('GET /api/locations error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
