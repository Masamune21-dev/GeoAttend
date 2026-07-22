import { NextRequest, NextResponse } from 'next/server';
import { getApiSession, unauthorizedResponse } from '@/lib/auth/utils';
import { readUploadedFile, StorageError } from '@/lib/storage/local-fs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/uploads/[...path]
 * Menyajikan file upload dari direktori di luar /public.
 * - branding/ (logo aplikasi): publik — dipakai halaman login
 * - lainnya (foto absensi, avatar): wajib login
 */
export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const isPublicBranding = params.path[0] === 'branding';

  if (!isPublicBranding) {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();
  }

  try {
    const buffer = await readUploadedFile(params.path);
    const isPng = params.path[params.path.length - 1]?.toLowerCase().endsWith('.png');
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': isPng ? 'image/png' : 'image/jpeg',
        'Cache-Control': isPublicBranding
          ? 'public, max-age=86400'
          : 'private, max-age=86400',
      },
    });
  } catch (error) {
    if (error instanceof StorageError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 403;
      return NextResponse.json(
        { code: error.code, message: error.message, timestamp: new Date().toISOString() },
        { status }
      );
    }
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
