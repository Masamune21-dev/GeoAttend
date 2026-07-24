import { NextResponse } from 'next/server';

/** Respons error JSON konsisten: { code, message, ...extra, timestamp }. */
export function errorJson(
  code: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    { code, message, ...extra, timestamp: new Date().toISOString() },
    { status }
  );
}

export function validationError(details: unknown) {
  return errorJson('VALIDATION_ERROR', 'Data tidak valid', 400, { details });
}

export function internalError(err: unknown, context: string) {
  console.error(`${context}:`, err);
  return errorJson('INTERNAL_ERROR', 'Terjadi kesalahan sistem', 500);
}

/** Kode error unik Postgres (mis. 23505 = pelanggaran UNIQUE). */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}
