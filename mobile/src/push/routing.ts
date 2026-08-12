import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';

/**
 * Tampilkan notifikasi walau app sedang dibuka. Tanpa ini Android menelannya
 * diam-diam saat aplikasi di foreground, dan administrator yang kebetulan
 * sedang membuka app justru melewatkan pengajuan yang baru masuk.
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
 * Terjemahkan `data.kind` yang dikirim server jadi tujuan navigasi.
 * Nilainya dirakit di `src/lib/push/events.ts` pada sisi server.
 */
function destinationOf(data: unknown): { tab: 'izin' | 'tukar' } | null {
  const kind = (data as { kind?: string } | null | undefined)?.kind;
  if (kind === 'leave_request') return { tab: 'izin' };
  if (kind === 'shift_swap') return { tab: 'tukar' };
  return null;
}

/**
 * Buka layar yang tepat saat notifikasi disentuh.
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
export function useNotificationRouting(enabled: boolean): void {
  const navigation = useNavigation<Nav>();
  const response = Notifications.useLastNotificationResponse();
  const handledId = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !response) return;

    const id = response.notification.request.identifier;
    if (handledId.current === id) return;
    handledId.current = id;

    const target = destinationOf(response.notification.request.content.data);
    // Persetujuan adalah TAB di kerangka administrator, bukan layar stack —
    // jadi tujuannya harus disebut bersarang, tidak cukup nama rutenya saja.
    if (target) navigation.navigate('AdminTabs', { screen: 'Persetujuan', params: target });
  }, [enabled, response, navigation]);
}
