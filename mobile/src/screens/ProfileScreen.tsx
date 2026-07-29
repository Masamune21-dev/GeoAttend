import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  CalendarCheck,
  Camera,
  FileText,
  ImagePlus,
  KeyRound,
  LogOut,
  Settings,
  UserRound,
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
import type {
  AttendanceRecordResponse,
  LeaveRequestResponse,
  PaginatedResponse,
} from '../api/types';
import { toLocalDateString } from '../lib/geo';
import { buildOvertimeSessions } from '../lib/session';
import {
  Badge,
  Button,
  Card,
  Field,
  InfoRow,
  MenuRow,
  PasswordField,
  SectionHeader,
  Sheet,
  StatCard,
} from '../components/ui';
import { colors, initialsOf, radius, shadow, spacing } from '../theme';

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  admin: 'Admin (Staf)',
  noc: 'NOC',
  teknisi: 'Teknisi',
  employee: 'Karyawan',
};

const COVER_HEIGHT = 120;
const AVATAR_SIZE = 96;

/** Pilih gambar dari galeri lalu kompres ke JPEG base64. */
async function pickImage(aspect: [number, number], maxWidth: number): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Izin galeri diperlukan', 'Izinkan akses galeri di pengaturan HP');
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

/** Awal bulan berjalan sebagai ISO — batas bawah query rekap. */
function startOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { user, signOut, refresh } = useSession();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Rekap bulan berjalan — supaya halaman profil tidak sekadar identitas.
  const [records, setRecords] = useState<AttendanceRecordResponse[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequestResponse[]>([]);

  const loadSummary = useCallback(async () => {
    const [att, lv] = await Promise.all([
      api<PaginatedResponse<AttendanceRecordResponse>>(
        `/api/attendance?userId=self&from=${encodeURIComponent(startOfMonthIso())}&limit=200`
      ).catch(() => ({ data: [] as AttendanceRecordResponse[] }) as PaginatedResponse<AttendanceRecordResponse>),
      api<{ data: LeaveRequestResponse[] }>('/api/leaves?userId=self').catch(() => ({
        data: [] as LeaveRequestResponse[],
      })),
    ]);
    setRecords(att.data);
    setLeaves(lv.data);
  }, []);

  useEffect(() => {
    loadSummary().catch(() => undefined);
  }, [loadSummary]);

  const summary = useMemo(() => {
    // Hari hadir = tanggal unik yang punya absen masuk shift (bukan lembur).
    const presentDays = new Set(
      records
        .filter((r) => r.type === 'clock_in' && r.kind !== 'lembur')
        .map((r) => toLocalDateString(new Date(r.timestamp)))
    ).size;

    // Total lembur = jumlah durasi sesi yang sudah ditutup bulan ini.
    const overtimeMs = buildOvertimeSessions(records)
      .filter((s) => s.endedAt)
      .reduce((sum, s) => sum + (new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()), 0);
    const overtimeMinutes = Math.max(0, Math.floor(overtimeMs / 60_000));
    const overtimeLabel =
      overtimeMinutes >= 60
        ? `${Math.floor(overtimeMinutes / 60)}j ${String(overtimeMinutes % 60).padStart(2, '0')}m`
        : `${overtimeMinutes}m`;

    const month = toLocalDateString(new Date()).slice(0, 7);
    const approvedLeaves = leaves.filter(
      (l) => l.status === 'approved' && l.type !== 'libur' && l.startDate.slice(0, 7) === month
    ).length;

    return { presentDays, overtimeLabel, approvedLeaves };
  }, [records, leaves]);

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
      Alert.alert('Gagal mengunggah foto', (err as Error).message);
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
      Alert.alert('Gagal mengunggah sampul', (err as Error).message);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      Alert.alert('Nama tidak boleh kosong');
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
      Alert.alert('Tersimpan ✓', 'Nama berhasil diubah');
    } catch (err) {
      Alert.alert('Gagal menyimpan nama', (err as Error).message);
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert('Kata sandi baru minimal 8 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Konfirmasi kata sandi tidak cocok');
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
      Alert.alert('Tersimpan ✓', 'Kata sandi berhasil diubah');
    } catch (err) {
      const e = err as ApiRequestError;
      Alert.alert(
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
    Alert.alert('Keluar?', 'Pelacakan posisi (bila aktif) juga akan dihentikan.', [
      { text: 'Batal' },
      { text: 'Keluar', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Sampul membentang di bawah status bar — ikonnya perlu terang. */}
      {isFocused && <StatusBar style="light" />}
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Kartu identitas: sampul membentang sampai status bar + avatar overlap */}
        <View style={[styles.identityCard, shadow.card]}>
          <Pressable onPress={handleChangeCover} disabled={uploadingCover}>
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
            <View style={styles.coverEditBadge}>
              {uploadingCover ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Camera size={14} color="#FFF" />
              )}
            </View>
          </Pressable>

          <View style={styles.avatarRow}>
            <Pressable onPress={handleChangeAvatar} disabled={uploadingAvatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl, headers: authHeaders }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{initialsOf(user?.name ?? '?')}</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Camera size={13} color="#FFF" />
                )}
              </View>
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
          {/* Rekap bulan berjalan */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Rekap Bulan Ini" icon={CalendarCheck} />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <StatCard
                icon={CalendarCheck}
                value={String(summary.presentDays)}
                label="Hari Hadir"
                tone="primary"
                style={{ flex: 1 }}
              />
              <StatCard
                icon={Zap}
                value={summary.overtimeLabel}
                label="Total Lembur"
                tone="warning"
                style={{ flex: 1 }}
              />
              <StatCard
                icon={FileText}
                value={String(summary.approvedLeaves)}
                label="Izin Disetujui"
                tone="success"
                style={{ flex: 1 }}
              />
            </View>
          </View>

          <MenuRow
            icon={Settings}
            title="Pengaturan Akun"
            subtitle="Ubah nama & kata sandi"
            onPress={openSettings}
          />

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
  avatarRow: { alignItems: 'center', marginTop: -(AVATAR_SIZE / 2) },
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
