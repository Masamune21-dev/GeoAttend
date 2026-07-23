import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MapPin, ServerCog, X } from 'lucide-react-native';
import { useSession } from '../auth/session';
import { getServerUrl, loadApiState, ApiRequestError } from '../api/client';
import { Button, Card, Field, PasswordField } from '../components/ui';
import { colors, radius, spacing } from '../theme';

export function LoginScreen() {
  const { signIn } = useSession();
  const [serverUrl, setServerUrlState] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal pengaturan server (draft terpisah agar bisa dibatalkan)
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [serverDraft, setServerDraft] = useState('');

  useEffect(() => {
    loadApiState().then(() => setServerUrlState(getServerUrl()));
  }, []);

  const openServerModal = () => {
    setServerDraft(serverUrl);
    setServerModalOpen(true);
  };

  const saveServerModal = () => {
    setServerUrlState(serverDraft.trim() || getServerUrl());
    setServerModalOpen(false);
  };

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Isi email dan kata sandi');
      return;
    }
    setLoading(true);
    try {
      await signIn(serverUrl, email.trim(), password);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(
          err.status === 401 || err.status === 400
            ? 'Email atau kata sandi salah'
            : err.message
        );
      } else {
        setError('Terjadi kesalahan. Coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const serverLabel = serverUrl.replace(/^https?:\/\//, '');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.brandIconWrap}>
            <MapPin size={34} color={colors.primary} strokeWidth={2.2} />
          </View>
          <Text style={styles.brandName}>GeoAttend</Text>
          <Text style={styles.brandTagline}>Absensi dengan verifikasi lokasi & foto</Text>
        </View>

        <Card style={{ gap: spacing.lg }}>
          <View>
            <Text style={styles.title}>Masuk</Text>
            <Text style={styles.subtitle}>Masukkan email dan kata sandi Anda</Text>
          </View>

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="nama@perusahaan.com"
          />
          <PasswordField
            label="Kata Sandi"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
          />

          {error && (
            <View style={styles.errorBox}>
              <Text style={{ color: colors.destructive, fontSize: 14 }}>{error}</Text>
            </View>
          )}

          <Button title={loading ? 'Memproses...' : 'Masuk'} onPress={handleLogin} loading={loading} />

          <Pressable onPress={openServerModal} style={styles.serverRow}>
            <ServerCog size={15} color={colors.textSecondary} />
            <Text style={styles.serverToggle}>{serverLabel}</Text>
          </Pressable>
        </Card>

        <Text style={styles.footer}>KusumaVision</Text>
      </ScrollView>

      {/* Modal pengaturan server — kartu di ATAS layar agar tak tertutup keyboard */}
      <Modal
        visible={serverModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setServerModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setServerModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pengaturan Server</Text>
              <Pressable onPress={() => setServerModalOpen(false)} hitSlop={8}>
                <X size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Field
              label="Alamat Server"
              value={serverDraft}
              onChangeText={setServerDraft}
              autoFocus
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://absensi.kusumavision.net"
              hint="Ubah hanya bila diminta administrator"
            />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Button
                title="Batal"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => setServerModalOpen(false)}
              />
              <Button title="Simpan" style={{ flex: 1 }} onPress={saveServerModal} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
  },
  brand: { alignItems: 'center', gap: 4 },
  brandIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  brandName: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  brandTagline: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  errorBox: {
    backgroundColor: colors.destructiveSubtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  serverToggle: { color: colors.textSecondary, fontSize: 13 },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    paddingHorizontal: spacing.xl,
    paddingTop: 80,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
});
