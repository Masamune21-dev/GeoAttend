import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeftRight, Check, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react-native';
import { api, ApiRequestError, authImageHeaders, toAbsoluteUrl } from '../api/client';
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
  WEEKDAY_INITIAL,
  WEEKDAY_SHORT,
  toLocalMonth,
  monthDates,
  addMonth,
  monthLabel,
  weekdayOf,
  formatShortDate,
  PIKET_DOT,
  SHIFT_BADGE,
  SHIFT_DOT,
  SWAP_META,
} from '../lib/schedule';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  HeaderIconButton,
  ScreenHeader,
  SectionHeader,
  Sheet,
} from '../components/ui';
import { appAlert } from '../components/AppAlert';
import { colors, radius, spacing } from '../theme';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
/** Jumlah baris "Jadwal Saya" sebelum tombol "Lihat semua". */
const PREVIEW_DAYS = 7;

const LEGEND: { color: string; label: string }[] = [
  { color: SHIFT_DOT['1'], label: 'Shift 1' },
  { color: SHIFT_DOT['2'], label: 'Shift 2' },
  { color: SHIFT_DOT.libur, label: 'Libur' },
  { color: PIKET_DOT, label: 'Piket' },
];

export function ScheduleScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ Jadwal: { openSwap?: boolean } | undefined }, 'Jadwal'>>();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const myId = user?.id;
  const today = toLocalDateString(new Date());

  const [month, setMonth] = useState(() => toLocalMonth(new Date()));
  const [entries, setEntries] = useState<Record<string, ScheduleShift>>({});
  const [swaps, setSwaps] = useState<SwapRequestResponse[]>([]);
  const [piket, setPiket] = useState<PiketAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  // Ambil kandidat rekan saat tanggal (ke depan) diisi di sheet
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

  const dates = useMemo(() => monthDates(month), [month]);
  const hasSchedule = Object.keys(entries).length > 0;
  const incoming = swaps.filter((s) => s.targetId === myId && s.status === 'pending_peer');
  const mine = swaps.filter((s) => s.requesterId === myId);
  const todayPiket = piket.find((p) => p.date === today);
  const myPiket = useMemo(
    () => piket.filter((p) => p.userId === myId).sort((a, b) => a.date.localeCompare(b.date)),
    [piket, myId]
  );
  const myPiketDates = useMemo(() => new Set(myPiket.map((p) => p.date)), [myPiket]);

  /** Baris "Jadwal Saya": mulai hari ini bila bulan berjalan, selain itu dari tanggal 1. */
  const listDates = useMemo(() => {
    if (expanded) return dates;
    const startIndex = Math.max(0, dates.indexOf(today));
    return dates.slice(startIndex, startIndex + PREVIEW_DAYS);
  }, [dates, expanded, today]);

  const openSwap = useCallback(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    setSwapDate(toLocalDateString(t));
    setTargetId('');
    setReason('');
    setSwapOpen(true);
  }, []);

  // Dibuka langsung dari aksi cepat Dashboard.
  useEffect(() => {
    if (route.params?.openSwap) openSwap();
  }, [route.params?.openSwap, openSwap]);

  const submitSwap = async () => {
    if (!targetId) {
      appAlert('Pilih rekan', 'Pilih rekan yang akan ditukar');
      return;
    }
    setSubmitting(true);
    try {
      await api('/api/swaps', {
        method: 'POST',
        body: JSON.stringify({
          date: swapDate,
          targetUserId: targetId,
          reason: reason.trim() || undefined,
        }),
      });
      setSwapOpen(false);
      appAlert('Terkirim ✓', 'Pengajuan tukar dikirim ke rekan');
      await loadData();
    } catch (err) {
      appAlert('Gagal', (err as ApiRequestError).message);
    } finally {
      setSubmitting(false);
    }
  };

  const respondPeer = async (id: string, action: 'peer_accept' | 'peer_reject') => {
    try {
      await api(`/api/swaps/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) });
      await loadData();
    } catch (err) {
      appAlert('Gagal', (err as Error).message);
    }
  };

  const cancelSwap = (s: SwapRequestResponse) => {
    appAlert('Batalkan pengajuan?', `Tukar dengan ${s.targetName} (${formatShortDate(s.date)})`, [
      { text: 'Tidak' },
      {
        text: 'Ya, batalkan',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/swaps/${s.id}`, { method: 'DELETE' });
            await loadData();
          } catch (err) {
            appAlert('Gagal', (err as Error).message);
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
      appAlert('Gagal', (err as Error).message);
    }
  };

  // Sel kosong sebelum tanggal 1 agar kolom sejajar dengan hari.
  const leadingBlanks = dates.length > 0 ? weekdayOf(dates[0]) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Jadwal Shift"
        subtitle="Kalender kerja & pengajuan tukar shift"
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
        {/* Kalender bulanan */}
        <Card style={{ gap: spacing.md }}>
          <View style={styles.monthRow}>
            <Pressable onPress={() => setMonth((m) => addMonth(m, -1))} style={styles.navBtn} hitSlop={6}>
              <ChevronLeft size={14} color={colors.textPrimary} strokeWidth={2.4} />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
            <Pressable onPress={() => setMonth((m) => addMonth(m, 1))} style={styles.navBtn} hitSlop={6}>
              <ChevronRight size={14} color={colors.textPrimary} strokeWidth={2.4} />
            </Pressable>
          </View>

          <View style={styles.grid}>
            {WEEKDAY_INITIAL.map((w, i) => (
              <View key={`h-${i}`} style={styles.cell}>
                <Text style={styles.weekdayText}>{w}</Text>
              </View>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <View key={`b-${i}`} style={styles.cell} />
            ))}
            {dates.map((d) => {
              const shift = entries[d];
              const isToday = d === today;
              const isSunday = weekdayOf(d) === 0;
              return (
                <View key={d} style={styles.cell}>
                  <View style={[styles.dayCircle, isToday && styles.dayCircleToday]}>
                    <Text
                      style={[
                        styles.dayText,
                        isSunday && { color: colors.destructive },
                        isToday && styles.dayTextToday,
                      ]}
                    >
                      {Number(d.slice(-2))}
                    </Text>
                  </View>
                  <View style={styles.dotRow}>
                    {shift ? <View style={[styles.dot, { backgroundColor: SHIFT_DOT[shift] }]} /> : null}
                    {myPiketDates.has(d) ? (
                      <View style={[styles.dot, { backgroundColor: PIKET_DOT }]} />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.legendRow}>
            {LEGEND.map((l) => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: l.color }]} />
                <Text style={styles.legendText} numberOfLines={1}>
                  {l.label}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Button title="Ajukan Tukar Shift" icon={ArrowLeftRight} variant="outline" onPress={openSwap} />

        {/* Permintaan tukar untuk saya */}
        {incoming.length > 0 && (
          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Permintaan tukar untuk kamu" icon={ArrowLeftRight} />
            {incoming.map((s) => (
              <Card key={s.id} style={{ gap: spacing.sm }}>
                <Text style={styles.body}>
                  {s.requesterName} minta tukar {formatShortDate(s.date)} — kamu ke Shift{' '}
                  {s.requesterShift}, dia ke Shift {s.targetShift}.
                </Text>
                {s.reason ? <Text style={styles.subtle}>“{s.reason}”</Text> : null}
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button
                    title="Terima"
                    icon={Check}
                    variant="success"
                    size="sm"
                    style={{ flex: 1 }}
                    onPress={() => respondPeer(s.id, 'peer_accept')}
                  />
                  <Button
                    title="Tolak"
                    icon={X}
                    variant="outline"
                    size="sm"
                    style={{ flex: 1 }}
                    onPress={() => respondPeer(s.id, 'peer_reject')}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Piket */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Piket Kebersihan" icon={Sparkles} />
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Avatar
                name={todayPiket?.userName ?? '—'}
                size={40}
                uri={toAbsoluteUrl(todayPiket?.userImage)}
                headers={authImageHeaders()}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.subtle}>Petugas hari ini</Text>
                <Text style={styles.cardStrong}>{todayPiket ? todayPiket.userName : '—'}</Text>
              </View>
              {todayPiket ? (
                <Badge
                  text={todayPiket.done ? 'Sudah piket' : 'Belum piket'}
                  tone={todayPiket.done ? 'success' : 'warning'}
                />
              ) : null}
            </View>

            {todayPiket && todayPiket.userId === myId && (
              <Button
                title={todayPiket.done ? 'Batalkan tanda' : 'Tandai sudah piket'}
                variant={todayPiket.done ? 'outline' : 'success'}
                size="sm"
                onPress={() => togglePiket(today, !todayPiket.done)}
              />
            )}

            {myPiket.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={styles.subtle}>Jadwal piket kamu bulan ini:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {myPiket.map((a) => {
                    const editable = a.date <= today;
                    return (
                      <Pressable
                        key={a.date}
                        disabled={!editable}
                        onPress={() => editable && togglePiket(a.date, !a.done)}
                        style={[
                          styles.piketChip,
                          a.done && styles.piketChipDone,
                          !editable && { opacity: 0.55 },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '600',
                            color: a.done ? colors.successStrong : colors.textSecondary,
                          }}
                        >
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
        </View>

        {/* Jadwal saya */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader
            title="Jadwal Saya"
            actionLabel={hasSchedule ? (expanded ? 'Ringkas' : 'Lihat semua') : undefined}
            onAction={hasSchedule ? () => setExpanded((v) => !v) : undefined}
          />
          <Card style={{ gap: 0 }}>
            {loading ? (
              <Text style={styles.subtle}>Memuat…</Text>
            ) : !hasSchedule ? (
              <Text style={styles.subtle}>Belum ada jadwal untuk bulan ini</Text>
            ) : (
              listDates.map((d, i) => {
                const shift = entries[d];
                const meta = shift ? SHIFT_BADGE[shift] : null;
                const isToday = d === today;
                const isSunday = weekdayOf(d) === 0;
                return (
                  <View
                    key={d}
                    style={[
                      styles.dayRow,
                      i === listDates.length - 1 && { borderBottomWidth: 0 },
                      isToday && styles.dayRowToday,
                    ]}
                  >
                    <Text style={[styles.dayLabel, isSunday && { color: colors.destructive }]}>
                      <Text style={{ fontWeight: '700' }}>{Number(d.slice(-2))}</Text>{' '}
                      {WEEKDAY_SHORT[weekdayOf(d)]}
                      {isToday ? ' · Hari ini' : ''}
                    </Text>
                    {meta ? (
                      <Badge text={meta.label} tone={meta.tone} />
                    ) : (
                      <Text style={styles.subtle}>—</Text>
                    )}
                  </View>
                );
              })
            )}
          </Card>
        </View>

        {/* Pengajuan tukar saya */}
        {mine.length > 0 && (
          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Pengajuan tukar saya" />
            {mine.map((s) => {
              const meta = SWAP_META[s.status];
              const cancellable = s.status === 'pending_peer' || s.status === 'pending_admin';
              return (
                <Card key={s.id} style={{ gap: 6 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardStrong}>Tukar dgn {s.targetName}</Text>
                    <Badge text={meta.label} tone={meta.tone} />
                  </View>
                  <Text style={styles.subtle}>
                    {formatShortDate(s.date)} · S{s.requesterShift} ↔ S{s.targetShift}
                  </Text>
                  {s.reviewNote ? <Text style={styles.subtle}>Catatan: {s.reviewNote}</Text> : null}
                  {cancellable && (
                    <Pressable onPress={() => cancelSwap(s)} hitSlop={6}>
                      <Text style={styles.cancelLink}>Batalkan</Text>
                    </Pressable>
                  )}
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Sheet ajukan tukar */}
      <Sheet visible={swapOpen} title="Ajukan Tukar Shift" onClose={() => setSwapOpen(false)}>
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
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.label}>Shift kamu: Shift {requesterShift}. Pilih rekan:</Text>
            {candidates.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setTargetId(c.id)}
                style={[styles.candidate, targetId === c.id && styles.candidateActive]}
              >
                <Avatar name={c.name} size={32} />
                <Text
                  style={{
                    flex: 1,
                    fontWeight: '600',
                    color: targetId === c.id ? colors.primary : colors.textPrimary,
                  }}
                >
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
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: { fontSize: 13.5, fontWeight: '700', color: colors.textPrimary },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: 3 },
  weekdayText: { fontSize: 10.5, fontWeight: '600', color: colors.textMuted, marginBottom: 2 },
  dayCircle: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dayCircleToday: { backgroundColor: colors.primary },
  dayText: { fontSize: 12.5, color: colors.textPrimary },
  dayTextToday: { color: colors.onPrimary, fontWeight: '700' },
  dotRow: { flexDirection: 'row', gap: 2, height: 6, marginTop: 1 },
  dot: { width: 5, height: 5, borderRadius: 3 },

  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.muted,
    paddingTop: spacing.md,
  },
  // flexShrink: 0 supaya item membungkus ke baris berikutnya, bukan diperas
  // sampai teksnya terpotong ("Piket" jadi "Pike").
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  legendText: { fontSize: 11, color: colors.textSecondary },

  body: { fontSize: 13.5, color: colors.textPrimary, lineHeight: 19 },
  subtle: { fontSize: 12.5, color: colors.textSecondary },
  label: { fontSize: 13.5, fontWeight: '600', color: colors.textPrimary },
  cardStrong: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cancelLink: { color: colors.destructive, fontWeight: '600', fontSize: 13 },

  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
  },
  dayRowToday: { backgroundColor: colors.primarySubtle, borderRadius: radius.sm },
  dayLabel: { fontSize: 13.5, color: colors.textPrimary },

  piketChip: {
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  piketChipDone: { backgroundColor: colors.successSubtle },

  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  candidateActive: { borderColor: colors.primary, backgroundColor: colors.primarySubtle },
});
