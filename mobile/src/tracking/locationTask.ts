import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { api, ApiRequestError } from '../api/client';
import type { LocationPointInput } from '../api/types';

/**
 * Task background: kirim posisi ke server selama status hadir (clock-in).
 * Server menolak dengan 409 NOT_CLOCKED_IN di luar jam hadir → tracking berhenti.
 * File ini di-import dari index.ts agar task terdaftar sebelum app jalan.
 */
export const LOCATION_TASK = 'geoattend-live-tracking';

/** Fix dengan akurasi lebih buruk dari ini dibuang sebelum dikirim (meter). */
const MAX_ACCURACY_M = 150;

/** Batas titik per request — sesuai kontrak POST /api/locations. */
const MAX_POINTS_PER_REQUEST = 60;

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  // SELURUH batch dikirim. Sebelumnya hanya titik terakhir yang dipakai dan
  // sisanya dibuang — padahal Android mengumpulkan fix selama beberapa menit
  // sebelum membangunkan aplikasi, jadi justru titik-titik itulah jejak
  // perjalanan karyawan.
  const points: LocationPointInput[] = locations
    .filter((l) => l.coords.accuracy == null || l.coords.accuracy <= MAX_ACCURACY_M)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_POINTS_PER_REQUEST)
    .map((l) => ({
      latitude: l.coords.latitude,
      longitude: l.coords.longitude,
      accuracyMeters:
        l.coords.accuracy != null && l.coords.accuracy > 0 ? l.coords.accuracy : undefined,
      // Android saja: menandai aplikasi fake GPS agar admin tidak tertipu
      isMocked: l.mocked === true,
      recordedAt: new Date(l.timestamp).toISOString(),
    }));

  if (points.length === 0) return;

  try {
    await api('/api/locations', {
      method: 'POST',
      body: JSON.stringify({ points }),
    });
  } catch (err) {
    // Sudah pulang / session habis → hentikan tracking (hemat baterai & privasi)
    if (
      err instanceof ApiRequestError &&
      (err.code === 'NOT_CLOCKED_IN' || err.status === 401)
    ) {
      await stopTracking();
    }
    // Error jaringan: biarkan — kiriman berikutnya akan mencoba lagi
  }
});

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Tunggu sampai aplikasi benar-benar di foreground. Penting: setelah user
 * kembali dari halaman Pengaturan (izin background), activity butuh waktu
 * untuk resume — memulai foreground service saat masih transisi menyebabkan
 * FORCE CLOSE di Android 12+ (ForegroundServiceStartNotAllowedException).
 */
async function waitUntilActive(timeoutMs = 10_000): Promise<void> {
  if (AppState.currentState === 'active') return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      sub.remove();
      resolve();
    }, timeoutMs);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearTimeout(timer);
        sub.remove();
        resolve();
      }
    });
  });
}

async function startUpdates(): Promise<void> {
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    // Balanced = ~100m via WiFi/seluler, GPS chip jarang menyala (jauh lebih
    // hemat & dingin dari High). Cukup untuk memantau "masih di lokasi kerja".
    accuracy: Location.Accuracy.Balanced,

    // KUNCI HEARTBEAT (timeInterval hanya berlaku di Android): distanceInterval
    // 0 = tanpa filter jarak, jadi fix tetap datang walau karyawan diam total.
    // Nilai 25 yang lama justru MEMBUNUH heartbeat — HP diam berarti nol update,
    // server kehilangan jejak, dan marker di live map dianggap kedaluwarsa.
    timeInterval: 60_000,
    distanceInterval: 0,

    // Kunci hemat baterai & anti-panas: saat aplikasi di background, Android
    // MENGUMPULKAN posisi lalu mengirimnya sekaligus tiap ~5 menit. Radio
    // jaringan hanya bangun ~12x/jam, bukan 60x/jam — panas berasal dari radio
    // yang tak pernah sleep, bukan sekadar seberapa sering fix diambil.
    // Batch inilah yang sekarang dikirim utuh sebagai jejak perjalanan.
    deferredUpdatesInterval: 300_000,
    deferredUpdatesDistance: 200,

    // iOS: WAJIB false. Jeda otomatis menghentikan update saat pengguna diam —
    // persis kebalikan dari heartbeat "masih di lokasi ini" yang kita butuhkan.
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Other,

    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'GeoAttend',
      notificationBody: 'Pelacakan posisi aktif selama jam kerja',
      notificationColor: '#2563EB',
    },
  });
}

/**
 * Mulai tracking (setelah clock-in). Butuh izin lokasi background.
 * Tidak pernah melempar error — kegagalan mengembalikan false agar
 * absensi tetap tercatat walau pelacakan gagal aktif.
 */
export async function startTracking(): Promise<boolean> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return false;

    // Setelah request izin, user mungkin baru kembali dari halaman Pengaturan —
    // tunggu app aktif + beri jeda agar activity selesai resume.
    await waitUntilActive();
    await sleep(800);

    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return true;
    await startUpdates();
    return true;
  } catch {
    // Percobaan kedua setelah jeda lebih panjang (transisi belum selesai)
    try {
      await sleep(2500);
      await waitUntilActive();
      if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return true;
      await startUpdates();
      return true;
    } catch {
      return false;
    }
  }
}

/** Hentikan tracking (setelah clock-out / logout). Tidak pernah melempar. */
export async function stopTracking(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {
    // abaikan — service mungkin sudah mati
  }
}
