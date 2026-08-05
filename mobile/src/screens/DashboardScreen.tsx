import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeftRight,
  CalendarCheck,
  Clock,
  FileText,
  LogOut,
  MapPin,
  Sparkles,
  Zap,
} from 'lucide-react-native';
import { api, ApiRequestError, authImageHeaders, toAbsoluteUrl } from '../api/client';
import type {
  AttendanceRecordResponse,
  DayRosterMember,
  DayRosterResponse,
  PaginatedResponse,
  PiketResponse,
  ScheduleShift,
} from '../api/types';
import { useSession } from '../auth/session';
import { formatClock, formatLongDate, formatTime, toLocalDateString } from '../lib/geo';
import { ROSTER_ROLE_LABEL, ROSTER_ROLE_ORDER, toLocalMonth } from '../lib/schedule';
import { deriveOpenSession, sessionWindowStart } from '../lib/session';
import {
  Avatar,
  Badge,
  Button,
  Card,
  IconTile,
  PersonChip,
  SectionHeader,
  type IconType,
} from '../components/ui';
import { appAlert } from '../components/AppAlert';
import { useTabBarSpace } from '../components/TabBar';
import { colors, radius, shadow, spacing, type } from '../theme';

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  admin: 'Admin (Staf)',
  noc: 'NOC',
  teknisi: 'Teknisi',
  employee: 'Karyawan',
};

/** Urutan & label kelompok pada kartu roster harian. */
const ROSTER_GROUPS: { shift: ScheduleShift; label: string; bg: string; fg: string }[] = [
  { shift: '1', label: 'Shift 1', bg: '#FEF9C3', fg: '#854D0E' },
  { shift: '2', label: 'Shift 2', bg: '#E0F2FE', fg: '#075985' },
  { shift: 'libur', label: 'Libur', bg: colors.destructiveSubtle, fg: colors.destructiveStrong },
];

export function DashboardScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const isFocused = useIsFocused();
  const { user } = useSession();
  const today = toLocalDateString(new Date());

  const [now, setNow] = useState(() => new Date());
  const [records, setRecords] = useState<AttendanceRecordResponse[]>([]);
  const [roster, setRoster] = useState<DayRosterResponse | null>(null);
  const [piket, setPiket] = useState<PiketResponse['assignments']>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Jam dinding di header — cukup diperbarui tiap 20 detik.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    const [recentRes, rosterRes, piketRes] = await Promise.all([
      api<PaginatedResponse<AttendanceRecordResponse>>(
        `/api/attendance?userId=self&from=${encodeURIComponent(sessionWindowStart())}&limit=10`
      ),
      // Server lama belum punya endpoint roster — dashboard tetap tampil,
      // kartunya saja yang kosong.
      api<DayRosterResponse>('/api/schedules/today').catch((err) =>
        err instanceof ApiRequestError ? null : Promise.reject(err)
      ),
      api<PiketResponse>(`/api/piket?month=${toLocalMonth(new Date())}`).catch(() => ({
        users: [],
        assignments: [],
      })),
    ]);
    setRecords(recentRes.data);
    setRoster(rosterRes);
    setPiket(piketRes.assignments);
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

  const session = useMemo(() => deriveOpenSession(records), [records]);
  const isOvertime = session.kind === 'lembur';

  const ctaLabel =
    session.nextType === 'clock_in'
      ? 'Absen Masuk'
      : isOvertime
        ? 'Selesai Lembur'
        : 'Absen Pulang';

  const myShift = useMemo(
    () => roster?.members.find((m) => m.userId === user?.id)?.shift ?? null,
    [roster, user?.id]
  );

  // Isi tiap shift dipecah per role — roster dari API sudah urut role lalu nama
  const groups = useMemo(
    () =>
      ROSTER_GROUPS.map((g) => {
        const members = roster?.members.filter((m) => m.shift === g.shift) ?? [];
        const roles: { role: string; label: string; members: DayRosterMember[] }[] = [];
        for (const m of members) {
          let bucket = roles.find((r) => r.role === m.role);
          if (!bucket) {
            bucket = { role: m.role, label: ROSTER_ROLE_LABEL[m.role] ?? m.role, members: [] };
            roles.push(bucket);
          }
          bucket.members.push(m);
        }
        roles.sort(
          (a, b) => (ROSTER_ROLE_ORDER[a.role] ?? 99) - (ROSTER_ROLE_ORDER[b.role] ?? 99)
        );
        return { ...g, total: members.length, roles };
      }).filter((g) => g.total > 0),
    [roster]
  );

  const todayPiket = piket.find((p) => p.date === today) ?? null;

  const markPiketDone = async () => {
    try {
      await api('/api/piket', {
        method: 'PATCH',
        body: JSON.stringify({ date: today, done: !todayPiket?.done }),
      });
      await loadData();
    } catch (err) {
      appAlert('Gagal', (err as Error).message);
    }
  };

  const goAbsen = () => navigation.navigate('Tabs', { screen: 'Absen' });

  const quickActions: { icon: IconType; label: string; onPress: () => void }[] = [
    { icon: CalendarCheck, label: 'Jadwal', onPress: () => navigation.navigate('Jadwal') },
    {
      icon: ArrowLeftRight,
      label: 'Tukar Shift',
      onPress: () => navigation.navigate('Jadwal', { openSwap: true }),
    },
    { icon: FileText, label: 'Izin', onPress: () => navigation.navigate('Izin', { openForm: true }) },
    { icon: Zap, label: 'Lembur', onPress: () => navigation.navigate('Izin') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header biru butuh ikon status bar terang — hanya saat layar ini aktif,
          karena tab lain tetap ter-mount dan berlatar putih. */}
      {isFocused && <StatusBar style="light" />}
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl + tabBarSpace }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header biru: identitas, jam, tombol absen utama */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.heroTop}>
            <Avatar
              name={user?.name ?? '?'}
              size={44}
              uri={toAbsoluteUrl(user?.image)}
              headers={authImageHeaders()}
              color="rgba(255,255,255,0.2)"
              style={styles.heroAvatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName} numberOfLines={1}>
                {user?.name ?? '—'}
              </Text>
              <Text style={styles.heroRole} numberOfLines={1}>
                {ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? '-'}
              </Text>
            </View>
            {session.openRecord ? (
              <View style={styles.heroPill}>
                <View style={styles.livedot} />
                <Text style={styles.heroPillText}>
                  {isOvertime ? 'Lembur' : 'Hadir'} · {formatTime(session.openRecord.timestamp)}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.heroClock}>
            {formatClock(now)} WIB · {formatLongDate(now)}
          </Text>

          <Pressable
            onPress={goAbsen}
            style={({ pressed }) => [styles.heroCta, shadow.raised, pressed && { opacity: 0.9 }]}
          >
            {session.nextType === 'clock_in' ? (
              <MapPin size={20} color={colors.primary} strokeWidth={2.2} />
            ) : (
              <LogOut size={20} color={colors.primary} strokeWidth={2.2} />
            )}
            <Text style={styles.heroCtaText}>{ctaLabel}</Text>
          </Pressable>

          {myShift ? (
            <Text style={styles.heroHint}>
              {myShift === 'libur'
                ? 'Jadwal hari ini: Libur — tidak perlu menandai apa pun.'
                : `Jadwal hari ini: Shift ${myShift}`}
            </Text>
          ) : null}
        </View>

        <View style={{ padding: spacing.xl, gap: spacing.xxl }}>
          {/* Aksi cepat */}
          <View style={styles.quickRow}>
            {quickActions.map((action) => (
              <Pressable
                key={action.label}
                onPress={action.onPress}
                style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.6 }]}
              >
                <IconTile icon={action.icon} tone="primary" size={48} />
                <Text style={styles.quickLabel} numberOfLines={1}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Roster shift hari ini */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader
              title="Jadwal Shift Hari Ini"
              icon={Clock}
              actionLabel="Lihat"
              onAction={() => navigation.navigate('Jadwal')}
            />
            <Card style={{ gap: spacing.lg }}>
              {loading ? (
                <Text style={styles.subtle}>Memuat…</Text>
              ) : groups.length === 0 ? (
                <Text style={styles.subtle}>
                  {roster
                    ? 'Belum ada jadwal yang ditetapkan untuk hari ini.'
                    : 'Roster harian belum tersedia di server ini.'}
                </Text>
              ) : (
                groups.map((group) => (
                  <View key={group.shift} style={{ gap: spacing.sm }}>
                    <View style={styles.groupHeader}>
                      <View style={[styles.groupTag, { backgroundColor: group.bg }]}>
                        <Text style={[type.micro, { color: group.fg }]}>{group.label}</Text>
                      </View>
                      <Text style={[type.tiny, { color: colors.textSecondary }]}>
                        {group.total} orang
                      </Text>
                    </View>
                    {group.roles.map((r) => (
                      <View key={r.role} style={styles.roleGroup}>
                        <Text style={styles.roleLabel}>
                          {r.label.toUpperCase()}
                          <Text style={styles.roleCount}> ({r.members.length})</Text>
                        </Text>
                        <View style={styles.chipWrap}>
                          {r.members.map((m) => (
                            <PersonChip
                              key={m.userId}
                              name={m.name}
                              uri={toAbsoluteUrl(m.image)}
                              headers={authImageHeaders()}
                            />
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                ))
              )}
            </Card>
          </View>

          {/* Piket hari ini */}
          <View style={{ gap: spacing.md }}>
            <SectionHeader
              title="Piket Hari Ini"
              icon={Sparkles}
              actionLabel="Atur"
              onAction={() => navigation.navigate('Jadwal')}
            />
            <Card style={{ gap: spacing.md }}>
              {todayPiket ? (
                <>
                  <View style={styles.piketRow}>
                    <Avatar
                      name={todayPiket.userName}
                      size={44}
                      uri={toAbsoluteUrl(todayPiket.userImage)}
                      headers={authImageHeaders()}
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.piketName} numberOfLines={1}>
                        {todayPiket.userName}
                      </Text>
                      <Badge
                        text={todayPiket.done ? 'Sudah piket' : 'Belum piket'}
                        tone={todayPiket.done ? 'success' : 'warning'}
                      />
                    </View>
                  </View>
                  {todayPiket.userId === user?.id && (
                    <Button
                      title={todayPiket.done ? 'Batalkan tanda piket' : 'Tandai sudah piket'}
                      variant={todayPiket.done ? 'outline' : 'success'}
                      size="sm"
                      onPress={markPiketDone}
                    />
                  )}
                </>
              ) : (
                <Text style={styles.subtle}>Tidak ada petugas piket untuk hari ini.</Text>
              )}
            </Card>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.xxl + 4,
    borderBottomRightRadius: radius.xxl + 4,
    gap: spacing.lg,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroAvatar: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  heroName: { fontSize: 16, fontWeight: '700', color: colors.onPrimary },
  heroRole: { fontSize: 12.5, color: colors.onPrimarySubtle },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroPillText: { fontSize: 11, fontWeight: '700', color: colors.onPrimary },
  livedot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  heroClock: { fontSize: 12.5, color: colors.onPrimarySubtle },
  heroCta: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  heroCtaText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  heroHint: { fontSize: 12, color: colors.onPrimarySubtle, textAlign: 'center' },

  quickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quickItem: { alignItems: 'center', gap: 6, width: 72 },
  quickLabel: { fontSize: 11.5, fontWeight: '500', color: colors.textPrimary },

  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  groupTag: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleGroup: {
    gap: 6,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: spacing.md,
  },
  roleLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, color: colors.textSecondary },
  roleCount: { fontWeight: '600', letterSpacing: 0 },

  piketRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  piketName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },

  subtle: { fontSize: 12.5, color: colors.textSecondary },
});
