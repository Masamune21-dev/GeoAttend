import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  LogIn,
  LogOut,
  Package,
  StickyNote,
  Zap,
} from 'lucide-react-native';
import { api } from '../api/client';
import type {
  AttendanceRecordResponse,
  PaginatedResponse,
  StockMovementResponse,
} from '../api/types';
import { formatDistance, formatRelativeDay, formatTime } from '../lib/geo';
import {
  Badge,
  EmptyState,
  IconTile,
  ScreenHeader,
  Segmented,
  type IconType,
  type Tone,
} from '../components/ui';
import { colors, radius, spacing } from '../theme';

type Tab = 'absensi' | 'stok';

export function HistoryScreen() {
  const [tab, setTab] = useState<Tab>('absensi');
  const [records, setRecords] = useState<AttendanceRecordResponse[]>([]);
  const [movements, setMovements] = useState<StockMovementResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [attRes, mvRes] = await Promise.all([
      api<PaginatedResponse<AttendanceRecordResponse>>('/api/attendance?userId=self&limit=100'),
      api<PaginatedResponse<StockMovementResponse>>('/api/stock/movements?limit=100').catch(
        () => ({ data: [] as StockMovementResponse[] }) as PaginatedResponse<StockMovementResponse>
      ),
    ]);
    setRecords(attRes.data);
    setMovements(mvRes.data);
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

  const renderAttendance = ({ item }: { item: AttendanceRecordResponse }) => {
    const isIn = item.type === 'clock_in';
    const isOvertime = item.kind === 'lembur';
    const icon: IconType = isOvertime ? Zap : isIn ? LogIn : LogOut;
    const tone: Tone = isOvertime ? 'warning' : isIn ? 'primary' : 'warning';
    const title = isOvertime
      ? isIn
        ? 'Mulai Lembur Urgent'
        : 'Selesai Lembur'
      : `${isIn ? 'Absen Masuk' : 'Absen Pulang'}${item.shiftNumber != null ? ` · Shift ${item.shiftNumber}` : ''}`;

    return (
      <View style={styles.row}>
        <IconTile icon={icon} tone={tone} size={44} rounded="circle" />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtle}>
            {formatRelativeDay(item.timestamp)} · {formatTime(item.timestamp)} ·{' '}
            {formatDistance(item.distanceFromCenter)} dari pusat
          </Text>
          {item.notes ? (
            <View style={styles.noteRow}>
              <StickyNote size={11} color={colors.textMuted} />
              <Text style={[styles.subtle, { flex: 1 }]} numberOfLines={2}>
                {item.notes}
              </Text>
            </View>
          ) : null}
        </View>
        <Badge
          text={item.isWithinGeofence ? 'Dalam Area' : 'Luar Area'}
          tone={item.isWithinGeofence ? 'success' : 'destructive'}
        />
      </View>
    );
  };

  const renderMovement = ({ item }: { item: StockMovementResponse }) => {
    const isIn = item.type === 'masuk';
    const isOut = item.type === 'keluar';
    const tone: Tone = isIn ? 'success' : isOut ? 'warning' : 'neutral';
    return (
      <View style={styles.row}>
        <IconTile
          icon={isIn ? ArrowDownToLine : isOut ? ArrowUpFromLine : Package}
          tone={tone}
          size={44}
          rounded="circle"
        />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.itemName}
          </Text>
          <Text style={styles.subtle} numberOfLines={1}>
            {item.itemCode} · {formatRelativeDay(item.createdAt)} {formatTime(item.createdAt)}
            {item.createdByName ? ` · ${item.createdByName}` : ''}
          </Text>
          {item.note ? (
            <View style={styles.noteRow}>
              <StickyNote size={11} color={colors.textMuted} />
              <Text style={[styles.subtle, { flex: 1 }]} numberOfLines={2}>
                {item.note}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[
            styles.quantity,
            { color: isIn ? colors.success : isOut ? colors.warningStrong : colors.textPrimary },
          ]}
        >
          {isOut ? '−' : isIn ? '+' : ''}
          {item.quantity}
        </Text>
      </View>
    );
  };

  const listProps = {
    contentContainerStyle: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.sm,
    },
    refreshControl: (
      <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
    ),
    showsVerticalScrollIndicator: false,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Riwayat" subtitle="Log absensi & pergerakan stok Anda" />

      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'absensi', label: 'Absensi' },
            { value: 'stok', label: 'Stok Barang' },
          ]}
        />
      </View>

      {tab === 'absensi' ? (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={renderAttendance}
          {...listProps}
          ListEmptyComponent={
            loading ? null : (
              <EmptyState
                icon={History}
                title="Belum ada riwayat absensi"
                hint="Absen masuk pertama Anda akan muncul di sini."
              />
            )
          }
        />
      ) : (
        <FlatList
          data={movements}
          keyExtractor={(item) => item.id}
          renderItem={renderMovement}
          {...listProps}
          ListEmptyComponent={
            loading ? null : (
              <EmptyState icon={Package} title="Belum ada riwayat stok masuk/keluar" />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  rowTitle: { fontSize: 13.5, fontWeight: '600', color: colors.textPrimary },
  subtle: { fontSize: 11.5, color: colors.textSecondary },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quantity: { fontSize: 16, fontWeight: '700' },
});
