import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useSession } from '../auth/session';
import { getServerUrl } from '../api/client';
import { Badge, Button, Card } from '../components/ui';
import { colors, spacing } from '../theme';

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  admin: 'Admin (Staf)',
  noc: 'NOC',
  teknisi: 'Teknisi',
  employee: 'Karyawan',
};

export function ProfileScreen() {
  const { user, signOut } = useSession();

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
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
    >
      <Card style={{ alignItems: 'center', gap: spacing.md }}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.subtle}>{user?.email}</Text>
          <Badge text={ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? '-'} tone="primary" />
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
          Ubah nama, foto profil, dan kata sandi melalui versi web. Untuk ganti server,
          keluar lalu buka "Pengaturan server" di layar login.
        </Text>
      </Card>

      <Button title="Keluar" variant="destructive" onPress={handleSignOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 30, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
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
