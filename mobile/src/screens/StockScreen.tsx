import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { ArrowDownToLine, ArrowUpFromLine, Camera, Check, Package, Search, X } from 'lucide-react-native';
import { api, ApiRequestError } from '../api/client';
import type { StockItemResponse, StockMovementResponse, StockMovementType } from '../api/types';
import { Button, Card, Field } from '../components/ui';
import { colors, radius, spacing } from '../theme';

export function StockScreen() {
  const [items, setItems] = useState<StockItemResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<Exclude<StockMovementType, 'adjust'>>('masuk');
  const [itemId, setItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

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

  const selected = items.find((i) => i.id === itemId) ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
    );
  }, [items, search]);

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
  const canSubmit =
    !!itemId && Number.isFinite(qty) && qty >= 1 && !submitting;

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
      Alert.alert('Tersimpan ✓', type === 'masuk' ? 'Barang masuk dicatat' : 'Barang keluar dicatat');
      setItemId(null);
      setQuantity('1');
      setNote('');
      setPhoto(null);
      await loadItems().catch(() => undefined);
    } catch (err) {
      const e = err as ApiRequestError;
      Alert.alert('Gagal menyimpan', e.message ?? 'Tidak dapat terhubung ke server');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <Text style={styles.title}>Catat Stok Masuk / Keluar</Text>

        {/* Toggle masuk / keluar */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {(['masuk', 'keluar'] as const).map((t) => {
            const active = type === t;
            const Icon = t === 'masuk' ? ArrowDownToLine : ArrowUpFromLine;
            const activeColor = t === 'masuk' ? colors.success : colors.warning;
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

        {/* Pilih barang */}
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Barang</Text>
          <Pressable style={styles.select} onPress={() => setPickerOpen(true)} disabled={loading}>
            <Package size={18} color={colors.textSecondary} />
            <Text style={{ flex: 1, color: selected ? colors.textPrimary : colors.textSecondary }}>
              {loading
                ? 'Memuat barang…'
                : selected
                  ? `${selected.code} — ${selected.name}`
                  : 'Pilih barang'}
            </Text>
          </Pressable>
          {selected && (
            <Text style={styles.subtle}>
              Stok saat ini: {selected.currentStock} {selected.unit}
            </Text>
          )}
        </View>

        {/* Jumlah */}
        <Field
          label={`Jumlah ${type}`}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
          placeholder="1"
        />

        {/* Foto */}
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

        {/* Catatan */}
        <Field
          label="Catatan (opsional)"
          value={note}
          onChangeText={setNote}
          maxLength={500}
          multiline
          placeholder="mis. supplier / tujuan pemakaian"
        />

        <Button
          title={submitting ? 'Menyimpan...' : type === 'masuk' ? 'Simpan Barang Masuk' : 'Simpan Barang Keluar'}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
      </Card>

      {/* Modal pilih barang */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Pilih Barang</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}>
                <X size={24} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.searchBox}>
              <Search size={18} color={colors.textSecondary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Cari nama / kode…"
                placeholderTextColor={colors.textSecondary}
                style={{ flex: 1, fontSize: 16, color: colors.textPrimary }}
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(i) => i.id}
              keyboardShouldPersistTaps="handled"
              style={{ marginTop: spacing.md }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickRow}
                  onPress={() => {
                    setItemId(item.id);
                    setPickerOpen(false);
                    setSearch('');
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickName}>{item.name}</Text>
                    <Text style={styles.subtle}>
                      {item.code} · {item.categoryName ?? 'Tanpa kategori'} · stok {item.currentStock} {item.unit}
                    </Text>
                  </View>
                  {item.id === itemId && <Check size={20} color={colors.primary} />}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={[styles.subtle, { textAlign: 'center', marginTop: 24 }]}>
                  Tidak ada barang.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Modal kamera */}
      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />
          <View style={styles.cameraControls}>
            <Pressable onPress={() => setCameraOpen(false)} style={styles.cameraSide}>
              <X size={26} color="#FFF" />
              <Text style={styles.cameraSideText}>Batal</Text>
            </Pressable>
            <Pressable
              onPress={capture}
              disabled={capturing}
              style={[styles.shutter, capturing && { opacity: 0.5 }]}
            />
            <Pressable onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))} style={styles.cameraSide}>
              <Camera size={26} color="#FFF" />
              <Text style={styles.cameraSideText}>Balik</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  subtle: { fontSize: 13, color: colors.textSecondary },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 46,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 24,
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
