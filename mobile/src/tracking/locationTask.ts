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

/** Mulai tracking (setelah clock-in). Butuh izin lokasi background. */
export async function startTracking(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return false;

  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return true;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 20_000, // selaras dengan web (20 detik)
    distanceInterval: 15,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'GeoAttend',
      notificationBody: 'Pelacakan posisi aktif selama jam kerja',
      notificationColor: '#2563EB',
    },
  });
  return true;
}

/** Hentikan tracking (setelah clock-out / logout). */
export async function stopTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}
