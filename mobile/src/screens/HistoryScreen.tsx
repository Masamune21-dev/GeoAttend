import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ArrowDownToLine, ArrowUpFromLine, LogIn, LogOut, StickyNote } from 'lucide-react-native';
import { api } from '../api/client';
import type {
  AttendanceRecordResponse,
  PaginatedResponse,
  StockMovementResponse,
} from '../api/types';
import { formatDate, formatDistance, formatTime } from '../lib/geo';
import { Badge, Card, Segmented } from '../components/ui';
import { colors, spacing } from '../theme';

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
    return (
      <Card style={styles.item}>
        <View style={[styles.iconWrap, !isIn && { backgroundColor: colors.warningSubtle }]}>
          {isIn ? (
            <LogIn size={20} color={colors.primary} strokeWidth={2.2} />
          ) : (
            <LogOut size={20} color={colors.warning} strokeWidth={2.2} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.itemTitle}>
            {isIn ? 'Absen Masuk' : 'Absen Pulang'}
            {item.shiftNumber != null ? ` · Shift ${item.shiftNumber}` : ''}
          </Text>
          <Text style={styles.subtle}>
            {formatDate(item.timestamp)} · {formatTime(item.timestamp)} ·{' '}
            {formatDistance(item.distanceFromCenter)} dari pusat
          </Text>
          {item.notes ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <StickyNote size={12} color={colors.textSecondary} />
              <Text style={[styles.subtle, { flex: 1 }]}>{item.notes}</Text>
            </View>
          ) : null}
        </View>
        <Badge
          text={item.isWithinGeofence ? 'Dalam area' : 'Luar area'}
          tone={item.isWithinGeofence ? 'success' : 'destructive'}
        />
      </Card>
    );
  };

  const renderMovement = ({ item }: { item: StockMovementResponse }) => {
    const isIn = item.type === 'masuk';
    const isOut = item.type === 'keluar';
    return (
      <Card style={styles.item}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: isIn ? colors.successSubtle : isOut ? colors.warningSubtle : '#F1F5F9' },
          ]}
        >
          {isIn ? (
            <ArrowDownToLine size={20} color={colors.success} strokeWidth={2.2} />
          ) : (
            <ArrowUpFromLine size={20} color={isOut ? colors.warning : colors.textSecondary} strokeWidth={2.2} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.itemTitle}>{item.itemName}</Text>
          <Text style={styles.subtle}>
            {item.itemCode} · {formatDate(item.createdAt)} {formatTime(item.createdAt)}
            {item.createdByName ? ` · ${item.createdByName}` : ''}
          </Text>
          {item.note ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <StickyNote size={12} color={colors.textSecondary} />
              <Text style={[styles.subtle, { flex: 1 }]}>{item.note}</Text>
            </View>
          ) : null}
        </View>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '700',
            color: isIn ? colors.success : isOut ? colors.warning : colors.textPrimary,
          }}
        >
          {isOut ? '−' : isIn ? '+' : ''}
          {item.quantity}
        </Text>
      </Card>
    );
  };

  const emptyText =
    tab === 'absensi' ? 'Belum ada riwayat absensi' : 'Belum ada riwayat stok masuk/keluar';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
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
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <Text style={styles.empty}>{loading ? 'Memuat...' : emptyText}</Text>
          }
        />
      ) : (
        <FlatList
          data={movements}
          keyExtractor={(item) => item.id}
          renderItem={renderMovement}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <Text style={styles.empty}>{loading ? 'Memuat...' : emptyText}</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 40, gap: spacing.md },
  empty: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 24 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  subtle: { fontSize: 12.5, color: colors.textSecondary },
});
