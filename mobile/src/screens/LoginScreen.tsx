import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
} from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useSession } from '../auth/session';
import { getServerUrl, loadApiState, ApiRequestError } from '../api/client';
import { Button, Card, Field, PasswordField } from '../components/ui';
import { colors, spacing } from '../theme';

export function LoginScreen() {
  const { signIn } = useSession();
  const [serverUrl, setServerUrlInput] = useState('');
  const [showServer, setShowServer] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadApiState().then(() => setServerUrlInput(getServerUrl()));
  }, []);

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

          <Pressable onPress={() => setShowServer((v) => !v)}>
            <Text style={styles.serverToggle}>
              {showServer ? '▴ Sembunyikan pengaturan server' : '▾ Pengaturan server'}
            </Text>
          </Pressable>
          {showServer && (
            <Field
              label="Alamat Server"
              value={serverUrl}
              onChangeText={setServerUrlInput}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://absensi.kusumavision.net"
              hint="Ubah hanya bila diminta administrator"
            />
          )}
        </Card>

        <Text style={styles.footer}>KusumaVision</Text>
      </ScrollView>
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
  serverToggle: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 13,
  },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12 },
});
