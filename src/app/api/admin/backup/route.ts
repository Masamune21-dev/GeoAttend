import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  account,
  appSettings,
  attendanceRecords,
  geofences,
  leaveRequests,
  shiftSettings,
  user,
} from '@/lib/db/schema';
import {
  getApiSession,
  isAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/utils';
import { APP_VERSION } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/backup — ekspor seluruh data aplikasi sebagai JSON.
 * Catatan: file foto (uploads/) TIDAK termasuk — backup folder tersebut terpisah.
 * Session & verifikasi sengaja tidak diekspor (ephemeral).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();
    if (!isAdmin(session)) return forbiddenResponse();

    const [users, accounts, geofenceRows, shiftRows, recordRows, settingRows, leaveRows] =
      await Promise.all([
        db.select().from(user),
        db.select().from(account),
        db.select().from(geofences),
        db.select().from(shiftSettings),
        db.select().from(attendanceRecords),
        db.select().from(appSettings),
        db.select().from(leaveRequests),
      ]);

    const backup = {
      version: 1 as const,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        users,
        accounts,
        geofences: geofenceRows,
        shiftSettings: shiftRows,
        attendanceRecords: recordRows,
        appSettings: settingRows,
        leaveRequests: leaveRows,
      },
    };

    const filename = `geoattend-backup-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/backup error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
