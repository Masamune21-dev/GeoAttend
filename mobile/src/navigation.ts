import type { NavigatorScreenParams } from '@react-navigation/native';

/** Tab utama (bar bawah dengan tombol Absen di tengah). */
export type TabParamList = {
  Dashboard: undefined;
  Riwayat: undefined;
  Absen: undefined;
  Stok: undefined;
  Profil: undefined;
};

/**
 * Layar penuh di atas tab. Jadwal & Izin tidak lagi menempati slot tab —
 * keduanya dibuka dari kartu aksi cepat di Dashboard.
 *
 * `Persetujuan` sengaja tidak jadi tab keenam: tab bar memakai lima slot dengan
 * tombol "Absen" mengambang di tengah, dan slot ganjil itulah yang menjaga
 * tombolnya tetap simetris.
 */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Jadwal: { openSwap?: boolean } | undefined;
  Izin: { openForm?: boolean } | undefined;
  Persetujuan: { tab?: 'izin' | 'tukar' } | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
