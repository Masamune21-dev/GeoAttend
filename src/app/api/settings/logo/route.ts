import { NextRequest, NextResponse } from 'next/server';
import {
  getApiSession,
  isAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/utils';
import { saveBrandingLogo, StorageError } from '@/lib/storage/local-fs';
import { UploadLogoSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

/** POST /api/settings/logo — upload logo aplikasi (administrator saja). */
export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();
    if (!isAdmin(session)) return forbiddenResponse();

    const body = await req.json();
    const parsed = UploadLogoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Logo tidak valid',
          details: parsed.error.flatten(),
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const url = await saveBrandingLogo(parsed.data.photoBase64);
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    if (error instanceof StorageError) {
      return NextResponse.json(
        { code: `LOGO_${error.code}`, message: error.message, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }
    console.error('POST /api/settings/logo error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
