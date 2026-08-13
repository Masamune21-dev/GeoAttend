import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

/**
 * Tampilkan notifikasi walau app sedang dibuka. Tanpa ini Android menelannya
 * diam-diam saat aplikasi di foreground, dan penerima yang kebetulan sedang
 * membuka app justru melewatkan hal yang menunggu dia.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Buka layar yang tepat saat notifikasi disentuh.
 *
 * Tujuannya bergantung role karena kedua kerangka punya rute yang berbeda —
 * `Persetujuan` hanya ada di kerangka administrator, `Jadwal` hanya ada di
 * kerangka karyawan. Menavigasi ke rute yang tidak terdaftar tidak melakukan
 * apa-apa, jadi pemetaannya harus benar sejak awal.
 *
 * `useLastNotificationResponse` menangani dua jalur sekaligus: app yang sudah
 * berjalan, dan app yang baru dinyalakan oleh sentuhan notifikasi itu sendiri.
 * Jalur kedua yang paling sering terlewat kalau hanya memasang listener,
 * padahal justru itu yang biasa dilakukan pengguna.
 *
 * Hook itu mengembalikan respons yang **sama** pada tiap render selama belum
 * ada notifikasi baru, jadi identifier yang sudah ditangani harus diingat —
 * tanpa itu navigasi terpicu ulang setiap kali komponen dirender.
 */
export function useNotificationRouting(role: string | null | undefined): void {
  const navigation = useNavigation<Nav>();
  const response = Notifications.useLastNotificationResponse();
  const handledId = useRef<string | null>(null);

  useEffect(() => {
    // Keluar SEBELUM menandai sudah ditangani: saat app dinyalakan oleh
    // notifikasi, sesi belum termuat pada render pertama sehingga role masih
    // kosong. Efek ini akan berjalan lagi begitu sesi siap.
    if (!role || !response) return;

    const id = response.notification.request.identifier;
    if (handledId.current === id) return;
    handledId.current = id;

    const kind = (response.notification.request.content.data as { kind?: string } | null)?.kind;

    if (role === 'administrator') {
      // Persetujuan adalah TAB, bukan layar stack — tujuannya harus disebut
      // bersarang, tidak cukup nama rutenya saja.
      if (kind === 'leave_request') {
        navigation.navigate('AdminTabs', { screen: 'Persetujuan', params: { tab: 'izin' } });
      } else if (kind === 'shift_swap') {
        navigation.navigate('AdminTabs', { screen: 'Persetujuan', params: { tab: 'tukar' } });
      }
      return;
    }

    // Karyawan. Urusan tukar shift — baik permintaan masuk maupun hasilnya —
    // semuanya ditindaklanjuti di layar Jadwal. Tidak memakai `openSwap`:
    // parameter itu membuka form PENGAJUAN baru, sedangkan penerima justru
    // perlu melihat yang sudah ada.
    if (kind === 'swap_peer' || kind === 'swap_result') navigation.navigate('Jadwal');
    else if (kind === 'leave_result') navigation.navigate('Izin');
    // Pengingat shift hanya menuntut satu hal: absen. Antar langsung ke tab
    // Absen, bukan Dashboard — orangnya sedang di jalan atau baru sampai, satu
    // ketukan lebih sedikit berarti lebih kecil peluang dia lupa lagi.
    else if (kind === 'shift_reminder') navigation.navigate('Tabs', { screen: 'Absen' });
  }, [role, response, navigation]);
}
