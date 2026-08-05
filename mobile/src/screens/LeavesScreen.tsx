import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarPlus, ChevronLeft, FileText, TreePalm, Zap } from 'lucide-react-native';
import { api, ApiRequestError } from '../api/client';
import type {
  AttendanceRecordResponse,
  LeaveRequestResponse,
  LeaveType,
  PaginatedResponse,
  ScheduleResponse,
} from '../api/types';
import { useSession } from '../auth/session';
import { formatDate, formatDuration, formatTime, toLocalDateString } from '../lib/geo';
import { toLocalMonth } from '../lib/schedule';
import { buildOvertimeSessions, type OvertimeSession } from '../lib/session';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  HeaderIconButton,
  IconTile,
  ScreenHeader,
  SectionHeader,
  Sheet,
  type Tone,
} from '../components/ui';
import { appAlert } from '../components/AppAlert';
import { colors, radius, spacing } from '../theme';

const TYPE_LABELS: Record<string, string> = {
  sakit: 'Sakit',
  izin: 'Izin',
  cuti: 'Cuti',
  telat: 'Berangkat Telat',
  siang: 'Masuk Siang',
  remote: 'Remote',
  libur: 'Libur',
};

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Menunggu', tone: 'warning' },
  approved: { label: 'Disetujui', tone: 'success' },
  rejected: { label: 'Ditolak', tone: 'destructive' },
};

const OVERTIME_META: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Menunggu Admin', tone: 'warning' },
  approved: { label: 'Terverifikasi', tone: 'success' },
  rejected: { label: 'Ditolak', tone: 'destructive' },
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function LeavesScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ Izin: { openForm?: boolean } | undefined }, 'Izin'>>();
  const insets = useSafeAreaInsets();
  const today = toLocalDateString(new Date());
  const { user } = useSession();
  const canRemote = user?.role === 'admin' || user?.role === 'noc';
  const typeOptions: Exclude<LeaveType, 'libur'>[] = [
    'sakit',
    'izin',
    'cuti',
    'telat',
    'siang',
    ...(canRemote ? (['remote'] as const) : []),
  ];

  const [leaves, setLeaves] = useState<LeaveRequestResponse[]>([]);
  const [overtime, setOvertime] = useState<OvertimeSession[]>([]);
  const [scheduledLibur, setScheduledLibur] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<Exclude<LeaveType, 'libur'>>('izin');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    const [res, schedule, attendance] = await Promise.all([
      api<{ data: LeaveRequestResponse[] }>('/api/leaves?userId=self'),
      // Libur menurut jadwal shift sudah otomatis masuk rekap — tombol penanda
      // manual disembunyikan agar tidak dobel.
      api<ScheduleResponse>(
        `/api/schedules?month=${toLocalMonth(new Date())}&userId=self`
      ).catch(() => ({ users: [], entries: [], participantsConfigured: false })),
      // Riwayat lembur diturunkan dari record absensi kind='lembur' — server
      // belum punya endpoint khusus, jadi pasangan masuk/pulang dirakit di sini.
      api<PaginatedResponse<AttendanceRecordResponse>>('/api/attendance?userId=self&limit=100').catch(
        () => ({ data: [] as AttendanceRecordResponse[] }) as PaginatedResponse<AttendanceRecordResponse>
      ),
    ]);
    setLeaves(res.data);
    setScheduledLibur(schedule.entries.some((e) => e.date === today && e.shift === 'libur'));
    setOvertime(buildOvertimeSessions(attendance.data));
  }, [today]);

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

  // Dibuka langsung dari aksi cepat Dashboard.
  useEffect(() => {
    if (route.params?.openForm) setFormOpen(true);
  }, [route.params?.openForm]);

  const todayLibur = useMemo(
    () =>
      leaves.find(
        (l) =>
          l.type === 'libur' &&
          l.status === 'approved' &&
          l.startDate <= today &&
          today <= l.endDate
      ),
    [leaves, today]
  );

  const markLibur = async () => {
    try {
      await api('/api/leaves', {
        method: 'POST',
        body: JSON.stringify({ type: 'libur', startDate: today, endDate: today }),
      });
      appAlert('Tercatat ✓', 'Hari ini tercatat sebagai libur');
      await loadData();
    } catch (err) {
      const e = err as ApiRequestError;
      appAlert(
        'Gagal',
        e.code === 'LEAVE_OVERLAP' ? 'Sudah ada izin/libur pada hari ini' : e.message
      );
    }
  };

  const submitLeave = async () => {
    if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
      appAlert('Tanggal tidak valid', 'Gunakan format YYYY-MM-DD, mis. 2026-07-24');
      return;
    }
    if (!reason.trim()) {
      appAlert('Alasan wajib diisi');
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
      appAlert('Terkirim ✓', 'Pengajuan menunggu persetujuan administrator');
      await loadData();
    } catch (err) {
      const e = err as ApiRequestError;
      appAlert(
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
    appAlert('Batalkan?', `${TYPE_LABELS[leave.type]} ${leave.startDate}`, [
      { text: 'Tidak' },
      {
        text: 'Ya, batalkan',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/leaves/${leave.id}`, { method: 'DELETE' });
            await loadData();
          } catch (err) {
            appAlert('Gagal membatalkan', (err as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Izin & Lembur"
        subtitle="Ajukan izin, cuti, atau lihat riwayat lembur"
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
        {/* Status libur hari ini + aksi */}
        {todayLibur ? (
          <View style={styles.banner}>
            <TreePalm size={17} color={colors.warningStrong} />
            <Text style={styles.bannerTitle}>Hari ini tercatat Libur</Text>
          </View>
        ) : scheduledLibur ? (
          <View style={[styles.banner, { flexDirection: 'column', gap: 4 }]}>
            <View style={styles.bannerRow}>
              <TreePalm size={17} color={colors.warningStrong} />
              <Text style={styles.bannerTitle}>Hari ini Libur sesuai jadwal</Text>
            </View>
            <Text style={styles.bannerHint}>
              Otomatis tercatat di rekap — tidak perlu menandai apa pun.
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {!todayLibur && !scheduledLibur && (
            <Button
              title="Libur Hari Ini"
              icon={TreePalm}
              variant="outline"
              style={{ flex: 1 }}
              onPress={markLibur}
            />
          )}
          <Button
            title="Ajukan Izin"
            icon={CalendarPlus}
            variant="outline"
            style={{ flex: 1 }}
            onPress={() => setFormOpen(true)}
          />
        </View>

        {/* Pengajuan izin */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Pengajuan Anda" icon={FileText} />
          {leaves.length === 0 ? (
            <Card>
              {loading ? (
                <Text style={styles.subtle}>Memuat…</Text>
              ) : (
                <Text style={styles.subtle}>Belum ada pengajuan izin/libur.</Text>
              )}
            </Card>
          ) : (
            leaves.map((item) => {
              const meta = STATUS_META[item.status];
              const cancellable =
                item.status === 'pending' || (item.type === 'libur' && item.endDate >= today);
              return (
                <Card key={item.id} style={{ gap: 5 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.itemTitle}>{TYPE_LABELS[item.type]}</Text>
                    <Badge text={meta.label} tone={meta.tone} />
                  </View>
                  <Text style={styles.subtle}>
                    {item.startDate === item.endDate
                      ? item.startDate
                      : `${item.startDate} → ${item.endDate}`}
                  </Text>
                  {item.reason ? <Text style={styles.subtle}>{item.reason}</Text> : null}
                  {item.status === 'rejected' && item.reviewNote ? (
                    <Text style={styles.rejectNote}>Alasan ditolak: {item.reviewNote}</Text>
                  ) : null}
                  {cancellable && (
                    <Pressable onPress={() => cancelLeave(item)} hitSlop={6}>
                      <Text style={styles.cancelLink}>Batalkan</Text>
                    </Pressable>
                  )}
                </Card>
              );
            })
          )}
        </View>

        {/* Riwayat lembur */}
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Riwayat Lembur" icon={Zap} />
          {overtime.length === 0 ? (
            loading ? null : (
              <EmptyState
                icon={Zap}
                title="Belum ada sesi lembur"
                hint="Sesi lembur urgent dimulai dari layar Absen."
              />
            )
          ) : (
            overtime.map((s) => {
              const meta = OVERTIME_META[s.status] ?? OVERTIME_META.pending;
              return (
                <Card key={s.id} style={styles.overtimeCard}>
                  <IconTile icon={Zap} tone={meta.tone} size={36} rounded="circle" />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      Lembur Urgent · {formatDate(s.startedAt)}
                    </Text>
                    <Text style={styles.subtle} numberOfLines={2}>
                      {s.notes ? `${s.notes} · ` : ''}
                      {s.endedAt
                        ? formatDuration(s.startedAt, s.endedAt)
                        : `berjalan sejak ${formatTime(s.startedAt)}`}
                    </Text>
                  </View>
                  <Badge text={s.endedAt ? meta.label : 'Berjalan'} tone={s.endedAt ? meta.tone : 'primary'} />
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Sheet ajukan izin */}
      <Sheet visible={formOpen} title="Ajukan Izin" onClose={() => setFormOpen(false)}>
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label}>Jenis</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {typeOptions.map((t) => (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                style={[styles.typeButton, type === t && styles.typeButtonActive]}
              >
                <Text
                  style={{
                    fontSize: 13,
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
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warningSubtle,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bannerTitle: { fontSize: 13, fontWeight: '700', color: colors.warningStrong },
  bannerHint: { fontSize: 11.5, color: colors.warningStrong, textAlign: 'center' },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  itemTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  subtle: { fontSize: 12, color: colors.textSecondary },
  label: { fontSize: 13.5, fontWeight: '600', color: colors.textPrimary },
  rejectNote: { fontSize: 12, color: colors.destructive },
  cancelLink: { color: colors.destructive, fontSize: 13, fontWeight: '600' },

  overtimeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },

  typeButton: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  typeButtonActive: { borderColor: colors.primary, backgroundColor: colors.primarySubtle },
});
