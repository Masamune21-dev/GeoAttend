import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { APP_NAME } from '@/lib/constants';

export interface AppSettings {
  appName: string;
  logoUrl: string | null;
}

/**
 * Ambil pengaturan aplikasi (nama & logo) dari DB dengan fallback default.
 * Aman dipanggil dari server component; bila DB down, kembalikan default.
 */
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const rows = await db.select().from(appSettings);
    const map = new Map(rows.map((row) => [row.key, row.value]));
    return {
      appName: map.get('app_name') ?? APP_NAME,
      logoUrl: map.get('app_logo') ?? null,
    };
  } catch {
    return { appName: APP_NAME, logoUrl: null };
  }
}
