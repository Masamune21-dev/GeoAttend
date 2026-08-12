import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import {
  CalendarCheck,
  Camera,
  Download,
  FileText,
  ImagePlus,
  KeyRound,
  LogOut,
  Settings,
  UserRound,
  Users,
  Zap,
} from 'lucide-react-native';
import { useSession } from '../auth/session';
import {
  api,
  ApiRequestError,
  authImageHeaders,
  getServerUrl,
  toAbsoluteUrl,
} from '../api/client';
import type { RecapResponse } from '../api/types';
import { formatClock, formatLongDate } from '../lib/geo';
import { toLocalMonth } from '../lib/schedule';
import {
  buildRecapHtml,
  formatMinutesCompact,
  monthTitle,
  recapFileName,
} from '../lib/recap';
import {
  Badge,
  Button,
  Card,
  Field,
  InfoRow,
  MenuRow,
  PasswordField,
  PhotoViewer,
  SectionHeader,
  Sheet,
  StatCard,
} from '../components/ui';
import { appAlert } from '../components/AppAlert';
import { useTabBarSpace } from '../components/TabBar';
import { colors, initialsOf, radius, shadow, spacing } from '../theme';

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  admin: 'Admin (Staf)',
  noc: 'NOC',
  teknisi: 'Teknisi',
  employee: 'Karyawan',
};

/**
 * Sampul dipilih dengan potongan 16:9, jadi tingginya dibuat mendekati rasio
 * itu pada lebar layar HP — foto tampil hampir utuh, bukan terpotong pita
 * sempit. Avatar & identitas ikut turun karena menempel di bawah sampul.
 */
const COVER_HEIGHT = 184;
const AVATAR_SIZE = 96;
/** Seberapa dalam avatar menindih sampul (dulu setengah — terlalu naik). */
const AVATAR_OVERLAP = Math.round(AVATAR_SIZE / 3);

/** Pilih gambar dari galeri lalu kompres ke JPEG base64. */
async function pickImage(aspect: [number, number], maxWidth: number): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    appAlert('Izin galeri diperlukan', 'Izinkan akses galeri di pengaturan HP');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 1,
  });
  if (result.canceled || !result.assets[0]?.uri) return null;

  const processed = await manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: maxWidth } }],
    { compress: 0.85, format: SaveFormat.JPEG, base64: true }
  );
  return `data:image/jpeg;base64,${processed.base64}`;
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const { user, signOut, refresh } = useSession();
  const isAdministrator = user?.role === 'administrator';
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  /** Foto yang sedang dilihat besar; null = pratinjau tertutup. */
  const [viewer, setViewer] = useState<'avatar' | 'cover' | null>(null);

  // Rekap bulan berjalan. Angkanya datang JADI dari server (modul perhitungan
  // yang sama dengan halaman Rekap Bulanan web) — jangan dihitung ulang di sini,
  // itu penyebab "Total Lembur" sempat 0 padahal web menunjukkan 2j 3m.
  const month = toLocalMonth(new Date());
  const [recap, setRecap] = useState<RecapResponse | null>(null);
  const [recapError, setRecapError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadSummary = useCallback(async () => {
    // Administrator tidak absen — jangan tembak endpointnya sama sekali.
    if (isAdministrator) return;
    try {
      setRecap(await api<RecapResponse>(`/api/reports/recap?month=${month}&userId=self`));
      setRecapError(false);
    } catch {
      // Server lama belum punya endpoint ini — kartu rekap disembunyikan saja.
      setRecapError(true);
    }
  }, [month, isAdministrator]);

  useEffect(() => {
    loadSummary().catch(() => undefined);
  }, [loadSummary]);

  const summary = recap?.summary ?? null;

  const handleExportPdf = async () => {
    if (!recap) return;
    setExporting(true);
    try {
      const printedAt = `${formatLongDate(new Date())} ${formatClock(new Date())} WIB`;
      const { uri } = await Print.printToFileAsync({
        html: buildRecapHtml(recap, printedAt),
      });

      // expo-print menamai berkasnya acak — salin ke nama yang berarti supaya
      // enak dikirim lewat WhatsApp/email.
      let shareUri = uri;
      try {
        const target = new File(Paths.cache, recapFileName(recap));
        if (target.exists) target.delete();
        new File(uri).copy(target);
        shareUri = target.uri;
      } catch {
        // Gagal menyalin bukan alasan membatalkan — bagikan berkas aslinya.
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareUri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: `Rekap Absensi ${monthTitle(recap.month)}`,
        });
      } else {
        appAlert('PDF tersimpan', `Berkas dibuat di:\n${shareUri}`);
      }
    } catch (err) {
      appAlert('Gagal membuat PDF', (err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  // Sheet pengaturan akun (form nama & sandi disembunyikan di sini)
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Ubah nama
  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  // Ganti kata sandi
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const authHeaders = authImageHeaders();
  const avatarUrl = toAbsoluteUrl(user?.image);
  const coverUrl = toAbsoluteUrl(user?.coverImage);

  const handleChangeAvatar = async () => {
    const photo = await pickImage([1, 1], 400);
    if (!photo) return;
    setUploadingAvatar(true);
    try {
      const { url } = await api<{ url: string }>('/api/profile/avatar', {
        method: 'POST',
        body: JSON.stringify({ photoBase64: photo }),
      });
      await api('/api/auth/update-user', {
        method: 'POST',
        body: JSON.stringify({ image: url }),
      });
      await refresh();
    } catch (err) {
      appAlert('Gagal mengunggah foto', (err as Error).message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangeCover = async () => {
    const photo = await pickImage([16, 9], 1280);
    if (!photo) return;
    setUploadingCover(true);
    try {
      await api<{ url: string }>('/api/profile/cover', {
        method: 'POST',
        body: JSON.stringify({ photoBase64: photo }),
      });
      await refresh();
    } catch (err) {
      appAlert('Gagal mengunggah sampul', (err as Error).message);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      appAlert('Nama tidak boleh kosong');
      return;
    }
    setSavingName(true);
    try {
      // Endpoint yang sama dipakai web (Better Auth updateUser)
      await api('/api/auth/update-user', {
        method: 'POST',
        body: JSON.stringify({ name: trimmed }),
      });
      await refresh();
      setSettingsOpen(false);
      appAlert('Tersimpan ✓', 'Nama berhasil diubah');
    } catch (err) {
      appAlert('Gagal menyimpan nama', (err as Error).message);
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      appAlert('Kata sandi baru minimal 8 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      appAlert('Konfirmasi kata sandi tidak cocok');
      return;
    }
    setChangingPassword(true);
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSettingsOpen(false);
      appAlert('Tersimpan ✓', 'Kata sandi berhasil diubah');
    } catch (err) {
      const e = err as ApiRequestError;
      appAlert(
        'Gagal mengubah kata sandi',
        e.code === 'INVALID_PASSWORD' ? 'Kata sandi saat ini salah' : e.message
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const openSettings = () => {
    setName(user?.name ?? '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSettingsOpen(true);
  };

  const handleSignOut = () => {
    appAlert('Keluar?', 'Pelacakan posisi (bila aktif) juga akan dihentikan.', [
      { text: 'Batal' },
      { text: 'Keluar', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Sampul membentang di bawah status bar — ikonnya perlu terang. */}
      {isFocused && <StatusBar style="light" />}
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl + tabBarSpace }}
        showsVerticalScrollIndicator={false}
      >
        {/* Kartu identitas: sampul membentang sampai status bar + avatar overlap */}
        <View style={[styles.identityCard, shadow.card]}>
          {/* Ketuk foto = lihat besar; lencana kamera = ganti foto */}
          <Pressable
            onPress={() => (coverUrl ? setViewer('cover') : handleChangeCover())}
            disabled={uploadingCover}
            accessibilityLabel={coverUrl ? 'Lihat foto sampul' : 'Pasang foto sampul'}
          >
            {coverUrl ? (
              <Image
                source={{ uri: coverUrl, headers: authHeaders }}
                style={[styles.cover, { height: COVER_HEIGHT + insets.top }]}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.cover,
                  styles.coverPlaceholder,
                  { height: COVER_HEIGHT + insets.top, paddingTop: insets.top },
                ]}
              >
                <ImagePlus size={22} color="rgba(255,255,255,0.85)" />
                <Text style={styles.coverHint}>Ketuk untuk pasang foto sampul</Text>
              </View>
            )}
            <Pressable
              onPress={handleChangeCover}
              disabled={uploadingCover}
              hitSlop={8}
              accessibilityLabel="Ganti foto sampul"
              style={styles.coverEditBadge}
            >
              {uploadingCover ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Camera size={14} color="#FFF" />
              )}
            </Pressable>
          </Pressable>

          <View style={styles.avatarRow}>
            <Pressable
              onPress={() => (avatarUrl ? setViewer('avatar') : handleChangeAvatar())}
              disabled={uploadingAvatar}
              accessibilityLabel={avatarUrl ? 'Lihat foto profil' : 'Pasang foto profil'}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl, headers: authHeaders }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{initialsOf(user?.name ?? '?')}</Text>
                </View>
              )}
              <Pressable
                onPress={handleChangeAvatar}
                disabled={uploadingAvatar}
                hitSlop={8}
                accessibilityLabel="Ganti foto profil"
                style={styles.avatarEditBadge}
              >
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Camera size={13} color="#FFF" />
                )}
              </Pressable>
            </Pressable>
          </View>

          <View style={styles.identity}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Badge
              text={ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? '-'}
              tone="primary"
              style={{ alignSelf: 'center', marginTop: 4 }}
            />
          </View>
        </View>

        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          {/* Rekap bulan berjalan — rekap ABSENSI PRIBADI, jadi tidak berlaku
              bagi administrator: dia tidak pernah absen sehingga seluruh
              angkanya nol dan tombol unduhnya menghasilkan PDF kosong. */}
          {!recapError && !isAdministrator && (
            <View style={{ gap: spacing.md }}>
              <SectionHeader title={`Rekap ${monthTitle(month)}`} icon={CalendarCheck} />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <StatCard
                  icon={CalendarCheck}
                  value={summary ? String(summary.presentDays) : '—'}
                  label="Hari Hadir"
                  tone="primary"
                  style={{ flex: 1 }}
                />
                <StatCard
                  icon={Zap}
                  value={summary ? formatMinutesCompact(summary.totalOvertimeMinutes) : '—'}
                  label="Total Lembur"
                  tone="warning"
                  style={{ flex: 1 }}
                />
                <StatCard
                  icon={FileText}
                  value={
                    summary
                      ? String(summary.sakitDays + summary.izinDays + summary.cutiDays)
                      : '—'
                  }
                  label="Izin & Cuti"
                  tone="success"
                  style={{ flex: 1 }}
                />
              </View>
              {summary && summary.overtimeUrgentMinutes > 0 && (
                <Text style={styles.footnote}>
                  Lembur urgent disetujui: {formatMinutesCompact(summary.overtimeUrgentMinutes)} (
                  {summary.overtimeUrgentCount}x) — dihitung terpisah dari total di atas.
                </Text>
              )}
              {summary && summary.overtimeUrgentPending > 0 && (
                <Text style={styles.footnote}>
                  {summary.overtimeUrgentPending} sesi lembur urgent menunggu verifikasi admin.
                </Text>
              )}
              <Button
                title={exporting ? 'Menyiapkan PDF…' : 'Unduh Rekap PDF'}
                icon={Download}
                variant="outline"
                onPress={handleExportPdf}
                loading={exporting}
                disabled={!recap}
              />
            </View>
          )}

          <MenuRow
            icon={Settings}
            title="Pengaturan Akun"
            subtitle="Ubah nama & kata sandi"
            onPress={openSettings}
          />

          {/* Persetujuan & Peta Tim sudah jadi tab tersendiri di kerangka
              administrator; yang tersisa di sini hanya yang jarang dibuka. */}
          {user?.role === 'administrator' && (
            <MenuRow
              icon={Users}
              title="Kelola Karyawan"
              subtitle="Ubah role & tim jaga teknisi"
              onPress={() => navigation.navigate('KelolaKaryawan')}
            />
          )}

          <Card style={{ gap: spacing.md }}>
            <Text style={styles.sectionTitle}>Informasi Aplikasi</Text>
            <InfoRow label="Server" value={getServerUrl().replace(/^https?:\/\//, '')} />
            <InfoRow label="Versi Aplikasi" value={Constants.expoConfig?.version ?? '-'} last />
            <Text style={styles.footnote}>
              Untuk ganti server, keluar lalu buka "Pengaturan server" di layar login.
            </Text>
          </Card>

          <Button title="Keluar" icon={LogOut} variant="destructive" onPress={handleSignOut} />
        </View>
      </ScrollView>

      {/* Sheet Pengaturan Akun */}
      <Sheet visible={settingsOpen} title="Pengaturan Akun" onClose={() => setSettingsOpen(false)}>
        <View style={{ gap: spacing.md }}>
          <View style={styles.sectionRow}>
            <UserRound size={18} color={colors.primary} strokeWidth={2.2} />
            <Text style={styles.sectionTitle}>Data Diri</Text>
          </View>
          <Field label="Nama Lengkap" value={name} onChangeText={setName} placeholder="Nama Anda" />
          <Text style={styles.footnote}>
            Email (username login) hanya bisa diubah oleh administrator.
          </Text>
          <Button
            title="Simpan Nama"
            onPress={handleSaveName}
            loading={savingName}
            disabled={name.trim().length === 0 || name.trim() === (user?.name ?? '')}
          />
        </View>

        <View style={styles.divider} />

        <View style={{ gap: spacing.md }}>
          <View style={styles.sectionRow}>
            <KeyRound size={18} color={colors.primary} strokeWidth={2.2} />
            <Text style={styles.sectionTitle}>Ganti Kata Sandi</Text>
          </View>
          <PasswordField
            label="Kata Sandi Saat Ini"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="••••••••"
          />
          <PasswordField
            label="Kata Sandi Baru"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Minimal 8 karakter"
          />
          <PasswordField
            label="Konfirmasi Kata Sandi Baru"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
          />
          <Text style={styles.footnote}>
            Setelah berhasil, sesi login di perangkat lain akan dikeluarkan.
          </Text>
          <Button
            title="Ubah Kata Sandi"
            onPress={handleChangePassword}
            loading={changingPassword}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          />
        </View>
      </Sheet>

      <PhotoViewer
        uri={viewer === 'avatar' ? avatarUrl : viewer === 'cover' ? coverUrl : null}
        headers={authHeaders}
        onClose={() => setViewer(null)}
        actionLabel="Ganti Foto"
        onAction={() => {
          const target = viewer;
          setViewer(null);
          if (target === 'avatar') void handleChangeAvatar();
          if (target === 'cover') void handleChangeCover();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  identityCard: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    overflow: 'hidden',
  },
  cover: { width: '100%', height: COVER_HEIGHT, backgroundColor: colors.primary },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  coverHint: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  coverEditBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRow: { alignItems: 'center', marginTop: -AVATAR_OVERLAP },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.primarySubtle,
  },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.onPrimary, fontSize: 30, fontWeight: '700' },
  avatarEditBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  name: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  email: { fontSize: 12.5, color: colors.textSecondary },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footnote: { fontSize: 11.5, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border },
});
