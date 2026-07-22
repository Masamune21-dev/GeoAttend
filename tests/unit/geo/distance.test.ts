import { describe, expect, it } from 'vitest';
import { formatDistance, haversineDistance } from '@/lib/geo/distance';
import { checkGeofence } from '@/lib/geo/validation';

describe('haversineDistance', () => {
  it('mengembalikan 0 untuk titik yang sama', () => {
    expect(haversineDistance(-6.2, 106.8, -6.2, 106.8)).toBe(0);
  });

  it('menghitung jarak Monas → Bundaran HI (~2.2km) dengan toleransi 5%', () => {
    // Monas: -6.1754, 106.8272 | Bundaran HI: -6.1950, 106.8230
    const distance = haversineDistance(-6.1754, 106.8272, -6.195, 106.823);
    expect(distance).toBeGreaterThan(2000);
    expect(distance).toBeLessThan(2400);
  });

  it('simetris terhadap urutan argumen', () => {
    const a = haversineDistance(-6.2, 106.8, -6.21, 106.81);
    const b = haversineDistance(-6.21, 106.81, -6.2, 106.8);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('checkGeofence', () => {
  const geofence = {
    id: 'gf-1',
    name: 'Kantor',
    latitude: -6.2087634,
    longitude: 106.845599,
    radiusMeters: 100,
    isActive: true,
  };

  it('menerima titik tepat di pusat geofence', () => {
    const result = checkGeofence(geofence.latitude, geofence.longitude, geofence);
    expect(result.isInside).toBe(true);
    expect(result.distanceMeters).toBe(0);
  });

  it('menolak titik jauh di luar radius', () => {
    const result = checkGeofence(-6.3, 106.9, geofence);
    expect(result.isInside).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(1000);
  });

  it('memberi toleransi akurasi GPS di tepi geofence (maks 50m)', () => {
    // Titik ~120m dari pusat, akurasi 30m -> masih diterima (100 + 30 >= 120)
    const nearEdge = checkGeofence(-6.2087634 + 0.00108, 106.845599, geofence, 30);
    expect(nearEdge.distanceMeters).toBeGreaterThan(100);
    expect(nearEdge.isInside).toBe(true);

    // Akurasi 500m tidak boleh membuka celah lebih dari 50m
    const farPoint = checkGeofence(-6.2087634 + 0.002, 106.845599, geofence, 500);
    expect(farPoint.isInside).toBe(false);
  });

  it('mengembalikan isInside=false bila geofence null', () => {
    const result = checkGeofence(-6.2, 106.8, null);
    expect(result.isInside).toBe(false);
    expect(result.geofenceId).toBeNull();
  });
});

describe('formatDistance', () => {
  it('format meter untuk jarak < 1km', () => {
    expect(formatDistance(45.2)).toBe('45 m');
  });

  it('format km dengan koma desimal (locale ID)', () => {
    expect(formatDistance(1520)).toBe('1,52 km');
  });
});
