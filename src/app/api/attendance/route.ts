import { NextRequest, NextResponse } from 'next/server';
import { and, count, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { attendanceRecords, geofences, liveLocations, shiftSettings, user } from '@/lib/db/schema';
import {
  getApiSession,
  isAdmin,
  unauthorizedResponse,
} from '@/lib/auth/utils';
import { CreateAttendanceSchema, type AttendanceRecordResponse } from '@/types/api';
import { checkGeofence } from '@/lib/geo/validation';
import { pickShift } from '@/lib/shifts/calc';
import { saveAttendancePhoto, StorageError } from '@/lib/storage/local-fs';

export const dynamic = 'force-dynamic';

type AttendanceRow = {
  record: typeof attendanceRecords.$inferSelect;
  userName: string | null;
  userImage: string | null;
  geofenceName: string | null;
};

function toResponse(row: AttendanceRow): AttendanceRecordResponse {
  const { record } = row;
  return {
    id: record.id,
    userId: record.userId,
    userName: row.userName ?? 'Pengguna terhapus',
    userAvatar: row.userImage,
    type: record.type as 'clock_in' | 'clock_out',
    shiftNumber: record.shiftNumber,
    timestamp: record.timestamp.toISOString(),
    latitude: Number(record.latitude),
    longitude: Number(record.longitude),
    accuracyMeters: record.accuracyMeters ? Number(record.accuracyMeters) : null,
    photoUrl: record.photoUrl,
    isWithinGeofence: record.isWithinGeofence,
    distanceFromCenter: record.distanceFromCenter ? Number(record.distanceFromCenter) : 0,
    geofenceName: row.geofenceName,
    notes: record.notes,
  };
}

/**
 * GET /api/attendance
 * Query: ?page=1&limit=20&userId=<id|self>&from=ISO&to=ISO&today=true
 * Karyawan hanya bisa melihat record miliknya sendiri.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const params = req.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page') ?? 1));
    const limit = Math.min(1000, Math.max(1, Number(params.get('limit') ?? 20)));

    let userId = params.get('userId');
    if (userId === 'self') userId = session.user.id;

    // Karyawan non-admin dipaksa hanya melihat record sendiri
    if (!isAdmin(session)) {
      userId = session.user.id;
    }

    const conditions = [];
    if (userId) conditions.push(eq(attendanceRecords.userId, userId));

    if (params.get('today') === 'true') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      conditions.push(gte(attendanceRecords.timestamp, startOfDay));
    } else {
      const from = params.get('from');
      const to = params.get('to');
      if (from) conditions.push(gte(attendanceRecords.timestamp, new Date(from)));
      if (to) conditions.push(lte(attendanceRecords.timestamp, new Date(to)));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalResult] = await Promise.all([
      db
        .select({
          record: attendanceRecords,
          userName: user.name,
          userImage: user.image,
          geofenceName: geofences.name,
        })
        .from(attendanceRecords)
        .leftJoin(user, eq(attendanceRecords.userId, user.id))
        .leftJoin(geofences, eq(attendanceRecords.geofenceId, geofences.id))
        .where(where)
        .orderBy(desc(attendanceRecords.timestamp))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ total: count() }).from(attendanceRecords).where(where),
    ]);

    const total = totalResult[0]?.total ?? 0;

    return NextResponse.json({
      data: rows.map(toResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /api/attendance error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

/**
 * POST /api/attendance
 * Membuat record absensi baru dengan validasi geofence + foto.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    const parsed = CreateAttendanceSchema.safeParse(body);
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

    const input = parsed.data;

    // Cek duplikasi: tidak boleh clock_in dua kali tanpa clock_out (dan sebaliknya)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayRecords = await db
      .select({ type: attendanceRecords.type, shiftNumber: attendanceRecords.shiftNumber })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.userId, session.user.id),
          gte(attendanceRecords.timestamp, startOfDay)
        )
      )
      .orderBy(desc(attendanceRecords.timestamp))
      .limit(1);

    const lastType = todayRecords[0]?.type;
    if (input.type === 'clock_in' && lastType === 'clock_in') {
      return NextResponse.json(
        {
          code: 'DUPLICATE_CHECKIN',
          message: 'Anda sudah absen masuk hari ini',
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }
    if (input.type === 'clock_out' && (lastType === undefined || lastType === 'clock_out')) {
      return NextResponse.json(
        {
          code: 'INVALID_SEQUENCE',
          message: 'Anda harus absen masuk terlebih dahulu',
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }

    // Tentukan shift yang dicatat:
    // - shiftNumber dari klien harus valid untuk role user
    // - clock_out tanpa shiftNumber mewarisi shift dari clock_in hari ini
    // - fallback: shift dengan jam masuk terdekat dari waktu sekarang
    const roleShifts = await db
      .select({
        role: shiftSettings.role,
        shiftNumber: shiftSettings.shiftNumber,
        startTime: shiftSettings.startTime,
        endTime: shiftSettings.endTime,
      })
      .from(shiftSettings)
      .where(eq(shiftSettings.role, session.user.role ?? ''));

    let shiftNumber: number | null = null;
    if (roleShifts.length > 0) {
      if (input.shiftNumber != null) {
        if (!roleShifts.some((s) => s.shiftNumber === input.shiftNumber)) {
          return NextResponse.json(
            {
              code: 'INVALID_SHIFT',
              message: 'Shift yang dipilih tidak tersedia untuk role Anda',
              timestamp: new Date().toISOString(),
            },
            { status: 422 }
          );
        }
        shiftNumber = input.shiftNumber;
      } else if (input.type === 'clock_out' && todayRecords[0]?.shiftNumber != null) {
        shiftNumber = todayRecords[0].shiftNumber;
      } else {
        shiftNumber = pickShift(new Date(), roleShifts)?.shiftNumber ?? null;
      }
    }

    // Validasi geofence
    const activeGeofences = await db
      .select()
      .from(geofences)
      .where(eq(geofences.isActive, true))
      .limit(1);

    const geofence = activeGeofences[0]
      ? {
          id: activeGeofences[0].id,
          name: activeGeofences[0].name,
          latitude: Number(activeGeofences[0].latitude),
          longitude: Number(activeGeofences[0].longitude),
          radiusMeters: Number(activeGeofences[0].radiusMeters),
          isActive: activeGeofences[0].isActive,
        }
      : null;

    const check = checkGeofence(
      input.latitude,
      input.longitude,
      geofence,
      input.accuracyMeters ?? 0
    );

    if (geofence && !check.isInside) {
      return NextResponse.json(
        {
          code: 'GEOFENCE_VIOLATION',
          message: `Anda berada di luar area absensi (jarak: ${Math.round(check.distanceMeters)}m)`,
          details: { distance: `${Math.round(check.distanceMeters)}m` },
          timestamp: new Date().toISOString(),
        },
        { status: 422 }
      );
    }

    // Simpan foto
    const photoUrl = await saveAttendancePhoto(input.photoBase64);

    const inserted = await db
      .insert(attendanceRecords)
      .values({
        userId: session.user.id,
        type: input.type,
        shiftNumber,
        latitude: String(input.latitude),
        longitude: String(input.longitude),
        accuracyMeters: input.accuracyMeters != null ? String(input.accuracyMeters) : null,
        photoUrl,
        geofenceId: check.geofenceId,
        isWithinGeofence: check.isInside,
        distanceFromCenter: String(check.distanceMeters),
        notes: input.notes ?? null,
        metadata: {
          userAgent: req.headers.get('user-agent') ?? undefined,
        },
      })
      .returning();

    // Sinkronkan posisi live: mulai lacak saat clock-in, hapus saat clock-out
    if (input.type === 'clock_in') {
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
    } else {
      await db.delete(liveLocations).where(eq(liveLocations.userId, session.user.id));
    }

    const record = inserted[0];
    return NextResponse.json(
      toResponse({
        record,
        userName: session.user.name,
        userImage: session.user.image ?? null,
        geofenceName: check.geofenceName,
      }),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof StorageError) {
      return NextResponse.json(
        { code: `PHOTO_${error.code}`, message: error.message, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }
    console.error('POST /api/attendance error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
