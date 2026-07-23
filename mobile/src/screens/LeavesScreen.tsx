import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api, ApiRequestError } from '../api/client';
import type { LeaveRequestResponse, LeaveType } from '../api/types';
import { toLocalDateString } from '../lib/geo';
import { Badge, Button, Card, Field } from '../components/ui';
import { colors, spacing } from '../theme';

const TYPE_LABELS: Record<string, string> = {
  sakit: 'Sakit',
  izin: 'Izin',
  cuti: 'Cuti',
  libur: 'Libur',
};

const STATUS_META: Record<string, { label: string; tone: 'warning' | 'success' | 'destructive' }> = {
  pending: { label: 'Menunggu', tone: 'warning' },
  approved: { label: 'Disetujui', tone: 'success' },
  rejected: { label: 'Ditolak', tone: 'destructive' },
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function LeavesScreen() {
  const today = toLocalDateString(new Date());

  const [leaves, setLeaves] = useState<LeaveRequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<Exclude<LeaveType, 'libur'>>('izin');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    const res = await api<{ data: LeaveRequestResponse[] }>('/api/leaves?userId=self');
    setLeaves(res.data);
  }, []);

  useEffect(() => {
    loadData()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData()
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, [loadData]);

  const todayLibur = leaves.find(
    (l) => l.type === 'libur' && l.status === 'approved' && l.startDate <= today && today <= l.endDate
  );

  const markLibur = async () => {
    try {
      await api('/api/leaves', {
        method: 'POST',
        body: JSON.stringify({ type: 'libur', startDate: today, endDate: today }),
      });
      Alert.alert('Tercatat ✓', 'Hari ini tercatat sebagai libur');
      await loadData();
    } catch (err) {
      const e = err as ApiRequestError;
      Alert.alert(
        'Gagal',
        e.code === 'LEAVE_OVERLAP' ? 'Sudah ada izin/libur pada hari ini' : e.message
      );
    }
  };

  const submitLeave = async () => {
    if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
      Alert.alert('Tanggal tidak valid', 'Gunakan format YYYY-MM-DD, mis. 2026-07-24');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Alasan wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      await api('/api/leaves', {
        method: 'POST',
        body: JSON.stringify({
          type,
          startDate,
          endDate: endDate < startDate ? startDate : endDate,
          reason: reason.trim(),
        }),
      });
      setFormOpen(false);
      setReason('');
      Alert.alert('Terkirim ✓', 'Pengajuan menunggu persetujuan administrator');
      await loadData();
    } catch (err) {
      const e = err as ApiRequestError;
      Alert.alert(
        'Gagal mengirim',
        e.code === 'LEAVE_OVERLAP'
          ? 'Sudah ada pengajuan pada rentang tanggal tersebut'
          : e.message
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cancelLeave = (leave: LeaveRequestResponse) => {
    Alert.alert('Batalkan?', `${TYPE_LABELS[leave.type]} ${leave.startDate}`, [
      { text: 'Tidak' },
      {
        text: 'Ya, batalkan',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/leaves/${leave.id}`, { method: 'DELETE' });
            await loadData();
          } catch (err) {
            Alert.alert('Gagal membatalkan', (err as Error).message);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: LeaveRequestResponse }) => {
    const meta = STATUS_META[item.status];
    const cancellable =
      item.status === 'pending' || (item.type === 'libur' && item.endDate >= today);
    return (
      <Card style={{ marginBottom: spacing.md, gap: 6 }}>
        <View style={styles.rowBetween}>
          <Text style={styles.itemTitle}>{TYPE_LABELS[item.type]}</Text>
          <Badge text={meta.label} tone={meta.tone} />
        </View>
        <Text style={styles.subtle}>
          {item.startDate === item.endDate ? item.startDate : `${item.startDate} → ${item.endDate}`}
        </Text>
        {item.reason ? <Text style={styles.subtle}>{item.reason}</Text> : null}
        {item.status === 'rejected' && item.reviewNote ? (
          <Text style={{ fontSize: 13, color: colors.destructive }}>
            Alasan ditolak: {item.reviewNote}
          </Text>
        ) : null}
        {cancellable && (
          <Pressable onPress={() => cancelLeave(item)}>
            <Text style={{ color: colors.destructive, fontSize: 14, fontWeight: '600' }}>
              Batalkan
            </Text>
          </Pressable>
        )}
      </Card>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={leaves}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
            {todayLibur ? (
              <View style={styles.liburBanner}>
                <Text style={{ color: '#B45309', fontWeight: '600' }}>
                  🌴 Hari ini tercatat Libur
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Button
                  title="🌴 Libur Hari Ini"
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={markLibur}
                />
                <Button
                  title="📅 Ajukan Izin"
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={() => setFormOpen(true)}
                />
              </View>
            )}
            {leaves.length > 0 && <Text style={styles.sectionTitle}>Pengajuan Anda</Text>}
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <Text style={[styles.subtle, { textAlign: 'center', marginTop: 24 }]}>
              Belum ada pengajuan izin/libur
            </Text>
          )
        }
      />

      {/* Form ajukan izin */}
      <Modal
        visible={formOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFormOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView contentContainerStyle={{ gap: spacing.lg }} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Ajukan Izin</Text>

              <View style={{ gap: 8 }}>
                <Text style={styles.label}>Jenis</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['sakit', 'izin', 'cuti'] as const).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setType(t)}
                      style={[styles.typeButton, type === t && styles.typeButtonActive]}
                    >
                      <Text
                        style={{
                          fontWeight: '600',
                          color: type === t ? colors.primary : colors.textPrimary,
                        }}
                      >
                        {TYPE_LABELS[t]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Dari tanggal"
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    autoCapitalize="none"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Sampai tanggal"
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <Field
                label="Alasan"
                value={reason}
                onChangeText={setReason}
                maxLength={500}
                multiline
                placeholder="Contoh: Periksa ke dokter"
              />

              <Button
                title={submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
                onPress={submitLeave}
                loading={submitting}
              />
              <Button title="Batal" variant="outline" onPress={() => setFormOpen(false)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  subtle: { fontSize: 13, color: colors.textSecondary },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  liburBanner: {
    backgroundColor: colors.warningSubtle,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  typeButtonActive: { borderColor: colors.primary, backgroundColor: colors.primarySubtle },
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
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
});
