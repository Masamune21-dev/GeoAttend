import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Grid2x2, History, MapPin, Package, UserRound } from 'lucide-react-native';
import { colors, radius, shadow, spacing } from '../theme';
import type { IconType } from './ui';

const ICONS: Record<string, IconType> = {
  Dashboard: Grid2x2,
  Riwayat: History,
  Absen: MapPin,
  Stok: Package,
  Profil: UserRound,
};

const LABELS: Record<string, string> = {
  Dashboard: 'Dashboard',
  Riwayat: 'Riwayat',
  Absen: 'Absen',
  Stok: 'Stok',
  Profil: 'Profil',
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

/** Tab bar kustom: lima tab dengan tombol Absen diangkat di tengah. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const centerIndex = state.routes.findIndex((r) => r.name === CENTER_ROUTE);
  const centerFocused = centerIndex >= 0 && state.index === centerIndex;

  const press = (index: number) => {
    const route = state.routes[index];
    const focused = state.index === index;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
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
                <Text style={[styles.label, centerFocused && styles.labelActive]}>{label}</Text>
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
              <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
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
  // Latar sewarna halaman agar tombol tengah terlihat "menembus" tab bar.
  wrap: { backgroundColor: colors.background, paddingTop: OVERHANG },
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
  label: { fontSize: 10, color: colors.textMuted },
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
