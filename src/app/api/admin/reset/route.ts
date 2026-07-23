import { NextRequest, NextResponse } from 'next/server';
import { ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { attendanceRecords, leaveRequests, liveLocations, user } from '@/lib/db/schema';
import {
  getApiSession,
  isAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/utils';
import { clearAttendancePhotos } from '@/lib/storage/local-fs';
import { ResetDataSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/reset — reset data (administrator saja, wajib konfirmasi "RESET").
 * scope "attendance": hapus semua record absensi + posisi live + file foto.
 * scope "users": hapus semua pengguna KECUALI administrator (cascade ke datanya).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();
    if (!isAdmin(session)) return forbiddenResponse();

    const body = await req.json();
    const parsed = ResetDataSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Konfirmasi reset tidak valid',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (parsed.data.scope === 'attendance') {
      await db.transaction(async (tx) => {
        await tx.delete(liveLocations);
        await tx.delete(leaveRequests);
        await tx.delete(attendanceRecords);
      });
      await clearAttendancePhotos();
      return NextResponse.json({
        success: true,
        message: 'Semua data absensi, izin, dan foto berhasil dihapus',
      });
    }

    // scope === 'users': hapus semua non-administrator (cascade: accounts,
    // sessions, attendance, live location ikut terhapus)
    const deleted = await db
      .delete(user)
      .where(ne(user.role, 'administrator'))
      .returning({ id: user.id });

    return NextResponse.json({
      success: true,
      message: `${deleted.length} pengguna non-administrator berhasil dihapus`,
    });
  } catch (error) {
    console.error('POST /api/admin/reset error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
