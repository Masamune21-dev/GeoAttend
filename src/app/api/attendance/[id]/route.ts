import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { attendanceRecords, geofences, user } from '@/lib/db/schema';
import { getApiSession, isAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth/utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/attendance/[id] — detail satu record absensi.
 * Karyawan hanya boleh mengakses record miliknya sendiri.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const rows = await db
      .select({
        record: attendanceRecords,
        userName: user.name,
        userImage: user.image,
        geofenceName: geofences.name,
      })
      .from(attendanceRecords)
      .leftJoin(user, eq(attendanceRecords.userId, user.id))
      .leftJoin(geofences, eq(attendanceRecords.geofenceId, geofences.id))
      .where(eq(attendanceRecords.id, params.id))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Record tidak ditemukan', timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    if (!isAdmin(session) && row.record.userId !== session.user.id) {
      return forbiddenResponse();
    }

    return NextResponse.json({
      id: row.record.id,
      userId: row.record.userId,
      userName: row.userName ?? 'Pengguna terhapus',
      userAvatar: row.userImage,
      type: row.record.type,
      timestamp: row.record.timestamp.toISOString(),
      latitude: Number(row.record.latitude),
      longitude: Number(row.record.longitude),
      accuracyMeters: row.record.accuracyMeters ? Number(row.record.accuracyMeters) : null,
      photoUrl: row.record.photoUrl,
      isWithinGeofence: row.record.isWithinGeofence,
      distanceFromCenter: row.record.distanceFromCenter
        ? Number(row.record.distanceFromCenter)
        : 0,
      geofenceName: row.geofenceName,
      notes: row.record.notes,
    });
  } catch (error) {
    console.error('GET /api/attendance/[id] error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
