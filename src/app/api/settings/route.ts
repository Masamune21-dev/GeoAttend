import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { getAppSettings } from '@/lib/settings';
import {
  getApiSession,
  isAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/utils';
import { UpdateAppSettingsSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

/** GET /api/settings — nama & logo aplikasi (publik: dipakai halaman login). */
export async function GET() {
  const settings = await getAppSettings();
  return NextResponse.json(settings);
}

/** PUT /api/settings — ubah nama/logo aplikasi (administrator saja). */
export async function PUT(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();
    if (!isAdmin(session)) return forbiddenResponse();

    const body = await req.json();
    const parsed = UpdateAppSettingsSchema.safeParse(body);
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

    const upsert = async (key: string, value: string) => {
      await db
        .insert(appSettings)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value, updatedAt: new Date() },
        });
    };

    if (parsed.data.appName !== undefined) {
      await upsert('app_name', parsed.data.appName.trim());
    }
    if (parsed.data.logoUrl !== undefined && parsed.data.logoUrl !== null) {
      await upsert('app_logo', parsed.data.logoUrl);
    }

    return NextResponse.json(await getAppSettings());
  } catch (error) {
    console.error('PUT /api/settings error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
