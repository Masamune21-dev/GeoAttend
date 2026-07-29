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
 */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Jadwal: { openSwap?: boolean } | undefined;
  Izin: { openForm?: boolean } | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
