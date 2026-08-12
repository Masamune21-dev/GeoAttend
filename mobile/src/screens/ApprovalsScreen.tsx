import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, CheckCircle2, FileText, Repeat } from 'lucide-react-native';
import { api } from '../api/client';
import type { LeaveRequestResponse, SwapRequestResponse } from '../api/types';
import { useSession } from '../auth/session';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  HeaderIconButton,
  ScreenHeader,
  Segmented,
  Sheet,
} from '../components/ui';
import { appAlert } from '../components/AppAlert';
import { colors, radius, spacing } from '../theme';
import type { RootStackParamList } from '../navigation';

/**
 * Pusat persetujuan administrator: satu tempat untuk semua yang menunggu
 * keputusan. Dibuka dari kartu Dashboard yang hanya tampil bagi role
 * `administrator`, dan dari notifikasi push yang disentuh.
 *
 * Tidak memakai endpoint baru — persis endpoint yang sudah dipakai web.
 */

const TYPE_LABELS: Record<string, string> = {
  sakit: 'Sakit',
  izin: 'Izin',
  cuti: 'Cuti',
  telat: 'Berangkat Telat',
  siang: 'Masuk Siang',
  remote: 'Remote',
  libur: 'Libur',
};

const SHIFT_LABELS: Record<string, string> = {
  '1': 'Shift 1',
  '2': 'Shift 2',
  libur: 'Libur',
};

type TabKey = 'izin' | 'tukar';

/** Aksi yang sedang dikonfirmasi lewat sheet catatan. */
type PendingAction =
  | { kind: 'leave'; id: string; approve: boolean; title: string }
  | { kind: 'swap'; id: string; approve: boolean; title: string };

function formatRange(startDate: string, endDate: string): string {
  return startDate === endDate ? startDate : `${startDate} → ${endDate}`;
}

export function ApprovalsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Persetujuan'>>();
  const insets = useSafeAreaInsets();
  const { user } = useSession();

  const [tab, setTab] = useState<TabKey>(route.params?.tab ?? 'izin');
  const [leaves, setLeaves] = useState<LeaveRequestResponse[]>([]);
  const [swaps, setSwaps] = useState<SwapRequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [action, setAction] = useState<PendingAction | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    const [leaveRes, swapRes] = await Promise.all([
      api<{ data: LeaveRequestResponse[] }>('/api/leaves?status=pending'),
      api<{ data: SwapRequestResponse[] }>('/api/swaps?status=pending_admin'),
    ]);
    setLeaves(leaveRes.data);
    setSwaps(swapRes.data);
  }, []);

  useEffect(() => {
    loadData()
      .catch((err) => appAlert('Gagal memuat', (err as Error).message))
      .finally(() => setLoading(false));
  }, [loadData]);

  // Notifikasi yang disentuh bisa mengarahkan langsung ke tab yang relevan,
  // termasuk saat layar ini sudah terbuka di belakang.
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData()
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, [loadData]);

  const submitAction = async () => {
    if (!action) return;
    const trimmed = note.trim();

    // Penolakan tanpa alasan menyisakan pengaju menebak-nebak — web juga
    // memperlakukan catatan sebagai wajib saat menolak.
    if (!action.approve && !trimmed) {
      appAlert('Alasan wajib diisi', 'Tuliskan alasan penolakan agar pengaju tahu.');
      return;
    }

    setSubmitting(true);
    try {
      if (action.kind === 'leave') {
        await api(`/api/leaves/${action.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: action.approve ? 'approved' : 'rejected',
            reviewNote: trimmed || undefined,
          }),
        });
      } else {
        await api(`/api/swaps/${action.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            action: action.approve ? 'approve' : 'reject',
            reviewNote: trimmed || undefined,
          }),
        });
      }
      setAction(null);
      setNote('');
      appAlert(action.approve ? 'Disetujui ✓' : 'Ditolak', action.title);
      await loadData();
    } catch (err) {
      appAlert('Gagal memproses', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const openAction = (next: PendingAction) => {
    setNote('');
    setAction(next);
  };

  if (user?.role !== 'administrator') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader
          title="Persetujuan"
          left={
            <HeaderIconButton
              icon={ChevronLeft}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Kembali"
            />
          }
        />
        <View style={{ padding: spacing.xl }}>
          <EmptyState
            icon={CheckCircle2}
            title="Khusus administrator"
            hint="Halaman ini hanya untuk pengelola sistem."
          />
        </View>
      </View>
    );
  }

  const emptyHint = loading ? 'Memuat…' : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Persetujuan"
        subtitle="Pengajuan yang menunggu keputusan Anda"
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
          gap: spacing.xl,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Segmented<TabKey>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'izin', label: `Izin & Cuti${leaves.length ? ` (${leaves.length})` : ''}` },
            { value: 'tukar', label: `Tukar Shift${swaps.length ? ` (${swaps.length})` : ''}` },
          ]}
        />

        {tab === 'izin' ? (
          leaves.length === 0 ? (
            emptyHint ? (
              <Card>
                <Text style={styles.subtle}>{emptyHint}</Text>
              </Card>
            ) : (
              <EmptyState
                icon={FileText}
                title="Tidak ada pengajuan izin"
                hint="Semua pengajuan sudah diputuskan."
              />
            )
          ) : (
            leaves.map((item) => (
              <Card key={item.id} style={{ gap: 6 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.userName}
                  </Text>
                  <Badge text={TYPE_LABELS[item.type] ?? item.type} tone="warning" />
                </View>
                <Text style={styles.subtle}>{formatRange(item.startDate, item.endDate)}</Text>
                {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}
                <View style={styles.actions}>
                  <Button
                    title="Tolak"
                    variant="outline"
                    style={{ flex: 1 }}
                    onPress={() =>
                      openAction({
                        kind: 'leave',
                        id: item.id,
                        approve: false,
                        title: `${TYPE_LABELS[item.type] ?? item.type} — ${item.userName}`,
                      })
                    }
                  />
                  <Button
                    title="Setujui"
                    style={{ flex: 1 }}
                    onPress={() =>
                      openAction({
                        kind: 'leave',
                        id: item.id,
                        approve: true,
                        title: `${TYPE_LABELS[item.type] ?? item.type} — ${item.userName}`,
                      })
                    }
                  />
                </View>
              </Card>
            ))
          )
        ) : swaps.length === 0 ? (
          emptyHint ? (
            <Card>
              <Text style={styles.subtle}>{emptyHint}</Text>
            </Card>
          ) : (
            <EmptyState
              icon={Repeat}
              title="Tidak ada permintaan tukar"
              hint="Permintaan muncul di sini setelah rekan tujuan menyetujui."
            />
          )
        ) : (
          swaps.map((item) => (
            <Card key={item.id} style={{ gap: 6 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.requesterName} ↔ {item.targetName}
                </Text>
                <Badge text={item.kind === 'libur' ? 'Tukar Libur' : 'Tukar Shift'} tone="warning" />
              </View>
              <Text style={styles.subtle}>
                {item.kind === 'libur' && item.targetDate
                  ? `${item.date} ↔ ${item.targetDate}`
                  : item.date}
              </Text>
              <Text style={styles.subtle}>
                {SHIFT_LABELS[item.requesterShift] ?? item.requesterShift} →{' '}
                {SHIFT_LABELS[item.targetShift] ?? item.targetShift}
              </Text>
              {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}
              <View style={styles.actions}>
                <Button
                  title="Tolak"
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={() =>
                    openAction({
                      kind: 'swap',
                      id: item.id,
                      approve: false,
                      title: `${item.requesterName} ↔ ${item.targetName}`,
                    })
                  }
                />
                <Button
                  title="Setujui"
                  style={{ flex: 1 }}
                  onPress={() =>
                    openAction({
                      kind: 'swap',
                      id: item.id,
                      approve: true,
                      title: `${item.requesterName} ↔ ${item.targetName}`,
                    })
                  }
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Sheet
        visible={action !== null}
        title={action?.approve ? 'Setujui pengajuan' : 'Tolak pengajuan'}
        onClose={() => setAction(null)}
      >
        <Text style={styles.sheetSubject}>{action?.title}</Text>
        <Field
          label={action?.approve ? 'Catatan (opsional)' : 'Alasan penolakan'}
          value={note}
          onChangeText={setNote}
          maxLength={500}
          multiline
          placeholder={action?.approve ? 'Contoh: Sudah dikoordinasikan' : 'Contoh: Tim kurang orang hari itu'}
        />
        <Button
          title={submitting ? 'Memproses...' : action?.approve ? 'Setujui' : 'Tolak'}
          variant={action?.approve ? 'primary' : 'destructive'}
          onPress={submitAction}
          loading={submitting}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  subtle: { fontSize: 12, color: colors.textSecondary },
  reason: {
    fontSize: 12.5,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: 2 },
  sheetSubject: { fontSize: 13.5, fontWeight: '600', color: colors.textPrimary },
});
