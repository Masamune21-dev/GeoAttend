import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../api/client';
import type { AttendanceRecordResponse, PaginatedResponse } from '../api/types';
import { formatDate, formatDistance, formatTime } from '../lib/geo';
import { Badge, Card } from '../components/ui';
import { colors, spacing } from '../theme';

export function HistoryScreen() {
  const [records, setRecords] = useState<AttendanceRecordResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const res = await api<PaginatedResponse<AttendanceRecordResponse>>(
      '/api/attendance?userId=self&limit=100'
    );
    setRecords(res.data);
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

  const renderItem = ({ item }: { item: AttendanceRecordResponse }) => {
    const isIn = item.type === 'clock_in';
    return (
      <Card style={styles.item}>
        <View style={styles.iconWrap}>
          <Text style={{ fontSize: 20 }}>{isIn ? '📥' : '📤'}</Text>
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
          {item.notes ? <Text style={styles.subtle}>📝 {item.notes}</Text> : null}
        </View>
        <Badge
          text={item.isWithinGeofence ? 'Dalam area' : 'Luar area'}
          tone={item.isWithinGeofence ? 'success' : 'destructive'}
        />
      </Card>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          loading ? (
            <Text style={[styles.subtle, { textAlign: 'center', marginTop: 24 }]}>Memuat...</Text>
          ) : (
            <Text style={[styles.subtle, { textAlign: 'center', marginTop: 24 }]}>
              Belum ada riwayat absensi
            </Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
