'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownToLine, ArrowUpFromLine, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog } from '@/components/ui/dialog';
import { CameraCapture } from '@/components/features/attendance/CameraCapture';
import { cn } from '@/lib/utils';
import { useCreateMovement, useStockItems } from '@/hooks/useStock';
import type { StockItemResponse, StockMovementType } from '@/types/api';

interface CategoryGroup {
  name: string;
  items: StockItemResponse[];
}

export function MovementForm({ onDone }: { onDone?: () => void }) {
  const { data, isLoading } = useStockItems();
  const createMovement = useCreateMovement();

  const [type, setType] = useState<StockMovementType>('masuk');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const items = data?.data ?? [];
  const selected = items.find((i) => i.id === itemId);
  const isMasuk = type === 'masuk';
  const qty = Number(quantity);
  const stockAfter = selected
    ? isMasuk
      ? selected.currentStock + qty
      : selected.currentStock - qty
    : 0;

  const groups = useMemo<CategoryGroup[]>(() => {
    const out: CategoryGroup[] = [];
    const idx = new Map<string, CategoryGroup>();
    for (const it of items) {
      const key = it.categoryName ?? 'Tanpa Kategori';
      let g = idx.get(key);
      if (!g) {
        g = { name: key, items: [] };
        idx.set(key, g);
        out.push(g);
      }
      g.items.push(it);
    }
    return out;
  }, [items]);

  const reset = () => {
    setItemId('');
    setQuantity('1');
    setNote('');
    setPhotoBase64(null);
    setShowCamera(false);
  };

  /**
   * Simpan lewat konfirmasi dulu — sejalan dengan aplikasi mobile.
   * Kesalahan tersering: barang yang seharusnya keluar tercatat masuk, dan
   * baru ketahuan saat stok tak cocok.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId) return toast.error('Pilih barang dulu');
    if (!qty || qty < 1) return toast.error('Jumlah minimal 1');
    if (type === 'keluar' && selected && qty > selected.currentStock) {
      return toast.error(`Stok tidak cukup (tersisa ${selected.currentStock})`);
    }
    setConfirmOpen(true);
  };

  const save = async () => {
    const summary = selected
      ? `${selected.name} · stok sekarang ${stockAfter} ${selected.unit}`
      : undefined;
    setConfirmOpen(false);
    try {
      await createMovement.mutateAsync({
        itemId,
        type,
        quantity: qty,
        note: note.trim() || undefined,
        ...(photoBase64 ? { photoBase64 } : {}),
      });
      // Stok hasilnya disebut lagi supaya salah arah langsung kelihatan
      toast.success(isMasuk ? 'Barang masuk tercatat' : 'Barang keluar tercatat', {
        description: summary,
      });
      reset();
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Toggle masuk / keluar */}
      <div className="grid grid-cols-2 gap-2">
        {(['masuk', 'keluar'] as const).map((t) => {
          const Icon = t === 'masuk' ? ArrowDownToLine : ArrowUpFromLine;
          const active = type === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold capitalize transition-colors',
                active && t === 'masuk' && 'border-success bg-success-subtle text-green-700',
                active && t === 'keluar' && 'border-amber-500 bg-warning-subtle text-amber-700',
                !active && 'border-border bg-surface text-text-secondary hover:bg-secondary'
              )}
            >
              <Icon className="h-4 w-4" />
              {t}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mv-item">Barang</Label>
        <Select
          id="mv-item"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          disabled={isLoading}
        >
          <option value="">{isLoading ? 'Memuat…' : '— Pilih barang —'}</option>
          {groups.map((g) => (
            <optgroup key={g.name} label={g.name}>
              {g.items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.code} — {it.name} (stok {it.currentStock})
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        {selected && (
          <p className="text-xs text-text-secondary">
            Stok saat ini: <span className="font-semibold text-text-primary">{selected.currentStock}</span>{' '}
            {selected.unit}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mv-qty">Jumlah {type === 'masuk' ? 'masuk' : 'keluar'}</Label>
        <Input
          id="mv-qty"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>

      {/* Foto bukti */}
      <div className="flex flex-col gap-2">
        <Label>Foto Barang (opsional)</Label>
        {showCamera ? (
          <CameraCapture
            initialFacingMode="environment"
            capturedImage={photoBase64}
            onCapture={(b64) => {
              setPhotoBase64(b64);
              setShowCamera(false);
            }}
            onRetake={() => setPhotoBase64(null)}
          />
        ) : photoBase64 ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoBase64} alt="Foto barang" className="h-16 w-16 rounded-md object-cover" />
            <Button type="button" variant="outline" size="sm" onClick={() => setShowCamera(true)}>
              <Camera className="h-4 w-4" />
              Ambil Ulang
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setShowCamera(true)}>
            <Camera className="h-4 w-4" />
            Ambil Foto
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mv-note">Catatan (opsional)</Label>
        <Textarea
          id="mv-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="mis. supplier, tujuan pemakaian…"
        />
      </div>

      <Button type="submit" size="lg" isLoading={createMovement.isPending}>
        Simpan {type === 'masuk' ? 'Barang Masuk' : 'Barang Keluar'}
      </Button>
      {/* Konfirmasi arah sebelum tersimpan — arah ditulis gamblang, dan tombol
          setujunya ikut menyebut arah agar tidak ditekan refleks. Semua tombol
          di dalamnya type="button" supaya tidak ikut men-submit form ini. */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={isMasuk ? 'Catat BARANG MASUK?' : 'Catat BARANG KELUAR?'}
      >
        <div className="flex flex-col gap-4">
          <div
            className={cn(
              'rounded-lg border p-3',
              isMasuk ? 'border-success bg-success-subtle' : 'border-amber-500 bg-warning-subtle'
            )}
          >
            <p className="font-semibold text-text-primary">{selected?.name}</p>
            <p className="font-mono text-xs text-text-secondary">{selected?.code}</p>
          </div>

          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-text-secondary">Jumlah {isMasuk ? 'masuk' : 'keluar'}</dt>
              <dd className="font-semibold text-text-primary">
                {qty} {selected?.unit}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-text-secondary">Stok</dt>
              <dd className="text-text-primary">
                {selected?.currentStock} <span aria-hidden="true">→</span>{' '}
                <span
                  className={cn('text-base font-bold', isMasuk ? 'text-success' : 'text-warning')}
                >
                  {stockAfter}
                </span>{' '}
                {selected?.unit}
              </dd>
            </div>
            {note.trim() && (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-text-secondary">Catatan</dt>
                <dd className="text-right text-text-primary">{note.trim()}</dd>
              </div>
            )}
          </dl>

          <p className="rounded-md bg-secondary p-3 text-xs leading-relaxed text-text-secondary">
            {isMasuk
              ? 'MASUK = barang DITAMBAH ke gudang (mis. kiriman supplier, sisa alat dikembalikan). Kalau barang ini justru dibawa keluar, tekan “Periksa lagi” lalu ganti ke Keluar.'
              : 'KELUAR = barang DIAMBIL dari gudang (mis. dipakai ke lokasi pelanggan). Kalau barang ini justru masuk gudang, tekan “Periksa lagi” lalu ganti ke Masuk.'}
          </p>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
            >
              Periksa lagi
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={save}
              isLoading={createMovement.isPending}
            >
              Ya, {isMasuk ? 'Barang Masuk' : 'Barang Keluar'}
            </Button>
          </div>
        </div>
      </Dialog>
    </form>
  );
}
