import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { api, ApiRequestError } from '../api/client';

/**
 * Task background: kirim posisi ke server selama status hadir (clock-in).
 * Server menolak dengan 409 NOT_CLOCKED_IN di luar jam hadir → tracking berhenti.
 * File ini di-import dari index.ts agar task terdaftar sebelum app jalan.
 */
export const LOCATION_TASK = 'geoattend-live-tracking';

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const latest = locations[locations.length - 1];
  if (!latest) return;

  try {
    await api('/api/locations', {
      method: 'POST',
      body: JSON.stringify({
        latitude: latest.coords.latitude,
        longitude: latest.coords.longitude,
        accuracyMeters:
          latest.coords.accuracy != null && latest.coords.accuracy > 0
            ? latest.coords.accuracy
            : undefined,
      }),
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
    timeInterval: 30_000,
    distanceInterval: 25, // di bawah ini = jitter GPS saat diam, tak perlu dikirim

    // Kunci hemat baterai & anti-panas: saat aplikasi di background, Android
    // MENGUMPULKAN posisi lalu mengirimnya sekaligus tiap ~60 dtk. Radio
    // GPS/seluler bisa tidur di antaranya — panas berasal dari radio yang tak
    // pernah sleep, bukan sekadar seberapa sering update.
    deferredUpdatesInterval: 60_000,
    deferredUpdatesDistance: 40,

    // iOS: jeda otomatis saat pengguna diam (posisi toh tak berubah), lanjut
    // saat bergerak — hemat baterai tanpa kehilangan info berarti.
    pausesUpdatesAutomatically: true,
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
