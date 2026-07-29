import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
  Check,
  Package,
  Plus,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react-native';
import { api, ApiRequestError } from '../api/client';
import type { StockItemResponse, StockMovementResponse, StockMovementType, StockStatus } from '../api/types';
import {
  Button,
  Badge,
  EmptyState,
  Fab,
  Field,
  FilterChip,
  IconTile,
  ScreenHeader,
  SectionHeader,
  Sheet,
  StatCard,
  type Tone,
} from '../components/ui';
import { colors, radius, spacing } from '../theme';

const ALL = '__all__';

const STATUS_META: Record<StockStatus, { label: string; tone: Tone }> = {
  habis: { label: 'STOK HABIS', tone: 'destructive' },
  menipis: { label: 'STOK MENIPIS', tone: 'warning' },
  aman: { label: 'STOK AMAN', tone: 'success' },
};

export function StockScreen() {
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<StockItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(ALL);

  // --- Sheet catat mutasi ---
  const [sheetOpen, setSheetOpen] = useState(false);
  /** 'pick' = memilih barang, 'form' = mengisi jumlah/foto/catatan. */
  const [step, setStep] = useState<'pick' | 'form'>('pick');
  const [pickQuery, setPickQuery] = useState('');
  const [type, setType] = useState<Exclude<StockMovementType, 'adjust'>>('masuk');
  const [itemId, setItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const loadItems = useCallback(async () => {
    const res = await api<{ data: StockItemResponse[] }>('/api/stock/items');
    setItems(res.data);
  }, []);

  useEffect(() => {
    loadItems()
      .catch((err) => Alert.alert('Gagal memuat barang', err?.message ?? 'Coba lagi'))
      .finally(() => setLoading(false));
  }, [loadItems]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadItems()
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, [loadItems]);

  const selected = items.find((i) => i.id === itemId) ?? null;

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const i of items) if (i.categoryName) names.add(i.categoryName);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const matches = useCallback(
    (i: StockItemResponse, q: string) =>
      i.name.toLowerCase().includes(q) ||
      i.code.toLowerCase().includes(q) ||
      (i.categoryName ?? '').toLowerCase().includes(q),
    []
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (category === ALL || i.categoryName === category) && (q === '' || matches(i, q))
    );
  }, [items, query, category, matches]);

  const pickList = useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    return q === '' ? items : items.filter((i) => matches(i, q));
  }, [items, pickQuery, matches]);

  const lowStockCount = items.filter((i) => i.status !== 'aman').length;

  // --- Sheet ---
  const openSheet = (preselect?: StockItemResponse) => {
    setItemId(preselect?.id ?? null);
    setStep(preselect ? 'form' : 'pick');
    setType('masuk');
    setQuantity('1');
    setNote('');
    setPhoto(null);
    setPickQuery('');
    setSheetOpen(true);
  };

  // --- Kamera ---
  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        Alert.alert('Kamera diperlukan', 'Izinkan akses kamera di pengaturan HP');
        return;
      }
    }
    setCameraOpen(true);
  };

  const capture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const raw = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!raw?.uri) throw new Error('Gagal mengambil foto');
      const processed = await manipulateAsync(raw.uri, [{ resize: { width: 1200 } }], {
        compress: 0.8,
        format: SaveFormat.JPEG,
        base64: true,
      });
      setPhoto(`data:image/jpeg;base64,${processed.base64}`);
      setCameraOpen(false);
    } catch (err) {
      Alert.alert('Gagal mengambil foto', err instanceof Error ? err.message : 'Coba lagi');
    } finally {
      setCapturing(false);
    }
  };

  const qty = Number(quantity);
  const canSubmit = !!itemId && Number.isFinite(qty) && qty >= 1 && !submitting;

  const handleSubmit = async () => {
    if (!itemId) return Alert.alert('Pilih barang dulu');
    if (!Number.isFinite(qty) || qty < 1) return Alert.alert('Jumlah minimal 1');
    if (type === 'keluar' && selected && qty > selected.currentStock) {
      return Alert.alert('Stok tidak cukup', `Stok tersisa ${selected.currentStock}`);
    }
    setSubmitting(true);
    try {
      await api<StockMovementResponse>('/api/stock/movements', {
        method: 'POST',
        body: JSON.stringify({
          itemId,
          type,
          quantity: qty,
          note: note.trim() || undefined,
          photoBase64: photo ?? undefined,
        }),
      });
      setSheetOpen(false);
      Alert.alert('Tersimpan ✓', type === 'masuk' ? 'Barang masuk dicatat' : 'Barang keluar dicatat');
      await loadItems().catch(() => undefined);
    } catch (err) {
      const e = err as ApiRequestError;
      Alert.alert('Gagal menyimpan', e.message ?? 'Tidak dapat terhubung ke server');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: StockItemResponse }) => {
    const meta = STATUS_META[item.status];
    return (
      <Pressable
        onPress={() => openSheet(item)}
        style={({ pressed }) => [styles.itemRow, pressed && { opacity: 0.7 }]}
      >
        <IconTile icon={Package} tone={meta.tone} size={44} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={styles.itemTopRow}>
            <Text style={styles.itemCategory} numberOfLines={1}>
              {(item.categoryName ?? 'TANPA KATEGORI').toUpperCase()}
            </Text>
            <Badge text={meta.label} tone={meta.tone} />
          </View>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.subtle}>
            {item.code} · Stok {item.currentStock} {item.unit}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Inventaris Barang" subtitle="Kelola stok gudang & peralatan lapangan" />

      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: 96,
          gap: spacing.sm,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
            {/* Pencarian */}
            <View style={styles.searchBox}>
              <Search size={17} color={colors.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Cari item atau kategori..."
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <X size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            {/* Filter kategori */}
            {categories.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm }}
              >
                <FilterChip label="Semua" active={category === ALL} onPress={() => setCategory(ALL)} />
                {categories.map((c) => (
                  <FilterChip
                    key={c}
                    label={c}
                    active={category === c}
                    onPress={() => setCategory(c)}
                  />
                ))}
              </ScrollView>
            )}

            {/* Ringkasan */}
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <StatCard
                icon={Package}
                value={String(items.length)}
                label="Total Item"
                tone="primary"
                style={{ flex: 1 }}
              />
              <StatCard
                icon={TriangleAlert}
                value={String(lowStockCount)}
                label="Perlu Perhatian"
                tone="warning"
                emphasizeValue
                style={{ flex: 1 }}
              />
            </View>

            <SectionHeader title={`Daftar Item (${visible.length})`} />
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon={Package}
              title="Tidak ada barang"
              hint={
                query || category !== ALL
                  ? 'Coba ubah kata kunci atau filter kategori.'
                  : 'Barang ditambahkan oleh admin gudang lewat web.'
              }
            />
          )
        }
      />

      <Fab
        icon={Plus}
        onPress={() => openSheet()}
        bottom={spacing.xl}
        accessibilityLabel="Catat stok masuk atau keluar"
      />

      {/* Sheet catat mutasi */}
      <Sheet
        visible={sheetOpen}
        title={step === 'pick' ? 'Pilih Barang' : 'Catat Stok'}
        onClose={() => setSheetOpen(false)}
      >
        {step === 'pick' ? (
          <View style={{ gap: spacing.md }}>
            <View style={styles.searchBox}>
              <Search size={17} color={colors.textSecondary} />
              <TextInput
                value={pickQuery}
                onChangeText={setPickQuery}
                placeholder="Cari nama / kode…"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
              />
            </View>
            {pickList.length === 0 ? (
              <Text style={[styles.subtle, { textAlign: 'center', paddingVertical: spacing.xl }]}>
                Tidak ada barang cocok.
              </Text>
            ) : (
              pickList.slice(0, 50).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setItemId(item.id);
                    setStep('form');
                  }}
                  style={({ pressed }) => [styles.pickRow, pressed && { opacity: 0.6 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickName}>{item.name}</Text>
                    <Text style={styles.subtle}>
                      {item.code} · {item.categoryName ?? 'Tanpa kategori'} · stok{' '}
                      {item.currentStock} {item.unit}
                    </Text>
                  </View>
                  {item.id === itemId && <Check size={18} color={colors.primary} />}
                </Pressable>
              ))
            )}
          </View>
        ) : (
          <>
            {/* Barang terpilih */}
            <Pressable onPress={() => setStep('pick')} style={styles.selectedItem}>
              <IconTile icon={Package} tone={selected ? STATUS_META[selected.status].tone : 'neutral'} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickName} numberOfLines={1}>
                  {selected ? selected.name : 'Pilih barang'}
                </Text>
                {selected ? (
                  <Text style={styles.subtle}>
                    {selected.code} · stok {selected.currentStock} {selected.unit}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.changeLink}>Ganti</Text>
            </Pressable>

            {/* Masuk / keluar */}
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              {(['masuk', 'keluar'] as const).map((t) => {
                const active = type === t;
                const Icon = t === 'masuk' ? ArrowDownToLine : ArrowUpFromLine;
                const activeColor = t === 'masuk' ? colors.success : colors.warningStrong;
                const activeBg = t === 'masuk' ? colors.successSubtle : colors.warningSubtle;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    style={[
                      styles.toggle,
                      active && { borderColor: activeColor, backgroundColor: activeBg },
                    ]}
                  >
                    <Icon size={18} color={active ? activeColor : colors.textSecondary} strokeWidth={2.3} />
                    <Text
                      style={{
                        fontWeight: '700',
                        textTransform: 'capitalize',
                        color: active ? activeColor : colors.textSecondary,
                      }}
                    >
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Field
              label={`Jumlah ${type}`}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              placeholder="1"
            />

            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Foto Barang (opsional)</Text>
              {photo ? (
                <>
                  <Image source={{ uri: photo }} style={styles.preview} resizeMode="cover" />
                  <Button title="Ambil Ulang" variant="outline" onPress={() => setPhoto(null)} />
                </>
              ) : (
                <Button title="Ambil Foto" icon={Camera} variant="outline" onPress={openCamera} />
              )}
            </View>

            <Field
              label="Catatan (opsional)"
              value={note}
              onChangeText={setNote}
              maxLength={500}
              multiline
              placeholder="mis. supplier / tujuan pemakaian"
            />

            <Button
              title={
                submitting
                  ? 'Menyimpan...'
                  : type === 'masuk'
                    ? 'Simpan Barang Masuk'
                    : 'Simpan Barang Keluar'
              }
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
            />
          </>
        )}
      </Sheet>

      {/* Modal kamera */}
      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />
          <View style={[styles.cameraControls, { paddingBottom: insets.bottom + spacing.xxl }]}>
            <Pressable onPress={() => setCameraOpen(false)} style={styles.cameraSide}>
              <X size={26} color="#FFF" />
              <Text style={styles.cameraSideText}>Batal</Text>
            </Pressable>
            <Pressable
              onPress={capture}
              disabled={capturing}
              style={[styles.shutter, capturing && { opacity: 0.5 }]}
            />
            <Pressable
              onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
              style={styles.cameraSide}
            >
              <Camera size={26} color="#FFF" />
              <Text style={styles.cameraSideText}>Balik</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 0 },

  itemRow: {
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
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemCategory: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, color: colors.textSecondary, flexShrink: 1 },
  itemName: { fontSize: 13.5, fontWeight: '600', color: colors.textPrimary },
  subtle: { fontSize: 11.5, color: colors.textSecondary },
  label: { fontSize: 13.5, fontWeight: '600', color: colors.textPrimary },

  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  changeLink: { fontSize: 12.5, fontWeight: '600', color: colors.primary },

  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md },

  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: spacing.xxl,
    backgroundColor: '#000',
  },
  cameraSide: { width: 72, alignItems: 'center' },
  cameraSideText: { color: '#FFF', fontSize: 15 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF',
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
});
