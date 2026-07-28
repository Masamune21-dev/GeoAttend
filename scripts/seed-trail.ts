/**
 * Seed jejak lokasi SINTETIS untuk satu sesi kerja — alat bantu pengembangan
 * agar fitur "Riwayat Lokasi" bisa diuji tanpa benar-benar berkendara.
 *
 * Jalankan: npm run db:seed-trail -- --email budi@contoh.com --date 2026-07-29
 *
 * Prasyarat: karyawan tersebut sudah punya absen masuk (dan idealnya pulang)
 * pada tanggal itu — rute dibangkitkan di antara kedua waktu tersebut.
 *
 * Rute yang dibuat: diam di titik absen → berkendara menjauh → berhenti lama
 * (menghasilkan satu perhentian yang terdeteksi) → kembali ke titik absen.
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

/** Geser koordinat sejauh n meter ke utara & timur. */
function offset(lat: number, lng: number, northM: number, eastM: number) {
  return {
    latitude: lat + northM / 111_320,
    longitude: lng + eastM / (111_320 * Math.cos((lat * Math.PI) / 180)),
  };
}

async function main() {
  const email = arg('email');
  const date = arg('date');
  if (!email || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(
      'Pemakaian: npm run db:seed-trail -- --email <email> --date <yyyy-MM-dd>'
    );
  }

  const { db } = await import('../src/lib/db');
  const { attendanceRecords, locationTrails, user } = await import('../src/lib/db/schema');
  const { buildWorkSessions } = await import('../src/lib/attendance/sessions');
  const { OPEN_SESSION_WINDOW_HOURS } = await import('../src/lib/constants');
  const { and, asc, eq, gte, lte } = await import('drizzle-orm');

  const [target] = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (!target) throw new Error(`Pengguna dengan email ${email} tidak ditemukan`);

  const windowMs = OPEN_SESSION_WINDOW_HOURS * 60 * 60 * 1000;
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const records = await db
    .select({
      type: attendanceRecords.type,
      timestamp: attendanceRecords.timestamp,
      shiftNumber: attendanceRecords.shiftNumber,
      latitude: attendanceRecords.latitude,
      longitude: attendanceRecords.longitude,
    })
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.userId, target.id),
        gte(attendanceRecords.timestamp, new Date(dayStart.getTime() - windowMs)),
        lte(attendanceRecords.timestamp, new Date(dayEnd.getTime() + windowMs))
      )
    )
    .orderBy(asc(attendanceRecords.timestamp));

  const session = buildWorkSessions(records).find((s) => s.date === date && s.clockIn);
  if (!session?.clockIn) {
    throw new Error(`${target.name} tidak punya absen masuk pada ${date}`);
  }

  const start = new Date(session.clockIn.timestamp).getTime();
  const end = session.clockOut
    ? new Date(session.clockOut.timestamp).getTime()
    : start + 8 * 60 * 60 * 1000;
  const durationMs = end - start;
  if (durationMs < 60 * 60 * 1000) {
    throw new Error('Sesi terlalu pendek (< 1 jam) untuk dibuatkan rute sintetis');
  }

  const originLat = Number(session.clockIn.latitude);
  const originLng = Number(session.clockIn.longitude);

  // Fase: diam di kantor → berangkat → berhenti di lokasi → pulang → diam lagi
  const phases = [
    { fraction: 0.2, from: 0, to: 0, stepMinutes: 5 },
    { fraction: 0.15, from: 0, to: 3_000, stepMinutes: 1 },
    { fraction: 0.3, from: 3_000, to: 3_000, stepMinutes: 5 },
    { fraction: 0.15, from: 3_000, to: 0, stepMinutes: 1 },
    { fraction: 0.2, from: 0, to: 0, stepMinutes: 5 },
  ];

  const rows: (typeof locationTrails.$inferInsert)[] = [];
  let cursor = start;

  for (const phase of phases) {
    const phaseMs = durationMs * phase.fraction;
    const stepMs = phase.stepMinutes * 60_000;
    const steps = Math.max(1, Math.round(phaseMs / stepMs));

    for (let i = 0; i < steps; i++) {
      const progress = steps === 1 ? 1 : i / (steps - 1);
      const north = phase.from + (phase.to - phase.from) * progress;
      // Jitter kecil agar menyerupai derau GPS sungguhan
      const jitter = (Math.random() - 0.5) * 20;
      const coords = offset(originLat, originLng, north + jitter, jitter);

      rows.push({
        userId: target.id,
        recordedAt: new Date(cursor + i * stepMs),
        latitude: coords.latitude.toFixed(7),
        longitude: coords.longitude.toFixed(7),
        accuracyMeters: '35.00',
        isMocked: false,
      });
    }
    cursor += phaseMs;
  }

  await db.insert(locationTrails).values(rows).onConflictDoNothing({
    target: [locationTrails.userId, locationTrails.recordedAt],
  });

  console.log(
    `✔ ${rows.length} titik jejak sintetis dibuat untuk ${target.name} pada ${date}`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed jejak gagal:', err);
  process.exit(1);
});
