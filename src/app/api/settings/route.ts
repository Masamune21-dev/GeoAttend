import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { getAppSettings, getRegistrationCode } from '@/lib/settings';
import {
  getApiSession,
  isAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/utils';
import { UpdateAppSettingsSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings — nama & logo aplikasi (publik: dipakai halaman login).
 * Kode pendaftaran HANYA disertakan untuk administrator.
 */
export async function GET(req: NextRequest) {
  const settings = await getAppSettings();
  const session = await getApiSession(req);
  if (isAdmin(session)) {
    return NextResponse.json({
      ...settings,
      registrationCode: await getRegistrationCode(),
    });
  }
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
    if (parsed.data.registrationCode !== undefined) {
      const code = parsed.data.registrationCode?.trim() ?? '';
      if (code) {
        await upsert('registration_code', code);
      } else {
        // Kosong = tutup pendaftaran
        await db.delete(appSettings).where(eq(appSettings.key, 'registration_code'));
      }
    }

    return NextResponse.json({
      ...(await getAppSettings()),
      registrationCode: await getRegistrationCode(),
    });
  } catch (error) {
    console.error('PUT /api/settings error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
