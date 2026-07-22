import { mkdir, writeFile, readFile, readdir, stat, rm } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
const MAX_SIZE_BYTES = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 5) * 1024 * 1024;

export class StorageError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_FORMAT' | 'TOO_LARGE' | 'NOT_FOUND' | 'FORBIDDEN_PATH'
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Simpan foto absensi dari data URI base64 (JPEG) ke filesystem lokal.
 * File di-rename menjadi UUID untuk mencegah tebakan nama file.
 * @returns path URL relatif untuk disimpan di DB, contoh: "/api/uploads/attendance/<uuid>.jpg"
 */
export async function saveAttendancePhoto(photoBase64: string): Promise<string> {
  const match = photoBase64.match(/^data:image\/jpeg;base64,(.+)$/);
  if (!match) {
    throw new StorageError('Format foto harus JPEG (data URI base64)', 'INVALID_FORMAT');
  }

  const buffer = Buffer.from(match[1], 'base64');
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new StorageError(
      `Ukuran foto melebihi batas ${MAX_SIZE_BYTES / 1024 / 1024}MB`,
      'TOO_LARGE'
    );
  }

  // Verifikasi magic bytes JPEG (FF D8 FF)
  if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
    throw new StorageError('File bukan JPEG yang valid', 'INVALID_FORMAT');
  }

  const dir = path.join(UPLOAD_ROOT, 'attendance');
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.jpg`;
  await writeFile(path.join(dir, filename), buffer);

  return `/api/uploads/attendance/${filename}`;
}

/**
 * Simpan foto profil (JPEG, sudah di-resize client-side ke 400px).
 * @returns URL relatif, contoh: "/api/uploads/avatars/<uuid>.jpg"
 */
export async function saveAvatarPhoto(photoBase64: string): Promise<string> {
  const match = photoBase64.match(/^data:image\/jpeg;base64,(.+)$/);
  if (!match) {
    throw new StorageError('Format foto harus JPEG (data URI base64)', 'INVALID_FORMAT');
  }

  const buffer = Buffer.from(match[1], 'base64');
  const maxAvatarBytes = 2 * 1024 * 1024;
  if (buffer.length > maxAvatarBytes) {
    throw new StorageError('Ukuran foto profil maksimal 2MB', 'TOO_LARGE');
  }
  if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
    throw new StorageError('File bukan JPEG yang valid', 'INVALID_FORMAT');
  }

  const dir = path.join(UPLOAD_ROOT, 'avatars');
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.jpg`;
  await writeFile(path.join(dir, filename), buffer);

  return `/api/uploads/avatars/${filename}`;
}

/**
 * Simpan logo aplikasi (PNG/JPEG, maks 1MB).
 * @returns URL relatif: "/api/uploads/branding/logo-<uuid>.<ext>"
 */
export async function saveBrandingLogo(photoBase64: string): Promise<string> {
  const match = photoBase64.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!match) {
    throw new StorageError('Logo harus PNG atau JPEG (data URI base64)', 'INVALID_FORMAT');
  }

  const format = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 1024 * 1024) {
    throw new StorageError('Ukuran logo maksimal 1MB', 'TOO_LARGE');
  }

  const isPng =
    buffer.length > 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const isJpeg =
    buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if ((format === 'png' && !isPng) || (format === 'jpeg' && !isJpeg)) {
    throw new StorageError('File bukan gambar yang valid', 'INVALID_FORMAT');
  }

  const dir = path.join(UPLOAD_ROOT, 'branding');
  await mkdir(dir, { recursive: true });

  const filename = `logo-${randomUUID()}.${format === 'png' ? 'png' : 'jpg'}`;
  await writeFile(path.join(dir, filename), buffer);

  return `/api/uploads/branding/${filename}`;
}

/** Hitung total ukuran direktori uploads (byte), rekursif. */
export async function getUploadsSizeBytes(): Promise<number> {
  async function sizeOf(dir: string): Promise<number> {
    let total = 0;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return 0;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += await sizeOf(fullPath);
      } else {
        try {
          total += (await stat(fullPath)).size;
        } catch {
          // file hilang di tengah scan — abaikan
        }
      }
    }
    return total;
  }
  return sizeOf(UPLOAD_ROOT);
}

/** Hapus seluruh foto absensi (dipakai fitur reset data). */
export async function clearAttendancePhotos(): Promise<void> {
  const dir = path.join(UPLOAD_ROOT, 'attendance');
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

/**
 * Baca file upload dengan proteksi path traversal.
 */
export async function readUploadedFile(segments: string[]): Promise<Buffer> {
  const filePath = path.resolve(UPLOAD_ROOT, ...segments);

  if (!filePath.startsWith(UPLOAD_ROOT + path.sep)) {
    throw new StorageError('Path tidak diizinkan', 'FORBIDDEN_PATH');
  }

  try {
    return await readFile(filePath);
  } catch {
    throw new StorageError('File tidak ditemukan', 'NOT_FOUND');
  }
}
