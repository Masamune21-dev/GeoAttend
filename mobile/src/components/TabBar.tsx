import { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomTabBarHeightCallbackContext,
  BottomTabBarHeightContext,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { ClipboardCheck, Grid2x2, History, Map, MapPin, Package, UserRound } from 'lucide-react-native';
import { colors, radius, shadow, spacing } from '../theme';
import type { IconType } from './ui';

const ICONS: Record<string, IconType> = {
  Dashboard: Grid2x2,
  Riwayat: History,
  Absen: MapPin,
  Stok: Package,
  Profil: UserRound,
  // Tab administrator
  Persetujuan: ClipboardCheck,
  Peta: Map,
};

const LABELS: Record<string, string> = {
  Dashboard: 'Dashboard',
  Riwayat: 'Riwayat',
  Absen: 'Absen',
  Stok: 'Stok',
  Profil: 'Profil',
  Persetujuan: 'Persetujuan',
  Peta: 'Peta Tim',
};

/** Nama rute yang tampil sebagai tombol bundar mengambang di tengah. */
const CENTER_ROUTE = 'Absen';

const RING = 66;
const BUTTON = 56;
/**
 * Ruang di atas bar putih tempat tombol tengah "naik".
 *
 * Sengaja berupa padding transparan pada wadah luar, BUKAN margin negatif:
 * Android memotong anak yang keluar dari batas induk, jadi tombol dengan
 * margin negatif akan terpotong separuh di perangkat Android.
 */
const OVERHANG = RING / 2 + 1;

/**
 * Ruang aman di bawah isi layar supaya tidak tertutup bar putih.
 *
 * Tab bar mengambang di ATAS isi layar, jadi tiap layar tab perlu menambah
 * jarak ini pada dasar area gulirnya. Nilainya tinggi bar putih saja — daerah
 * tembus pandang tempat tombol Absen naik memang boleh dilewati isi layar.
 * Memakai context langsung (bukan useBottomTabBarHeight) supaya aman dipanggil
 * dari layar di luar tab navigator: hasilnya 0.
 */
export function useTabBarSpace(): number {
  return useContext(BottomTabBarHeightContext) ?? 0;
}

/**
 * Tab bar kustom. Dipakai dua kerangka sekaligus:
 *
 * - **Karyawan** — ada rute `Absen`, digambar sebagai tombol bundar mengambang
 *   di tengah, dan bar diberi ruang tembus pandang setinggi OVERHANG di atasnya.
 * - **Administrator** — tanpa rute `Absen`, jadi tombol mengambang tidak
 *   digambar DAN ruang OVERHANG-nya ikut ditiadakan; kalau tidak, akan ada
 *   celah kosong ±34dp yang memakan tampilan tanpa alasan.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Tinggi bar putih dilaporkan ke navigator supaya layar bisa memakainya
  // lewat useTabBarSpace() sebagai jarak aman bawah.
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const centerIndex = state.routes.findIndex((r) => r.name === CENTER_ROUTE);
  const centerFocused = centerIndex >= 0 && state.index === centerIndex;

  const press = (index: number) => {
    const route = state.routes[index];
    const focused = state.index === index;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  return (
    <View style={[styles.wrap, centerIndex < 0 && { paddingTop: 0 }]} pointerEvents="box-none">
      <View
        style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
        onLayout={(e) => reportHeight?.(e.nativeEvent.layout.height)}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name] ?? Grid2x2;
          const label = LABELS[route.name] ?? route.name;

          // Slot tengah hanya menyediakan ruang + label; tombolnya digambar
          // terpisah di lapisan mengambang agar bisa melewati tepi atas bar.
          if (route.name === CENTER_ROUTE) {
            return (
              <View key={route.key} style={styles.tab} pointerEvents="none">
                <View style={{ height: BUTTON - OVERHANG + 2 }} />
                <Text style={[styles.label, centerFocused && styles.labelActive]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={() => press(index)}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
              style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
            >
              <Icon
                size={20}
                color={focused ? colors.primary : colors.textMuted}
                strokeWidth={focused ? 2.2 : 2}
              />
              <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tombol Absen mengambang */}
      {centerIndex >= 0 && (
        <View style={styles.centerLayer} pointerEvents="box-none">
          <Pressable
            onPress={() => press(centerIndex)}
            accessibilityRole="button"
            accessibilityState={centerFocused ? { selected: true } : {}}
            accessibilityLabel={LABELS[CENTER_ROUTE]}
            style={({ pressed }) => [styles.centerRing, shadow.raised, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.centerButton}>
              <MapPin size={24} color={colors.onPrimary} strokeWidth={2.2} />
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Tab bar mengambang di atas isi layar: hanya bar putihnya yang menutup,
   * sedangkan jalur setinggi OVERHANG di atasnya tembus pandang sehingga isi
   * layar terlihat sampai tepi atas bar (dulu jalur ini ikut buram sewarna
   * halaman, memakan ±34dp ruang tampilan). `pointerEvents="box-none"` menjaga
   * jalur itu tetap bisa ditembus sentuhan.
   */
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: OVERHANG,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  /**
   * `alignSelf: stretch` + `textAlign: center` sengaja dipakai supaya Text
   * memakai lebar penuh slot tab, bukan lebar hasil pengukurannya sendiri.
   * Tanpa itu Android memotong huruf terakhir label non-bold ("Absen" jadi
   * "Abse") karena pembulatan lebar teks.
   */
  label: {
    fontSize: 11,
    color: colors.textMuted,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  labelActive: { color: colors.primary, fontWeight: '700' },

  centerLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  centerRing: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButton: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
