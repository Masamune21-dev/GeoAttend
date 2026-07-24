import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  Camera,
  ChevronRight,
  ImagePlus,
  KeyRound,
  LogOut,
  Settings,
  UserRound,
  X,
} from 'lucide-react-native';
import { useSession } from '../auth/session';
import { api, ApiRequestError, getServerUrl, getToken } from '../api/client';
import { Badge, Button, Card, Field, PasswordField } from '../components/ui';
import { colors, radius, spacing } from '../theme';

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  admin: 'Admin (Staf)',
  noc: 'NOC',
  teknisi: 'Teknisi',
  employee: 'Karyawan',
};

const COVER_HEIGHT = 150;
const AVATAR_SIZE = 112;

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

export function ProfileScreen() {
  const { user, signOut, refresh } = useSession();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Modal pengaturan akun (form nama & sandi disembunyikan di sini)
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Ubah nama
  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  // Ganti kata sandi
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const authHeaders = { Authorization: `Bearer ${getToken() ?? ''}` };
  const toAbsolute = (path?: string | null) =>
    path ? (path.startsWith('http') ? path : `${getServerUrl()}${path}`) : null;

  const avatarUrl = toAbsolute(user?.image);
  const coverUrl = toAbsolute(user?.coverImage);

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

  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}
    >
      {/* Kartu profil dengan sampul + avatar overlap */}
      <Card style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
        {/* Sampul */}
        <Pressable onPress={handleChangeCover} disabled={uploadingCover}>
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl, headers: authHeaders }}
              style={styles.cover}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]}>
              <ImagePlus size={26} color="rgba(255,255,255,0.85)" />
              <Text style={styles.coverHint}>Ketuk untuk pasang foto sampul</Text>
            </View>
          )}
          <View style={styles.coverEditBadge}>
            {uploadingCover ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Camera size={15} color="#FFF" />
            )}
          </View>
        </Pressable>

        {/* Avatar overlap */}
        <View style={styles.avatarRow}>
          <Pressable onPress={handleChangeAvatar} disabled={uploadingAvatar}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl, headers: authHeaders }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Camera size={15} color="#FFF" />
              )}
            </View>
          </Pressable>
        </View>

        <View style={styles.identity}>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.subtle}>{user?.email}</Text>
          <Badge
            text={ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? '-'}
            tone="primary"
            style={{ alignSelf: 'center', marginTop: 2 }}
          />
        </View>
      </Card>

      {/* Tombol pengaturan akun (form nama & sandi ada di dalam modal) */}
      <Pressable
        onPress={openSettings}
        style={({ pressed }) => [styles.settingsRow, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.settingsIcon}>
          <Settings size={20} color={colors.primary} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingsTitle}>Pengaturan Akun</Text>
          <Text style={styles.subtle}>Ubah nama & kata sandi</Text>
        </View>
        <ChevronRight size={20} color={colors.textSecondary} />
      </Pressable>

      <Card>
        <Text style={styles.sectionTitle}>Informasi Aplikasi</Text>
        {[
          ['Server', getServerUrl().replace(/^https?:\/\//, '')],
          ['Versi Aplikasi', Constants.expoConfig?.version ?? '-'],
        ].map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.subtle}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
        <Text style={[styles.subtle, { fontSize: 12 }]}>
          Untuk ganti server, keluar lalu buka "Pengaturan server" di layar login.
        </Text>
      </Card>

      <Button title="Keluar" icon={LogOut} variant="destructive" onPress={handleSignOut} />
    </ScrollView>

    {/* Modal Pengaturan Akun */}
    <Modal
      visible={settingsOpen}
      animationType="slide"
      transparent
      onRequestClose={() => setSettingsOpen(false)}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pengaturan Akun</Text>
              <Pressable onPress={() => setSettingsOpen(false)} hitSlop={8}>
                <X size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.lg }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Data diri — ubah nama */}
              <View style={{ gap: spacing.md }}>
                <View style={styles.sectionRow}>
                  <UserRound size={18} color={colors.primary} strokeWidth={2.2} />
                  <Text style={styles.sectionTitle}>Data Diri</Text>
                </View>
                <Field
                  label="Nama Lengkap"
                  value={name}
                  onChangeText={setName}
                  placeholder="Nama Anda"
                />
                <Text style={[styles.subtle, { fontSize: 12 }]}>
                  Email (username login) hanya bisa diubah oleh administrator.
                </Text>
                <Button
                  title="Simpan Nama"
                  onPress={handleSaveName}
                  loading={savingName}
                  disabled={name.trim().length === 0 || name.trim() === (user?.name ?? '')}
                />
              </View>

              {/* Ganti kata sandi */}
              <View style={{ gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg }}>
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
                <Text style={[styles.subtle, { fontSize: 12 }]}>
                  Setelah berhasil, sesi login di perangkat lain akan dikeluarkan.
                </Text>
                <Button
                  title="Ubah Kata Sandi"
                  onPress={handleChangePassword}
                  loading={changingPassword}
                  disabled={!currentPassword || !newPassword || !confirmPassword}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    width: '100%',
    height: COVER_HEIGHT,
    backgroundColor: colors.primary,
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  coverHint: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5 },
  coverEditBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRow: {
    alignItems: 'center',
    marginTop: -(AVATAR_SIZE / 2),
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.primarySubtle,
  },
  avatarFallback: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 38, fontWeight: '700' },
  avatarEditBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  name: { fontSize: 21, fontWeight: '700', color: colors.textPrimary },
  subtle: { fontSize: 14, color: colors.textSecondary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  value: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
});
