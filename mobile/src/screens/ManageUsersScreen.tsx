import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Users } from 'lucide-react-native';
import { api, authImageHeaders, toAbsoluteUrl } from '../api/client';
import type { UserListItem } from '../api/types';
import { useSession } from '../auth/session';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FilterChip,
  HeaderIconButton,
  PressableCard,
  ScreenHeader,
  Sheet,
} from '../components/ui';
import { appAlert } from '../components/AppAlert';
import { colors, spacing } from '../theme';

/**
 * Kelola karyawan untuk administrator: ubah role dan tim jaga teknisi.
 *
 * Sengaja **tidak** menyediakan hapus akun maupun ganti kata sandi orang lain.
 * Keduanya destruktif dan jarang, jadi tetap di web — layar HP terlalu mudah
 * tersentuh tidak sengaja untuk aksi yang tidak bisa dibatalkan.
 */

const ROLE_OPTIONS = ['administrator', 'admin', 'noc', 'teknisi', 'employee'] as const;

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  admin: 'Admin (Staf)',
  noc: 'NOC',
  teknisi: 'Teknisi',
  employee: 'Karyawan',
  gudang: 'Admin Gudang',
};

const TEAM_LABELS: Record<string, string> = { ganjil: 'Tim Ganjil', genap: 'Tim Genap' };

export function ManageUsersScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user: me } = useSession();

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [draftRole, setDraftRole] = useState<string>('employee');
  const [draftTeam, setDraftTeam] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (roleFilter) params.set('role', roleFilter);
    const query = params.toString();
    const res = await api<{ data: UserListItem[] }>(`/api/users${query ? `?${query}` : ''}`);
    setUsers(res.data);
  }, [search, roleFilter]);

  // Pencarian diberi jeda agar tidak menembak endpoint tiap ketukan huruf.
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData()
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, [loadData]);

  const openEdit = (item: UserListItem) => {
    setDraftRole(item.role);
    setDraftTeam(item.technicianTeam);
    setEditing(item);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api(`/api/users/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: draftRole,
          // Tim hanya bermakna untuk teknisi; server juga mengosongkannya
          // otomatis saat role berpindah, tapi dikirim eksplisit agar hasilnya
          // tidak bergantung pada urutan penerapan di server.
          technicianTeam: draftRole === 'teknisi' ? draftTeam : null,
        }),
      });
      setEditing(null);
      appAlert('Tersimpan ✓', `${editing.name} — ${ROLE_LABELS[draftRole] ?? draftRole}`);
      await loadData();
    } catch (err) {
      appAlert('Gagal menyimpan', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Kelola Karyawan"
        subtitle={loading ? 'Memuat…' : `${users.length} akun`}
        left={
          <HeaderIconButton
            icon={ChevronLeft}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Kembali"
          />
        }
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Field
          label="Cari"
          value={search}
          onChangeText={setSearch}
          placeholder="Nama atau email"
          autoCapitalize="none"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}
        >
          <FilterChip label="Semua" active={roleFilter === null} onPress={() => setRoleFilter(null)} />
          {ROLE_OPTIONS.map((r) => (
            <FilterChip
              key={r}
              label={ROLE_LABELS[r]}
              active={roleFilter === r}
              onPress={() => setRoleFilter(roleFilter === r ? null : r)}
            />
          ))}
        </ScrollView>

        {users.length === 0 ? (
          loading ? (
            <Card>
              <Text style={styles.subtle}>Memuat…</Text>
            </Card>
          ) : (
            <EmptyState icon={Users} title="Tidak ada akun" hint="Coba ubah kata kunci atau filter." />
          )
        ) : (
          users.map((item) => (
            <PressableCard key={item.id} onPress={() => openEdit(item)} style={styles.row}>
              <Avatar
                name={item.name}
                uri={toAbsoluteUrl(item.image) ?? undefined}
                headers={authImageHeaders()}
                size={40}
              />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                  {item.id === me?.id ? ' (Anda)' : ''}
                </Text>
                <Text style={styles.subtle} numberOfLines={1}>
                  {item.email}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Badge
                  text={ROLE_LABELS[item.role] ?? item.role}
                  tone={item.role === 'administrator' ? 'primary' : 'neutral'}
                />
                {item.technicianTeam ? (
                  <Text style={styles.team}>{TEAM_LABELS[item.technicianTeam]}</Text>
                ) : null}
              </View>
            </PressableCard>
          ))
        )}
      </ScrollView>

      <Sheet visible={editing !== null} title={editing?.name ?? 'Ubah'} onClose={() => setEditing(null)}>
        <Text style={styles.label}>Role</Text>
        <View style={styles.chipWrap}>
          {ROLE_OPTIONS.map((r) => (
            <FilterChip
              key={r}
              label={ROLE_LABELS[r]}
              active={draftRole === r}
              onPress={() => setDraftRole(r)}
            />
          ))}
        </View>

        {draftRole === 'teknisi' && (
          <>
            <Text style={styles.label}>Tim jaga malam</Text>
            <View style={styles.chipWrap}>
              <FilterChip
                label="Belum diatur"
                active={draftTeam === null}
                onPress={() => setDraftTeam(null)}
              />
              <FilterChip
                label="Tim Ganjil"
                active={draftTeam === 'ganjil'}
                onPress={() => setDraftTeam('ganjil')}
              />
              <FilterChip
                label="Tim Genap"
                active={draftTeam === 'genap'}
                onPress={() => setDraftTeam('genap')}
              />
            </View>
          </>
        )}

        {editing?.id === me?.id && draftRole !== 'administrator' && (
          <Text style={styles.warning}>
            Anda sedang menurunkan role akun Anda sendiri — akses panel administrator akan hilang
            setelah tersimpan.
          </Text>
        )}

        <Button
          title={saving ? 'Menyimpan...' : 'Simpan'}
          onPress={save}
          loading={saving}
          disabled={
            editing != null &&
            draftRole === editing.role &&
            (draftTeam ?? null) === (editing.technicianTeam ?? null)
          }
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  name: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  subtle: { fontSize: 12, color: colors.textSecondary },
  team: { fontSize: 11, color: colors.textSecondary },
  label: { fontSize: 13.5, fontWeight: '600', color: colors.textPrimary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  warning: { fontSize: 12, color: colors.warningStrong },
});
