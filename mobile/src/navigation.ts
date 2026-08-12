import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Aplikasi punya DUA kerangka yang terpisah penuh, dipilih dari role saat login:
 *
 * - **Karyawan** — absen, jadwal, izin, riwayat. Kerangka aslinya.
 * - **Administrator** — panel pengelolaan saja. Administrator tidak pernah
 *   absen, tidak punya shift, dan tidak mengajukan izin; menampilkan menu itu
 *   kepadanya hanya jadi kebisingan.
 *
 * Keduanya sengaja dipisah di level navigator, bukan disembunyikan satu per
 * satu di dalam layar: tab bar, isi beranda, dan daftar rute semuanya berbeda,
 * dan percabangan tersebar di banyak layar jauh lebih mudah bocor.
 */

/** Tab karyawan — "Absen" di tengah, digambar sebagai tombol bundar mengambang. */
export type TabParamList = {
  Dashboard: undefined;
  Riwayat: undefined;
  Absen: undefined;
  Stok: undefined;
  Profil: undefined;
};

/** Tab administrator — rata semua, tanpa tombol mengambang. */
export type AdminTabParamList = {
  Dashboard: undefined;
  Persetujuan: { tab?: 'izin' | 'tukar' } | undefined;
  Peta: undefined;
  Stok: undefined;
  Profil: undefined;
};

export type RootStackParamList = {
  /** Kerangka karyawan. */
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Jadwal: { openSwap?: boolean } | undefined;
  Izin: { openForm?: boolean } | undefined;

  /** Kerangka administrator. */
  AdminTabs: NavigatorScreenParams<AdminTabParamList> | undefined;
  KelolaKaryawan: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
