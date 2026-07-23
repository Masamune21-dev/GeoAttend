import { useState } from 'react';
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
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Camera, ImagePlus, LogOut } from 'lucide-react-native';
import { useSession } from '../auth/session';
import { api, getServerUrl, getToken } from '../api/client';
import { Badge, Button, Card } from '../components/ui';
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
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
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
          Ubah nama dan kata sandi melalui versi web. Untuk ganti server, keluar lalu
          buka "Pengaturan server" di layar login.
        </Text>
      </Card>

      <Button title="Keluar" icon={LogOut} variant="destructive" onPress={handleSignOut} />
    </ScrollView>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  value: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
});
