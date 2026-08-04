'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { Plus, Search } from 'lucide-react';
import { useSession } from '@/lib/auth/client';
import { isStockManager } from '@/lib/roles';
import { useDeleteStockItem, useStockCategories, useStockItems } from '@/hooks/useStock';
import { STOCK_STATUS_LABEL } from '@/lib/stock/labels';
import { xlsxSheet, xlsxWibDateTime, XLSX_DATETIME_FMT } from '@/lib/export/xlsx';
import { InventoryTable } from '@/components/features/stock/InventoryTable';
import { ItemFormDialog } from '@/components/features/stock/ItemFormDialog';
import { XlsxExportButton } from '@/components/features/export/XlsxExportButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { StockItemResponse } from '@/types/api';

export default function InventoryPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const canManage = isStockManager(session?.user.role);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockItemResponse | null>(null);

  // Kelola inventaris hanya untuk administrator / admin gudang; role lain dipantulkan.
  useEffect(() => {
    if (!isPending && session && !canManage) router.replace('/stock');
  }, [isPending, session, canManage, router]);

  const { data: catData } = useStockCategories();
  const { data, isLoading } = useStockItems({
    search: search.trim() || undefined,
    categoryId: categoryId || undefined,
  });
  const deleteItem = useDeleteStockItem();

  const categories = catData?.data ?? [];
  const items = data?.data ?? [];

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (item: StockItemResponse) => {
    setEditing(item);
    setDialogOpen(true);
  };
  /** Ekspor mengikuti hasil filter yang sedang tampil, beserta stok berjalannya. */
  const buildXlsxSheets = () => {
    const activeCategory = categories.find((c) => c.id === categoryId);
    const scope = [
      activeCategory ? `Kategori ${activeCategory.name}` : 'Semua kategori',
      search.trim() ? `Cari "${search.trim()}"` : null,
      `${items.length} barang`,
      `Dicetak ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: localeId })}`,
    ].filter(Boolean);

    return [
      xlsxSheet<StockItemResponse>({
        name: 'Inventaris',
        title: 'Inventaris Gudang',
        subtitle: scope.join(' · '),
        rows: items,
        columns: [
          { header: 'Kategori', width: 20, value: (i) => i.categoryName ?? 'Tanpa Kategori' },
          { header: 'Kode', width: 14, value: (i) => i.code },
          { header: 'Nama Barang', width: 32, value: (i) => i.name },
          { header: 'Satuan', width: 10, align: 'center', value: (i) => i.unit },
          { header: 'Stok Awal', width: 11, align: 'right', value: (i) => i.openingStock },
          { header: 'Stok Saat Ini', width: 12, align: 'right', value: (i) => i.currentStock },
          { header: 'Stok Minimum', width: 12, align: 'right', value: (i) => i.minStock },
          {
            header: 'Status',
            width: 12,
            align: 'center',
            value: (i) => STOCK_STATUS_LABEL[i.status],
          },
          {
            header: 'Pergerakan Terakhir',
            width: 18,
            align: 'center',
            numFmt: XLSX_DATETIME_FMT,
            value: (i) => xlsxWibDateTime(i.lastMovementAt),
          },
        ],
      }),
    ];
  };

  const handleDelete = async (item: StockItemResponse) => {
    if (!window.confirm(`Nonaktifkan barang "${item.name}"? Riwayat tetap tersimpan.`)) return;
    try {
      await deleteItem.mutateAsync(item.id);
      toast.success('Barang dinonaktifkan');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  };

  if (session && !canManage) {
    return (
      <p className="py-10 text-center text-sm text-text-secondary">
        Halaman ini khusus administrator / admin gudang. Mengalihkan…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau kode barang…"
            className="pl-9"
          />
        </div>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="sm:w-56">
          <option value="">Semua kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.itemCount})
            </option>
          ))}
        </Select>
        <XlsxExportButton
          filename={`inventaris_${format(new Date(), 'yyyy-MM-dd')}`}
          build={buildXlsxSheets}
          size="default"
        />
        <Button type="button" onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <InventoryTable items={items} onEdit={openEdit} onDelete={handleDelete} />
      )}

      <ItemFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        item={editing}
        categories={categories}
      />
    </div>
  );
}
