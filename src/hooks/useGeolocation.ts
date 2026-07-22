'use client';

import { useEffect } from 'react';
import { useLocationStore } from '@/stores/useLocationStore';

/**
 * Hook untuk melacak posisi GPS pengguna secara real-time
 * menggunakan navigator.geolocation.watchPosition.
 */
export function useGeolocation(enabled = true) {
  const { coords, error, permission, setCoords, setError, setPermission, setTracking } =
    useLocationStore();

  useEffect(() => {
    if (!enabled) return;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Browser Anda tidak mendukung geolokasi');
      return;
    }

    // Pantau status izin bila API tersedia
    if (navigator.permissions) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          setPermission(status.state as 'granted' | 'denied' | 'prompt');
          status.onchange = () => {
            setPermission(status.state as 'granted' | 'denied' | 'prompt');
          };
        })
        .catch(() => setPermission('unknown'));
    }

    setTracking(true);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermission('denied');
          setError('Izin lokasi ditolak. Aktifkan di pengaturan browser.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('Lokasi tidak tersedia. Pastikan GPS aktif.');
        } else {
          setError('Gagal mendapatkan lokasi. Coba lagi.');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setTracking(false);
    };
  }, [enabled, setCoords, setError, setPermission, setTracking]);

  return { coords, error, permission };
}
