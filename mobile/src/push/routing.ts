import { useEffect } from 'react';
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
 * Menangani dua jalur sekaligus: app yang sudah berjalan (listener) dan app
 * yang baru dinyalakan oleh sentuhan notifikasi itu sendiri
 * (`getLastNotificationResponseAsync`) — jalur kedua ini yang paling sering
 * terlewat, padahal justru itu yang biasa dilakukan pengguna.
 */
export function useNotificationRouting(enabled: boolean): void {
  const navigation = useNavigation<Nav>();

  useEffect(() => {
    if (!enabled) return;

    const go = (data: unknown) => {
      const target = destinationOf(data);
      if (target) navigation.navigate('Persetujuan', target);
    };

    let cancelled = false;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!cancelled && response) go(response.notification.request.content.data);
      })
      .catch(() => undefined);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      go(response.notification.request.content.data);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [enabled, navigation]);
}
