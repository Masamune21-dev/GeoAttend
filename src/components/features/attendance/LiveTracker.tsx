'use client';

import { useEffect } from 'react';
import { useOpenSession } from '@/hooks/useAttendance';

/** Interval pengiriman posisi live (ms). */
const SEND_INTERVAL_MS = 20_000;

/**
 * Komponen tak terlihat yang mengirim posisi GPS ke server secara berkala
 * SELAMA pengguna berstatus hadir (clock-in tanpa clock-out).
 *
 * Catatan platform web: pengiriman hanya berjalan saat tab/aplikasi terbuka.
 * Browser menghentikan GPS ketika layar terkunci atau app di-background —
 * pelacakan background penuh memerlukan aplikasi mobile native.
 */
export function LiveTracker() {
  const { data: sessionData } = useOpenSession();
  const isPresent = sessionData?.isOpen ?? false;

  useEffect(() => {
    if (!isPresent) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    let cancelled = false;

    const sendPosition = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) return;
          fetch('/api/locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyMeters: position.coords.accuracy || undefined,
            }),
          }).catch(() => {
            // Gagal kirim (offline, dsb.) — diabaikan, dicoba lagi interval berikutnya
          });
        },
        () => {
          // Izin ditolak / GPS mati — diam saja, halaman check-in yang menangani UX izin
        },
        { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 }
      );
    };

    sendPosition(); // kirim segera saat mulai
    const interval = setInterval(sendPosition, SEND_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isPresent]);

  return null;
}
