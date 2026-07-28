/**
 * Pembersih jejak lokasi: hapus baris location_trails yang lebih tua dari
 * TRAIL_RETENTION_DAYS (default 90 hari). Idempotent — aman dijalankan ulang.
 *
 * Jalankan: npm run db:cleanup-trails
 * Override retensi: TRAIL_RETENTION_DAYS=30 npm run db:cleanup-trails
 *
 * Di produksi dijadwalkan systemd timer (lihat docs/05-deployment.md).
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

/** Baris dihapus bertahap agar tidak mengunci tabel lama & meledakkan WAL. */
const BATCH_SIZE = 10_000;

async function main() {
  // Import dinamis setelah env dimuat
  const { db } = await import('../src/lib/db');
  const { locationTrails } = await import('../src/lib/db/schema');
  const { TRAIL_RETENTION_DAYS } = await import('../src/lib/constants');
  const { inArray, lt } = await import('drizzle-orm');

  const days = Number(process.env.TRAIL_RETENTION_DAYS ?? TRAIL_RETENTION_DAYS);
  if (!Number.isFinite(days) || days < 0) {
    throw new Error(`TRAIL_RETENTION_DAYS tidak valid: ${process.env.TRAIL_RETENTION_DAYS}`);
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let total = 0;

  for (;;) {
    // Memakai index location_trails_recorded_idx
    const batch = await db
      .select({ id: locationTrails.id })
      .from(locationTrails)
      .where(lt(locationTrails.recordedAt, cutoff))
      .limit(BATCH_SIZE);

    if (batch.length === 0) break;

    await db.delete(locationTrails).where(
      inArray(
        locationTrails.id,
        batch.map((row) => row.id)
      )
    );
    total += batch.length;
    console.log(`  ... ${total} titik dihapus`);
  }

  console.log(
    `✔ ${total} titik jejak sebelum ${cutoff.toISOString()} dihapus (retensi ${days} hari)`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Pembersihan jejak lokasi gagal:', err);
  process.exit(1);
});
