import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CircleCheck, CircleHelp, Info, TriangleAlert } from 'lucide-react-native';
import { Button, IconTile, type Tone } from './ui';
import { colors, radius, shadow, spacing, type } from '../theme';

/**
 * Dialog bertema pengganti `Alert.alert` bawaan sistem.
 *
 * Alert bawaan tampil dengan gaya Android/iOS mentah — putih kaku, tipografi
 * dan tombol di luar tema aplikasi. Komponen ini memakai token desain yang sama
 * dengan kartu & tombol lain, sekaligus menyeragamkan bentuk semua popup.
 *
 * Sengaja BERSIFAT IMPERATIF (`appAlert(...)`, bukan hook) karena dipakai dari
 * ~50 tempat, sebagian di dalam `.catch()` dan callback non-komponen. Bentuk
 * pemanggilannya dibuat persis seperti `Alert.alert(judul, pesan, tombol)`
 * supaya penggantiannya lurus dan tidak mengubah alur layar.
 */

export interface AppAlertButton {
  text: string;
  onPress?: () => void;
  /** 'cancel' = tombol aman (garis luar), 'destructive' = merah. */
  style?: 'default' | 'cancel' | 'destructive';
}

/** Nada dialog; menentukan ikon & warnanya. */
export type AppAlertTone = 'info' | 'success' | 'danger' | 'question';

export interface AlertRequest {
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
  tone?: AppAlertTone;
  /**
   * Isi berstruktur di bawah pesan — untuk konfirmasi yang perlu memperlihatkan
   * rincian berbaris (mis. perubahan stok), bukan sekadar paragraf panjang.
   */
  content?: ReactNode;
}

const TONE_META: Record<AppAlertTone, { icon: typeof Info; tile: Tone }> = {
  info: { icon: Info, tile: 'primary' },
  success: { icon: CircleCheck, tile: 'success' },
  danger: { icon: TriangleAlert, tile: 'destructive' },
  question: { icon: CircleHelp, tile: 'primary' },
};

/**
 * Nada ditebak dari judul bila tidak ditentukan.
 *
 * Penebakan ini memang kasar, tapi disengaja: puluhan pemanggilan lama cukup
 * menulis judul saja dan langsung dapat ikon yang pas tanpa harus disunting
 * satu per satu. Nada bisa selalu dipaksa lewat argumen keempat.
 */
function inferTone(req: AlertRequest): AppAlertTone {
  if (req.tone) return req.tone;
  if ((req.buttons?.length ?? 0) > 1) return 'question';
  const t = req.title.toLowerCase();
  if (req.title.includes('✓') || t.startsWith('tersimpan') || t.startsWith('terkirim')) {
    return 'success';
  }
  if (t.startsWith('gagal') || t.includes('tidak ') || t.includes('wajib') || t.includes('salah')) {
    return 'danger';
  }
  return 'info';
}

/** Antrean supaya dua pesan berurutan tidak saling menimpa. */
const pending: AlertRequest[] = [];
let notifyHost: (() => void) | null = null;

/** Tampilkan dialog dengan seluruh pilihan, termasuk isi berstruktur. */
export function showAppAlert(req: AlertRequest): void {
  pending.push(req);
  notifyHost?.();
}

/** Tampilkan dialog bertema. Pengganti `Alert.alert` dengan bentuk yang sama. */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
  tone?: AppAlertTone
): void {
  showAppAlert({ title, message, buttons, tone });
}

/**
 * Dipasang SEKALI di akar aplikasi.
 *
 * Modalnya baru muncul saat ada pesan, jadi jendelanya selalu ditambahkan
 * paling akhir — dengan begitu dialog ini tetap berada di atas bottom sheet
 * atau modal kamera yang sedang terbuka.
 */
export function AppAlertHost() {
  const [current, setCurrent] = useState<AlertRequest | null>(null);

  // Hanya mengambil dari antrean bila layar sedang kosong
  const showNext = useCallback(() => setCurrent((c) => c ?? pending.shift() ?? null), []);

  useEffect(() => {
    notifyHost = showNext;
    showNext(); // pesan yang sempat masuk sebelum host siap
    return () => {
      notifyHost = null;
    };
  }, [showNext]);

  const close = (button?: AppAlertButton) => {
    setCurrent(null);
    button?.onPress?.();
    // onPress yang ikut memanggil appAlert sudah masuk antrean di sini
    showNext();
  };

  const buttons: AppAlertButton[] = current?.buttons?.length
    ? current.buttons
    : [{ text: 'Mengerti' }];
  // Tombol aman ditaruh PALING BAWAH: ketukan refleks di dekat ibu jari jatuh
  // ke pilihan yang tidak berakibat.
  const ordered = [
    ...buttons.filter((b) => b.style !== 'cancel'),
    ...buttons.filter((b) => b.style === 'cancel'),
  ];
  const tone = current ? inferTone(current) : 'info';
  const meta = TONE_META[tone];
  /**
   * Tombol yang dijalankan saat dialog ditutup lewat latar / tombol kembali:
   * pilihan aman bila ada, atau satu-satunya tombol (dialog pemberitahuan).
   * Untuk konfirmasi tanpa pilihan aman, penutupan tidak menjalankan apa pun.
   */
  const dismissButton =
    buttons.find((b) => b.style === 'cancel') ?? (buttons.length === 1 ? buttons[0] : undefined);

  return (
    <Modal
      visible={current != null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => close(dismissButton)}
    >
      <View style={styles.backdrop}>
        {/* Ketuk latar = tutup, tapi hanya bila ada pilihan yang aman ditekan */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => dismissButton && close(dismissButton)}
          accessibilityLabel="Tutup"
        />
        <View style={[styles.card, shadow.raised]}>
          <IconTile icon={meta.icon} tone={meta.tile} size={46} rounded="circle" />
          <View style={styles.texts}>
            <Text style={styles.title}>{current?.title}</Text>
            {current?.message ? <Text style={styles.message}>{current.message}</Text> : null}
          </View>
          {current?.content ? <View style={styles.content}>{current.content}</View> : null}
          <View style={styles.actions}>
            {ordered.map((b) => (
              <Button
                key={b.text}
                title={b.text}
                onPress={() => close(b)}
                variant={
                  b.style === 'cancel'
                    ? 'outline'
                    : b.style === 'destructive'
                      ? 'destructive'
                      : 'primary'
                }
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  texts: { gap: 6, alignItems: 'center' },
  content: { alignSelf: 'stretch', gap: spacing.md },
  title: { ...type.title, color: colors.textPrimary, textAlign: 'center' },
  message: {
    ...type.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  /** Tombol ditumpuk penuh lebar — label panjang tak terpotong. */
  actions: { alignSelf: 'stretch', gap: spacing.sm },
});
