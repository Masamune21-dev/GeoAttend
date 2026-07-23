import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { getApiSession, unauthorizedResponse } from '@/lib/auth/utils';
import { saveCoverPhoto, StorageError } from '@/lib/storage/local-fs';
import { UploadCoverSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/profile/cover — upload foto sampul profil pengguna login.
 * Langsung memperbarui kolom users.cover_image (tidak lewat Better Auth
 * update-user karena coverImage bukan field input).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    const parsed = UploadCoverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Foto tidak valid',
          details: parsed.error.flatten(),
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const url = await saveCoverPhoto(parsed.data.photoBase64);
    await db
      .update(user)
      .set({ coverImage: url, updatedAt: new Date() })
      .where(eq(user.id, session.user.id));

    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    if (error instanceof StorageError) {
      return NextResponse.json(
        { code: `PHOTO_${error.code}`, message: error.message, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }
    console.error('POST /api/profile/cover error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
