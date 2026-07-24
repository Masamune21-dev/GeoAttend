'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Camera, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { CameraCapture } from '@/components/features/attendance/CameraCapture';
import { ItemPhoto } from './ItemPhoto';
import { useCreateStockItem, useUpdateStockItem } from '@/hooks/useStock';
import type { StockCategoryResponse, StockItemResponse } from '@/types/api';

interface ItemFormDialogProps {
  open: boolean;
  onClose: () => void;
  item?: StockItemResponse | null;
  categories: StockCategoryResponse[];
}

export function ItemFormDialog({ open, onClose, item, categories }: ItemFormDialogProps) {
  const isEdit = !!item;
  const createItem = useCreateStockItem();
  const updateItem = useUpdateStockItem();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [openingStock, setOpeningStock] = useState('0');
  const [minStock, setMinStock] = useState('5');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(item?.code ?? '');
    setName(item?.name ?? '');
    setCategoryId(item?.categoryId ?? '');
    setUnit(item?.unit ?? 'pcs');
    setOpeningStock(String(item?.openingStock ?? 0));
    setMinStock(String(item?.minStock ?? 5));
    setPhotoBase64(null);
    setShowCamera(false);
  }, [open, item]);

  const pending = createItem.isPending || updateItem.isPending;
  const existingPhoto = item?.photoUrl ?? null;
  const previewPhoto = photoBase64 ?? existingPhoto;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error('Kode dan nama barang wajib diisi');
      return;
    }
    const payload = {
      code: code.trim(),
      name: name.trim(),
      categoryId: categoryId || null,
      unit: unit.trim() || 'pcs',
      openingStock: Number(openingStock) || 0,
      minStock: Number(minStock) || 0,
      ...(photoBase64 ? { photoBase64 } : {}),
    };
    try {
      if (isEdit && item) {
        await updateItem.mutateAsync({ id: item.id, ...payload });
        toast.success('Barang diperbarui');
      } else {
        await createItem.mutateAsync(payload);
        toast.success('Barang ditambahkan');
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan barang');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? 'Ubah Barang' : 'Tambah Barang'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">Kode</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="K-XXXX" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unit">Satuan</Label>
            <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nama Barang</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama barang" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Kategori</Label>
          <Select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— Tanpa kategori —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opening">Stok Awal</Label>
            <Input
              id="opening"
              type="number"
              value={openingStock}
              onChange={(e) => setOpeningStock(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="min">Ambang Menipis</Label>
            <Input id="min" type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </div>
        </div>

        {/* Foto barang */}
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
          ) : (
            <div className="flex items-center gap-3">
              <ItemPhoto src={previewPhoto} alt={name} className="h-16 w-16" />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCamera(true)}>
                  <Camera className="h-4 w-4" />
                  {previewPhoto ? 'Ganti' : 'Ambil Foto'}
                </Button>
                {photoBase64 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPhotoBase64(null)}>
                    <Trash2 className="h-4 w-4" />
                    Hapus
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-1 flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" className="flex-1" isLoading={pending}>
            {isEdit ? 'Simpan' : 'Tambah'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
