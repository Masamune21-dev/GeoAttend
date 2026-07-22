/**
 * Seed database: membuat akun admin pertama + geofence default.
 * Jalankan: npm run db:seed
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@geoattend.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'Administrator';

async function main() {
  // Import dinamis setelah env dimuat
  const { auth } = await import('../src/lib/auth');
  const { db } = await import('../src/lib/db');
  const { user, geofences, shiftSettings } = await import('../src/lib/db/schema');
  const { DEFAULT_SHIFTS } = await import('../src/lib/constants');
  const { eq } = await import('drizzle-orm');

  // 1. Buat admin bila belum ada
  const existingAdmin = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, ADMIN_EMAIL))
    .limit(1);

  if (existingAdmin.length === 0) {
    await auth.api.signUpEmail({
      body: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      },
    });
    await db.update(user).set({ role: 'administrator' }).where(eq(user.email, ADMIN_EMAIL));
    console.log(`✔ Administrator dibuat: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    // Pastikan akun seed selalu ber-role administrator (pengelola sistem)
    await db.update(user).set({ role: 'administrator' }).where(eq(user.email, ADMIN_EMAIL));
    console.log(`• Administrator sudah ada: ${ADMIN_EMAIL}`);
  }

  // 2. Buat geofence default bila belum ada
  const existingGeofence = await db.select({ id: geofences.id }).from(geofences).limit(1);

  if (existingGeofence.length === 0) {
    await db.insert(geofences).values({
      name: 'Kantor Pusat',
      latitude: process.env.NEXT_PUBLIC_DEFAULT_LAT ?? '-6.2087634',
      longitude: process.env.NEXT_PUBLIC_DEFAULT_LNG ?? '106.8455990',
      radiusMeters: process.env.DEFAULT_GEOFENCE_RADIUS_M ?? '100',
      isActive: true,
    });
    console.log('✔ Geofence default dibuat (radius 100m)');
  } else {
    console.log('• Geofence sudah ada');
  }

  // 3. Buat jam kerja SOP default bila belum ada
  const existingShifts = await db.select({ id: shiftSettings.id }).from(shiftSettings).limit(1);

  if (existingShifts.length === 0) {
    await db.insert(shiftSettings).values(
      DEFAULT_SHIFTS.map((shift) => ({
        role: shift.role,
        shiftNumber: shift.shiftNumber,
        startTime: shift.startTime,
        endTime: shift.endTime,
      }))
    );
    console.log('✔ Jam kerja SOP default dibuat (admin/noc 2 shift, teknisi 1 shift)');
  } else {
    console.log('• Jam kerja SOP sudah ada');
  }

  console.log('Seed selesai.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed gagal:', err);
  process.exit(1);
});
