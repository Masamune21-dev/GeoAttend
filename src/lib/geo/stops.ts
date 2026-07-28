import { haversineDistance } from '@/lib/geo/distance';
import { STOP_MIN_DURATION_MS, STOP_RADIUS_M } from '@/lib/constants';
import type { TrailStopResponse } from '@/types/api';

/** Bentuk minimal titik jejak yang dibutuhkan deteksi berhenti. */
export interface StopCandidatePoint {
  latitude: number;
  longitude: number;
  recordedAt: string; // ISO 8601
}

/**
 * Deteksi "titik berhenti" ala Google Maps Timeline (stay-point detection):
 * rentetan titik yang semuanya berada dalam `radiusMeters` dari titik pertama
 * rentetan DAN berlangsung minimal `minDurationMs`. Posisi berhenti dilaporkan
 * sebagai centroid rentetan agar tidak terpaku pada satu fix yang kebetulan
 * paling meleset.
 *
 * Titik masukan harus sudah terurut kronologis.
 */
export function detectStops(
  points: StopCandidatePoint[],
  options: { radiusMeters?: number; minDurationMs?: number } = {}
): TrailStopResponse[] {
  const radiusMeters = options.radiusMeters ?? STOP_RADIUS_M;
  const minDurationMs = options.minDurationMs ?? STOP_MIN_DURATION_MS;

  const stops: TrailStopResponse[] = [];
  let i = 0;

  while (i < points.length) {
    // Perluas rentetan selama titik berikutnya masih "di tempat yang sama"
    let j = i + 1;
    while (
      j < points.length &&
      haversineDistance(
        points[i].latitude,
        points[i].longitude,
        points[j].latitude,
        points[j].longitude
      ) <= radiusMeters
    ) {
      j++;
    }

    const startMs = new Date(points[i].recordedAt).getTime();
    const endMs = new Date(points[j - 1].recordedAt).getTime();
    const durationMs = endMs - startMs;

    if (j - i >= 2 && durationMs >= minDurationMs) {
      const slice = points.slice(i, j);
      stops.push({
        latitude: slice.reduce((sum, p) => sum + p.latitude, 0) / slice.length,
        longitude: slice.reduce((sum, p) => sum + p.longitude, 0) / slice.length,
        startedAt: points[i].recordedAt,
        endedAt: points[j - 1].recordedAt,
        durationMinutes: Math.round(durationMs / 60_000),
        pointCount: slice.length,
      });
      i = j; // lanjut setelah rentetan yang sudah jadi satu perhentian
    } else {
      i++; // bukan perhentian — geser satu titik dan coba lagi
    }
  }

  return stops;
}
