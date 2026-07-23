import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeftRight, Check, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { api, ApiRequestError } from '../api/client';
import type {
  PiketAssignment,
  PiketResponse,
  ScheduleResponse,
  ScheduleShift,
  SwapCandidate,
  SwapRequestResponse,
} from '../api/types';
import { useSession } from '../auth/session';
import { toLocalDateString } from '../lib/geo';
import {
  WEEKDAY_SHORT,
  toLocalMonth,
  monthDates,
  addMonth,
  monthLabel,
  weekdayOf,
  formatShortDate,
  SHIFT_BADGE,
  SWAP_META,
} from '../lib/schedule';
import { Badge, Button, Card, Field } from '../components/ui';
import { colors, radius, spacing } from '../theme';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function ScheduleScreen() {
  const { user } = useSession();
  const myId = user?.id;
  const today = toLocalDateString(new Date());

  const [month, setMonth] = useState(() => toLocalMonth(new Date()));
  const [entries, setEntries] = useState<Record<string, ScheduleShift>>({});
  const [swaps, setSwaps] = useState<SwapRequestResponse[]>([]);
  const [piket, setPiket] = useState<PiketAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [swapOpen, setSwapOpen] = useState(false);
  const [swapDate, setSwapDate] = useState('');
  const [requesterShift, setRequesterShift] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<SwapCandidate[]>([]);
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    const [sched, sw, pk] = await Promise.all([
      api<ScheduleResponse>(`/api/schedules?month=${month}&userId=self`),
      api<{ data: SwapRequestResponse[] }>('/api/swaps'),
      api<PiketResponse>(`/api/piket?month=${month}`),
    ]);
    const map: Record<string, ScheduleShift> = {};
    for (const e of sched.entries) map[e.date] = e.shift;
    setEntries(map);
    setSwaps(sw.data);
    setPiket(pk.assignments);
  }, [month]);

  useEffect(() => {
    setLoading(true);
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

  // Ambil kandidat rekan saat tanggal (ke depan) diisi di modal
  useEffect(() => {
    if (!swapOpen || !DATE_REGEX.test(swapDate) || swapDate <= today) {
      setRequesterShift(null);
      setCandidates([]);
      return;
    }
    let active = true;
    api<{ requesterShift: string | null; candidates: SwapCandidate[] }>(
      `/api/swaps/candidates?date=${swapDate}`
    )
      .then((r) => {
        if (!active) return;
        setRequesterShift(r.requesterShift);
        setCandidates(r.candidates);
      })
      .catch(() => {
        if (!active) return;
        setRequesterShift(null);
        setCandidates([]);
      });
    return () => {
      active = false;
    };
  }, [swapOpen, swapDate, today]);

  const dates = monthDates(month);
  const hasSchedule = Object.keys(entries).length > 0;
  const incoming = swaps.filter((s) => s.targetId === myId && s.status === 'pending_peer');
  const mine = swaps.filter((s) => s.requesterId === myId);
  const todayPiket = piket.find((p) => p.date === today);
  const myPiket = piket
    .filter((p) => p.userId === myId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const openSwap = () => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    setSwapDate(toLocalDateString(t));
    setTargetId('');
    setReason('');
    setSwapOpen(true);
  };

  const submitSwap = async () => {
    if (!targetId) {
      Alert.alert('Pilih rekan', 'Pilih rekan yang akan ditukar');
      return;
    }
    setSubmitting(true);
    try {
      await api('/api/swaps', {
        method: 'POST',
        body: JSON.stringify({ date: swapDate, targetUserId: targetId, reason: reason.trim() || undefined }),
      });
      setSwapOpen(false);
      Alert.alert('Terkirim ✓', 'Pengajuan tukar dikirim ke rekan');
      await loadData();
    } catch (err) {
      Alert.alert('Gagal', (err as ApiRequestError).message);
    } finally {
      setSubmitting(false);
    }
  };

  const respondPeer = async (id: string, action: 'peer_accept' | 'peer_reject') => {
    try {
      await api(`/api/swaps/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) });
      await loadData();
    } catch (err) {
      Alert.alert('Gagal', (err as Error).message);
    }
  };

  const cancelSwap = (s: SwapRequestResponse) => {
    Alert.alert('Batalkan pengajuan?', `Tukar dengan ${s.targetName} (${formatShortDate(s.date)})`, [
      { text: 'Tidak' },
      {
        text: 'Ya, batalkan',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/swaps/${s.id}`, { method: 'DELETE' });
            await loadData();
          } catch (err) {
            Alert.alert('Gagal', (err as Error).message);
          }
        },
      },
    ]);
  };

  const togglePiket = async (date: string, done: boolean) => {
    try {
      await api('/api/piket', { method: 'PATCH', body: JSON.stringify({ date, done }) });
      await loadData();
    } catch (err) {
      Alert.alert('Gagal', (err as Error).message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header bulan */}
        <View style={styles.monthRow}>
          <Pressable onPress={() => setMonth((m) => addMonth(m, -1))} style={styles.navBtn}>
            <ChevronLeft size={20} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
          <Pressable onPress={() => setMonth((m) => addMonth(m, 1))} style={styles.navBtn}>
            <ChevronRight size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        <Button title="Ajukan Tukar Shift" icon={ArrowLeftRight} variant="outline" onPress={openSwap} />

        {/* Permintaan tukar untuk saya */}
        {incoming.length > 0 && (
          <Card style={{ gap: spacing.md }}>
            <Text style={styles.cardTitle}>Permintaan tukar untuk kamu</Text>
            {incoming.map((s) => (
              <View key={s.id} style={styles.swapItem}>
                <Text style={styles.body}>
                  {s.requesterName} minta tukar {formatShortDate(s.date)} — kamu ke Shift{' '}
                  {s.requesterShift}, dia ke Shift {s.targetShift}.
                </Text>
                {s.reason ? <Text style={styles.subtle}>“{s.reason}”</Text> : null}
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button title="Terima" icon={Check} variant="success" style={{ flex: 1 }} onPress={() => respondPeer(s.id, 'peer_accept')} />
                  <Button title="Tolak" icon={X} variant="outline" style={{ flex: 1 }} onPress={() => respondPeer(s.id, 'peer_reject')} />
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Piket */}
        <Card style={{ gap: spacing.md }}>
          <Text style={styles.cardTitle}>Piket Kebersihan</Text>
          <Text style={styles.body}>
            Petugas hari ini:{' '}
            <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
              {todayPiket ? todayPiket.userName : '—'}
            </Text>
          </Text>
          {todayPiket && todayPiket.userId === myId && (
            <Button
              title={todayPiket.done ? 'Batalkan tanda' : 'Tandai sudah piket'}
              variant={todayPiket.done ? 'outline' : 'success'}
              onPress={() => togglePiket(today, !todayPiket.done)}
            />
          )}
          {myPiket.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={styles.subtle}>Jadwal piket kamu bulan ini:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {myPiket.map((a) => {
                  const editable = a.date <= today;
                  return (
                    <Pressable
                      key={a.date}
                      disabled={!editable}
                      onPress={() => editable && togglePiket(a.date, !a.done)}
                      style={[styles.piketChip, a.done && styles.piketChipDone, !editable && { opacity: 0.6 }]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: a.done ? '#15803D' : colors.textSecondary }}>
                        {formatShortDate(a.date)}
                        {a.done ? ' ✓' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </Card>

        {/* Jadwal saya */}
        <Card style={{ gap: 2 }}>
          <Text style={[styles.cardTitle, { marginBottom: 6 }]}>Jadwal Saya</Text>
          {loading ? (
            <Text style={styles.subtle}>Memuat…</Text>
          ) : !hasSchedule ? (
            <Text style={styles.subtle}>Belum ada jadwal untuk bulan ini</Text>
          ) : (
            dates.map((d) => {
              const shift = entries[d];
              const meta = shift ? SHIFT_BADGE[shift] : null;
              const isToday = d === today;
              const isSunday = weekdayOf(d) === 0;
              return (
                <View key={d} style={[styles.dayRow, isToday && styles.dayRowToday]}>
                  <Text style={[styles.dayLabel, isSunday && { color: colors.destructive }]}>
                    <Text style={{ fontWeight: '700' }}>{Number(d.slice(-2))}</Text> {WEEKDAY_SHORT[weekdayOf(d)]}
                    {isToday ? '  • Hari ini' : ''}
                  </Text>
                  {meta ? <Badge text={meta.label} tone={meta.tone} /> : <Text style={styles.subtle}>—</Text>}
                </View>
              );
            })
          )}
        </Card>

        {/* Pengajuan tukar saya */}
        {mine.length > 0 && (
          <Card style={{ gap: spacing.md }}>
            <Text style={styles.cardTitle}>Pengajuan tukar saya</Text>
            {mine.map((s) => {
              const meta = SWAP_META[s.status];
              const cancellable = s.status === 'pending_peer' || s.status === 'pending_admin';
              return (
                <View key={s.id} style={styles.swapItem}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.body}>Tukar dgn {s.targetName}</Text>
                    <Badge text={meta.label} tone={meta.tone} />
                  </View>
                  <Text style={styles.subtle}>
                    {formatShortDate(s.date)} · S{s.requesterShift} ↔ S{s.targetShift}
                  </Text>
                  {s.reviewNote ? <Text style={styles.subtle}>Catatan: {s.reviewNote}</Text> : null}
                  {cancellable && (
                    <Pressable onPress={() => cancelSwap(s)}>
                      <Text style={{ color: colors.destructive, fontWeight: '600', fontSize: 14 }}>Batalkan</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>

      {/* Modal ajukan tukar */}
      <Modal visible={swapOpen} animationType="slide" transparent onRequestClose={() => setSwapOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView contentContainerStyle={{ gap: spacing.lg }} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Ajukan Tukar Shift</Text>
              <Field
                label="Tanggal (ke depan)"
                value={swapDate}
                onChangeText={(v) => {
                  setSwapDate(v);
                  setTargetId('');
                }}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
              />
              {requesterShift == null ? (
                <Text style={styles.subtle}>
                  Isi tanggal terjadwal (kamu tidak libur) untuk melihat rekan yang bisa ditukar.
                </Text>
              ) : candidates.length === 0 ? (
                <Text style={styles.subtle}>
                  Shift kamu Shift {requesterShift}. Tidak ada rekan satu role dengan shift berbeda pada
                  tanggal itu.
                </Text>
              ) : (
                <View style={{ gap: 8 }}>
                  <Text style={styles.label}>Shift kamu: Shift {requesterShift}. Pilih rekan:</Text>
                  {candidates.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setTargetId(c.id)}
                      style={[styles.candidate, targetId === c.id && styles.candidateActive]}
                    >
                      <Text style={{ fontWeight: '600', color: targetId === c.id ? colors.primary : colors.textPrimary }}>
                        {c.name}
                      </Text>
                      <Text style={styles.subtle}>Shift {c.shift}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Field
                label="Alasan (opsional)"
                value={reason}
                onChangeText={setReason}
                multiline
                maxLength={500}
                placeholder="Contoh: ada keperluan"
              />
              <Button
                title={submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
                loading={submitting}
                disabled={!targetId}
                onPress={submitSwap}
              />
              <Button title="Batal" variant="outline" onPress={() => setSwapOpen(false)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, minWidth: 130, textAlign: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  body: { fontSize: 14, color: colors.textPrimary },
  subtle: { fontSize: 13, color: colors.textSecondary },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  swapItem: { gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dayRowToday: { backgroundColor: colors.primarySubtle, borderRadius: 8, paddingHorizontal: 8 },
  dayLabel: { fontSize: 14, color: colors.textPrimary },
  piketChip: {
    borderRadius: radius.full,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  piketChipDone: { backgroundColor: colors.successSubtle },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  candidateActive: { borderColor: colors.primary, backgroundColor: colors.primarySubtle },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
});
