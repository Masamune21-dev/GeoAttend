import { describe, expect, it } from 'vitest';
import { detectStops } from '@/lib/geo/stops';

const BASE = new Date('2026-07-29T08:00:00.000Z').getTime();

/** Bantu bikin titik: menit ke-n sejak BASE, dengan pergeseran meter ke utara. */
function point(minutes: number, northMeters = 0, eastMeters = 0) {
  return {
    latitude: -6.2 + northMeters / 111_320,
    longitude: 106.85 + eastMeters / (111_320 * Math.cos((-6.2 * Math.PI) / 180)),
    recordedAt: new Date(BASE + minutes * 60_000).toISOString(),
  };
}

describe('detectStops', () => {
  it('tidak menemukan perhentian pada perjalanan lurus tanpa berhenti', () => {
    // Bergerak 500 m tiap 5 menit — selalu keluar radius 100 m
    const points = [0, 5, 10, 15, 20].map((m) => point(m, m * 100));
    expect(detectStops(points)).toEqual([]);
  });

  it('mendeteksi satu perhentian panjang dan melaporkan durasinya', () => {
    // Diam di tempat (jitter ±10 m) selama 25 menit, heartbeat tiap 5 menit
    const points = [0, 5, 10, 15, 20, 25].map((m) => point(m, m % 2 === 0 ? 10 : -10));
    const stops = detectStops(points);

    expect(stops).toHaveLength(1);
    expect(stops[0].durationMinutes).toBe(25);
    expect(stops[0].pointCount).toBe(6);
    expect(stops[0].startedAt).toBe(new Date(BASE).toISOString());
  });

  it('memisahkan dua perhentian yang diselingi perjalanan', () => {
    const points = [
      point(0, 0),
      point(5, 5),
      point(10, 0), // perhentian 1 (10 menit)
      point(15, 3_000), // berpindah jauh
      point(20, 3_005),
      point(30, 3_000), // perhentian 2 (15 menit)
    ];
    const stops = detectStops(points);

    expect(stops).toHaveLength(2);
    expect(stops[0].durationMinutes).toBe(10);
    expect(stops[1].durationMinutes).toBe(15);
    // Posisi perhentian kedua ~3 km di utara perhentian pertama
    expect(stops[1].latitude).toBeGreaterThan(stops[0].latitude);
  });

  it('mengabaikan berhenti singkat (macet / lampu merah)', () => {
    // Diam 6 menit saja — di bawah ambang 10 menit
    const points = [point(0), point(3), point(6), point(11, 2_000)];
    expect(detectStops(points)).toEqual([]);
  });

  it('menghitung centroid, bukan titik pertama', () => {
    const points = [point(0, 0), point(10, 60), point(20, 0)];
    const [stop] = detectStops(points);

    expect(stop).toBeDefined();
    // Centroid dari 0, 60, 0 meter ke utara = 20 meter ke utara
    expect(stop.latitude).toBeCloseTo(-6.2 + 20 / 111_320, 6);
  });

  it('menghormati ambang khusus yang diberikan pemanggil', () => {
    const points = [point(0), point(5), point(10)];
    expect(detectStops(points, { minDurationMs: 20 * 60_000 })).toEqual([]);
    expect(detectStops(points, { minDurationMs: 5 * 60_000 })).toHaveLength(1);
  });

  it('aman untuk masukan kosong atau satu titik', () => {
    expect(detectStops([])).toEqual([]);
    expect(detectStops([point(0)])).toEqual([]);
  });
});
