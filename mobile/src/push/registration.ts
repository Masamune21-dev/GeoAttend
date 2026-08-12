import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from '../api/client';

/**
 * Registrasi perangkat untuk push notification.
 *
 * Tidak ada satu pun fungsi di sini yang boleh melempar: notifikasi adalah
 * pelengkap, dan HP yang menolak izin atau emulator tanpa Google Play harus
 * tetap bisa dipakai absen seperti biasa. Semua kegagalan cukup dicatat ke
 * console lalu diabaikan — pola yang sama dipakai `startTracking()`.
 */

let lastRegisteredToken: string | null = null;

/**
 * Channel wajib dibuat sebelum notifikasi pertama tiba. Server mengirim
 * `channelId: 'default'`; kalau channel itu belum ada, Android menaruh
 * notifikasinya di channel cadangan tanpa suara dan pengguna tidak bisa
 * mengaturnya sendiri di setelan sistem.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Pemberitahuan GeoAttend',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#2563EB',
    vibrationPattern: [0, 250, 250, 250],
  });
}

/**
 * Minta izin bila belum pernah diputuskan.
 *
 * Sengaja tidak memaksa saat pengguna sudah pernah menolak: Android tidak
 * menampilkan dialog kedua kali, jadi memanggil ulang hanya menghasilkan
 * penolakan diam-diam. Pengguna yang berubah pikiran mengaturnya dari setelan
 * sistem, dan registrasi akan lolos pada pembukaan app berikutnya.
 */
async function hasPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Daftarkan token perangkat ke server. Panggil setelah login DAN tiap app
 * kembali aktif — Expo bisa mengganti token kapan saja (pemulihan backup,
 * clear data, reinstall), dan endpoint server bersifat upsert.
 */
export async function registerPushToken(): Promise<void> {
  try {
    // Emulator/simulator tidak punya jalur FCM — lewati tanpa ribut.
    if (!Device.isDevice) return;
    if (!(await hasPermission())) return;

    await ensureAndroidChannel();

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('[push] projectId EAS tidak ditemukan, token tidak bisa diambil');
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token || token === lastRegisteredToken) return;

    await api('/api/push/register', {
      method: 'POST',
      body: JSON.stringify({
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        appVersion: Constants.expoConfig?.version,
      }),
    });
    lastRegisteredToken = token;
  } catch (error) {
    console.warn('[push] registrasi token gagal:', error);
  }
}

/**
 * Cabut token saat logout supaya HP tidak lagi menerima notifikasi milik
 * pengguna sebelumnya. Dipanggil SEBELUM token sesi dihapus — endpoint ini
 * butuh autentikasi untuk memastikan hanya pemilik token yang bisa mencabutnya.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    if (!lastRegisteredToken) return;
    await api(`/api/push/register?token=${encodeURIComponent(lastRegisteredToken)}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.warn('[push] pencabutan token gagal:', error);
  } finally {
    lastRegisteredToken = null;
  }
}
