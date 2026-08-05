import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Eye, EyeOff, X } from 'lucide-react-native';
import { useKeyboardHeight } from '../lib/keyboard';
import { avatarColor, colors, initialsOf, radius, shadow, spacing, type } from '../theme';

/** Tipe komponen ikon lucide-react-native. */
export type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Nada warna semantik yang dipakai Badge, IconTile, dan StatCard. */
export type Tone = 'primary' | 'success' | 'warning' | 'destructive' | 'neutral';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: colors.primarySubtle, fg: colors.primary },
  success: { bg: colors.successSubtle, fg: colors.successStrong },
  warning: { bg: colors.warningSubtle, fg: colors.warningStrong },
  destructive: { bg: colors.destructiveSubtle, fg: colors.destructiveStrong },
  neutral: { bg: colors.muted, fg: colors.textSecondary },
};

export function toneOf(tone: Tone) {
  return TONES[tone];
}

// ---------- Button ----------

type ButtonVariant = 'primary' | 'outline' | 'destructive' | 'success' | 'warning' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconType;
  style?: StyleProp<ViewStyle>;
}

const BUTTON_BG: Record<ButtonVariant, string> = {
  primary: colors.primary,
  destructive: colors.destructive,
  success: colors.success,
  warning: colors.warning,
  outline: colors.surface,
  ghost: 'transparent',
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon: Icon,
  style,
}: ButtonProps) {
  const bg = BUTTON_BG[variant];
  const fg = variant === 'outline' || variant === 'ghost' ? colors.textPrimary : colors.onPrimary;
  const small = size === 'sm';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, minHeight: small ? 40 : 50 },
        variant === 'outline' && { borderWidth: 1, borderColor: colors.border },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        Icon && <Icon size={small ? 15 : 18} color={fg} strokeWidth={2.2} />
      )}
      <Text style={[styles.buttonText, { color: fg, fontSize: small ? 13 : 15 }]}>{title}</Text>
    </Pressable>
  );
}

// ---------- Field ----------

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
}

export function Field({ label, hint, style, multiline, ...props }: FieldProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline, style]}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Field kata sandi dengan toggle mata (konsisten dengan web). */
export function PasswordField({ label, hint, style, ...props }: FieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!visible}
          autoCapitalize="none"
          style={[styles.input, { paddingRight: 44 }, style]}
          {...props}
        />
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          accessibilityLabel={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          style={styles.eyeButton}
        >
          {visible ? (
            <EyeOff size={20} color={colors.textSecondary} />
          ) : (
            <Eye size={20} color={colors.textSecondary} />
          )}
        </Pressable>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

// ---------- Card ----------

/** Kartu terangkat (shadow). `flat` memakai border tipis, tanpa shadow. */
export function Card({
  children,
  style,
  flat,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  flat?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        flat ? { borderWidth: 1, borderColor: colors.border } : shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Kartu yang bisa ditekan — dipakai untuk baris daftar yang membuka detail. */
export function PressableCard({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, shadow.card, pressed && { opacity: 0.7 }, style]}
    >
      {children}
    </Pressable>
  );
}

// ---------- Badge ----------

export function Badge({
  text,
  tone = 'neutral',
  style,
}: {
  text: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const { bg, fg } = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[type.micro, { color: fg }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

// ---------- Avatar ----------

export function Avatar({
  name,
  size = 40,
  uri,
  headers,
  color,
  style,
}: {
  name: string;
  size?: number;
  uri?: string | null;
  headers?: Record<string, string>;
  /** Paksa warna latar; default deterministik dari nama. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const box: ViewStyle = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    // ViewStyle & ImageStyle beda di properti `overflow` saja — aman di-cast.
    return (
      <Image
        source={{ uri, headers }}
        style={[box, { backgroundColor: colors.muted }, style] as StyleProp<ImageStyle>}
      />
    );
  }
  return (
    <View
      style={[
        box,
        styles.center,
        { backgroundColor: color ?? avatarColor(name) },
        style,
      ]}
    >
      <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: size * 0.36 }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

// ---------- IconTile ----------

/** Kotak membulat bernuansa warna, berisi satu ikon. */
export function IconTile({
  icon: Icon,
  tone = 'primary',
  size = 44,
  rounded = 'square',
}: {
  icon: IconType;
  tone?: Tone;
  size?: number;
  rounded?: 'square' | 'circle';
}) {
  const { bg, fg } = TONES[tone];
  return (
    <View
      style={[
        styles.center,
        {
          width: size,
          height: size,
          borderRadius: rounded === 'circle' ? size / 2 : Math.round(size * 0.28),
          backgroundColor: bg,
        },
      ]}
    >
      <Icon size={Math.round(size * 0.45)} color={fg} strokeWidth={2.1} />
    </View>
  );
}

// ---------- Section header ----------

export function SectionHeader({
  title,
  icon: Icon,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  icon?: IconType;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 }}>
        {Icon && <Icon size={16} color={colors.primary} strokeWidth={2.1} />}
        <Text style={styles.sectionTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.link}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------- Screen header ----------

/** Header putih di puncak layar, sudah menghormati status bar. */
export function ScreenHeader({
  title,
  subtitle,
  left,
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screenHeader, { paddingTop: insets.top + spacing.md }, style]}>
      {left}
      <View style={{ flex: 1 }}>
        <Text style={styles.screenTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.screenSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** Tombol bundar abu-abu di sisi header (mis. tutup / kembali). */
export function HeaderIconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
}: {
  icon: IconType;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.headerIconButton, pressed && { opacity: 0.6 }]}
    >
      <Icon size={18} color={colors.textPrimary} strokeWidth={2.1} />
    </Pressable>
  );
}

// ---------- Stat card ----------

export function StatCard({
  icon,
  value,
  label,
  tone = 'primary',
  emphasizeValue,
  style,
}: {
  icon: IconType;
  value: string;
  label: string;
  tone?: Tone;
  /** Beri warna pada angka (dipakai untuk stok menipis). */
  emphasizeValue?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card style={[{ padding: spacing.md, gap: 6 }, style]}>
      <IconTile icon={icon} tone={tone} size={32} />
      <Text
        style={[
          styles.statValue,
          emphasizeValue && { color: TONES[tone].fg },
        ]}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

// ---------- Chip ----------

/** Chip filter (kategori). */
export function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active ? styles.filterChipActive : styles.filterChipIdle,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[
          type.small,
          { fontWeight: '600', color: active ? colors.onPrimary : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Chip orang: avatar mini + nama. */
export function PersonChip({ name, uri, headers }: { name: string; uri?: string | null; headers?: Record<string, string> }) {
  return (
    <View style={styles.personChip}>
      <Avatar name={name} size={20} uri={uri} headers={headers} />
      <Text style={[type.tiny, { color: colors.textPrimary }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

// ---------- Segmented ----------

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Rows ----------

/** Baris menu dengan ikon di kiri dan chevron di kanan. */
export function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  tone = 'primary',
}: {
  icon: IconType;
  title: string;
  subtitle?: string;
  onPress: () => void;
  tone?: Tone;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
    >
      <IconTile icon={icon} tone={tone} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle ? <Text style={styles.subtle}>{subtitle}</Text> : null}
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  );
}

/** Baris "label — nilai" di dalam kartu informasi. */
export function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0, paddingBottom: 0 }]}>
      <Text style={styles.subtle}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ---------- Empty state ----------

export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon?: IconType;
  title: string;
  hint?: string;
}) {
  return (
    <View style={styles.empty}>
      {Icon && <Icon size={26} color={colors.textMuted} strokeWidth={1.7} />}
      <Text style={[type.bodyStrong, { color: colors.textSecondary }]}>{title}</Text>
      {hint ? <Text style={[type.small, { color: colors.textMuted, textAlign: 'center' }]}>{hint}</Text> : null}
    </View>
  );
}

// ---------- Bottom sheet ----------

/** Modal bawah dengan judul + tombol tutup; isi bisa discroll. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  scroll = true,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** false bila isi sudah punya list yang menggulir sendiri. */
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  /*
   * Sheet diangkat sendiri ke atas papan ketik: jendela Modal Android umumnya
   * TIDAK ikut menyusut walau aplikasi memakai adjustResize, jadi form yang
   * sedang diisi tertutup papan ketik.
   *
   * Supaya tidak dobel terangkat di perangkat/OS yang jendelanya MEMANG
   * menyusut, tinggi jendela saat papan ketik tersembunyi disimpan sebagai
   * acuan — yang kita angkat hanya sisa selisihnya.
   */
  const [windowHeight, setWindowHeight] = useState(0);
  const restingHeight = useRef(0);
  useEffect(() => {
    if (keyboardHeight === 0 && windowHeight > 0) restingHeight.current = windowHeight;
  }, [keyboardHeight, windowHeight]);
  const shrunkBy = Math.max(0, restingHeight.current - windowHeight);
  const lift = Math.max(0, keyboardHeight - shrunkBy);

  // Saat terangkat, jarak aman bawah tidak perlu — areanya tertutup papan ketik.
  const body = (
    <View style={{ gap: spacing.lg, paddingBottom: (lift > 0 ? 0 : insets.bottom) + spacing.lg }}>
      {children}
    </View>
  );
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={[styles.sheetOverlay, { paddingBottom: lift }]}
        onLayout={(e) => setWindowHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Tutup">
              <X size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {body}
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>{children}</View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ---------- Floating action button ----------

export function Fab({
  icon: Icon,
  onPress,
  bottom,
  accessibilityLabel,
}: {
  icon: IconType;
  onPress: () => void;
  bottom: number;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.fab, shadow.raised, { bottom }, pressed && { opacity: 0.85 }]}
    >
      <Icon size={22} color={colors.onPrimary} strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  buttonText: { fontWeight: '700' },

  label: { ...type.bodyStrong, color: colors.textPrimary } as TextStyle,
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  inputMultiline: { minHeight: 88, paddingTop: spacing.md, textAlignVertical: 'top' },
  hint: { ...type.tiny, color: colors.textSecondary } as TextStyle,
  eyeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },

  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },

  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  sectionTitle: { ...type.section, color: colors.textPrimary } as TextStyle,
  link: { ...type.small, fontWeight: '600', color: colors.primary } as TextStyle,

  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  screenTitle: { ...type.title, color: colors.textPrimary } as TextStyle,
  screenSubtitle: { ...type.small, color: colors.textSecondary, marginTop: 2 } as TextStyle,
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statLabel: { ...type.tiny, color: colors.textSecondary } as TextStyle,

  filterChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.full },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipIdle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },

  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    paddingLeft: 2,
    paddingRight: 10,
    paddingVertical: 2,
    maxWidth: '100%',
  },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm + 1,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  segmentTextActive: { color: colors.textPrimary },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  menuTitle: { ...type.body, fontWeight: '600', color: colors.textPrimary } as TextStyle,
  subtle: { ...type.small, color: colors.textSecondary } as TextStyle,

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },

  empty: { alignItems: 'center', gap: 6, paddingVertical: 36, paddingHorizontal: spacing.xl },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '88%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },

  fab: {
    position: 'absolute',
    right: spacing.xl,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
