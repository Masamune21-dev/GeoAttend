'use client';

import { Fragment } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ItemPhoto } from './ItemPhoto';
import { StockStatusBadge } from './StockStatusBadge';
import type { StockItemResponse } from '@/types/api';

interface InventoryTableProps {
  items: StockItemResponse[];
  onEdit: (item: StockItemResponse) => void;
  onDelete: (item: StockItemResponse) => void;
}

interface Group {
  name: string;
  items: StockItemResponse[];
}

function groupByCategory(items: StockItemResponse[]): Group[] {
  const groups: Group[] = [];
  const index = new Map<string, Group>();
  for (const item of items) {
    const key = item.categoryName ?? 'Tanpa Kategori';
    let g = index.get(key);
    if (!g) {
      g = { name: key, items: [] };
      index.set(key, g);
      groups.push(g);
    }
    g.items.push(item);
  }
  return groups;
}

export function InventoryTable({ items, onEdit, onDelete }: InventoryTableProps) {
  const groups = groupByCategory(items);

  return (
    <div className="overflow-x-auto rounded-xl border border-border/80 bg-surface shadow-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-text-secondary">
            <th className="px-3 py-2.5 font-semibold">Barang</th>
            <th className="px-3 py-2.5 font-semibold">Kode</th>
            <th className="px-3 py-2.5 text-right font-semibold">Stok</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="px-3 py-2.5 text-right font-semibold">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.name}>
              <tr className="bg-secondary/60">
                <td colSpan={5} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-text-primary">
                  {group.name}{' '}
                  <span className="font-normal text-text-secondary">({group.items.length})</span>
                </td>
              </tr>
              {group.items.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    'border-b border-border/50 last:border-0',
                    item.status === 'habis' && 'bg-destructive-subtle/40',
                    item.status === 'menipis' && 'bg-warning-subtle/40'
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <ItemPhoto src={item.photoUrl} alt={item.name} className="h-9 w-9 shrink-0" />
                      <span className="font-medium text-text-primary">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-text-secondary">{item.code}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className="font-semibold text-text-primary">{item.currentStock}</span>
                    <span className="ml-1 text-xs text-text-secondary">{item.unit}</span>
                  </td>
                  <td className="px-3 py-2">
                    <StockStatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        aria-label={`Ubah ${item.name}`}
                        className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-secondary hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        aria-label={`Hapus ${item.name}`}
                        className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-destructive-subtle hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-10 text-center text-sm text-text-secondary">
                Tidak ada barang.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
