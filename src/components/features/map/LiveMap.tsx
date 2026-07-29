'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AttendanceRecordResponse, GeofenceResponse } from '@/types/api';
import { getInitials, formatTime } from '@/lib/utils';
import { formatDistance } from '@/lib/geo/distance';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_ZOOM_LEVEL,
  FOCUS_ZOOM_LEVEL,
} from '@/lib/constants';

/**
 * Asal koordinat marker — menentukan warna, isi popup, dan legenda.
 *
 * 'stale' penting: karyawan yang berhenti bergerak berhenti mengirim posisi
 * (GPS tak menghasilkan update saat diam), tapi posisi terakhirnya tetap yang
 * PALING BENAR. Marker bertahan di sana, hanya labelnya berubah.
 */
export type LivePositionSource =
  | 'live' // posisi pelacakan yang masih segar
  | 'stale' // posisi live TERAKHIR yang diketahui
  | 'attendance'; // belum pernah mengirim posisi live → koordinat saat absen

export interface LiveMarkerData extends AttendanceRecordResponse {
  positionSource: LivePositionSource;
  /** waktu update posisi live terakhir (ISO); tidak ada untuk 'attendance' */
  lastUpdate?: string;
}

interface LiveMapProps {
  records: LiveMarkerData[];
  geofence: GeofenceResponse | null;
  showGeofence?: boolean;
  /** Karyawan yang sedang disorot dari daftar samping. */
  selectedUserId?: string | null;
  /**
   * Naik setiap kali daftar samping minta peta memusat ulang. Dipakai (bukan
   * `selectedUserId`) supaya klik berulang pada orang yang sama tetap memusatkan
   * peta setelah admin menggeser petanya.
   */
  focusNonce?: number;
  onSelectUser?: (userId: string) => void;
}

function createMarkerIcon(
  name: string,
  isWithinGeofence: boolean,
  source: LivePositionSource,
  avatar?: string | null,
  isSelected = false
) {
  const modifiers = [
    source === 'live' ? ' geoattend-marker--live' : '',
    source === 'stale' ? ' geoattend-marker--stale' : '',
    // Berlaku untuk SEMUA sumber posisi: statusnya dihitung dari koordinat yang
    // benar-benar dipakai marker, bukan lagi dari titik absen.
    !isWithinGeofence ? ' geoattend-marker--outside' : '',
    isSelected ? ' geoattend-marker--selected' : '',
  ].join('');
  // Foto profil sebagai isi marker bila ada; jika tidak, pakai inisial.
  const style = avatar
    ? ` style="background-image:url('${avatar}');background-size:cover;background-position:center;color:transparent"`
    : '';
  return L.divIcon({
    className: '',
    html: `<div class="geoattend-marker${modifiers}"${style}>${getInitials(name)}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

/**
 * Memusatkan peta ke karyawan terpilih saat `nonce` berubah.
 *
 * Sengaja TIDAK ikut bereaksi pada perubahan koordinat: posisi live di-poll
 * berkala, dan memusatkan ulang tiap poll akan melawan admin yang sedang
 * menggeser peta.
 */
function FocusOnSelected({ target, nonce }: { target?: LiveMarkerData; nonce: number }) {
  const map = useMap();
  const targetRef = useRef(target);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    const focus = targetRef.current;
    if (!focus) return;
    map.flyTo([focus.latitude, focus.longitude], Math.max(map.getZoom(), FOCUS_ZOOM_LEVEL), {
      duration: 0.6,
    });
  }, [nonce, map]);

  return null;
}

/**
 * Peta live absensi + pelacakan posisi karyawan di lapangan.
 * Harus di-load dengan next/dynamic { ssr: false }.
 */
export default function LiveMap({
  records,
  geofence,
  showGeofence = true,
  selectedUserId = null,
  focusNonce = 0,
  onSelectUser,
}: LiveMapProps) {
  const center = useMemo<[number, number]>(() => {
    if (geofence) return [geofence.latitude, geofence.longitude];
    if (records[0]) return [records[0].latitude, records[0].longitude];
    return DEFAULT_MAP_CENTER;
  }, [geofence, records]);

  return (
    <MapContainer
      center={center}
      zoom={DEFAULT_ZOOM_LEVEL}
      scrollWheelZoom
      className="h-full w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {showGeofence && geofence && (
        <Circle
          center={[geofence.latitude, geofence.longitude]}
          radius={geofence.radiusMeters}
          pathOptions={{ color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.1 }}
        />
      )}

      <FocusOnSelected
        target={records.find((r) => r.userId === selectedUserId)}
        nonce={focusNonce}
      />

      {records.map((record) => (
        <Marker
          key={record.userId}
          position={[record.latitude, record.longitude]}
          icon={createMarkerIcon(
            record.userName,
            record.isWithinGeofence,
            record.positionSource,
            record.userAvatar,
            record.userId === selectedUserId
          )}
          // Marker terpilih diangkat ke atas tumpukan supaya tetap bisa diklik
          // saat beberapa karyawan berada di titik yang sama.
          zIndexOffset={record.userId === selectedUserId ? 1000 : 0}
          eventHandlers={{ click: () => onSelectUser?.(record.userId) }}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={record.photoUrl}
                alt={`Foto ${record.userName}`}
                style={{ width: '100%', borderRadius: 8, marginBottom: 6 }}
              />
              <strong>{record.userName}</strong>
              <br />
              Masuk · {formatTime(record.timestamp)}
              <br />
              {record.positionSource === 'live' && record.lastUpdate ? (
                <span style={{ color: '#16a34a', fontWeight: 600 }}>
                  ● LIVE · update {formatTime(record.lastUpdate)}
                </span>
              ) : record.positionSource === 'stale' && record.lastUpdate ? (
                <span style={{ color: '#64748b' }}>
                  Terakhir terlihat {formatTime(record.lastUpdate)} ·{' '}
                  {formatDistance(record.distanceFromCenter)} dari pusat
                </span>
              ) : (
                <span style={{ color: '#64748b' }}>
                  Posisi saat absen · {formatDistance(record.distanceFromCenter)} dari pusat
                </span>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
