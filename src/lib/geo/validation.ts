import { haversineDistance } from './distance';
import type { GeofenceCheckResult, GeofenceData } from './types';

/**
 * Memeriksa apakah sebuah koordinat berada di dalam geofence.
 * Toleransi akurasi GPS ditambahkan ke radius agar pengguna di tepi
 * geofence dengan sinyal GPS kurang akurat tidak tertolak secara tidak adil.
 */
export function checkGeofence(
  latitude: number,
  longitude: number,
  geofence: GeofenceData | null,
  accuracyMeters = 0
): GeofenceCheckResult {
  if (!geofence) {
    return {
      isInside: false,
      distanceMeters: 0,
      geofenceId: null,
      geofenceName: null,
    };
  }

  const distance = haversineDistance(
    latitude,
    longitude,
    geofence.latitude,
    geofence.longitude
  );

  // Buffer akurasi dibatasi maksimal 50m agar tidak bisa dieksploitasi
  const accuracyBuffer = Math.min(Math.max(accuracyMeters, 0), 50);

  return {
    isInside: distance <= geofence.radiusMeters + accuracyBuffer,
    distanceMeters: Math.round(distance * 100) / 100,
    geofenceId: geofence.id,
    geofenceName: geofence.name,
  };
}
