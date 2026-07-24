'use client';

import Link from 'next/link';
import { ArrowRight, ArrowDownToLine, ArrowUpFromLine, Inbox, Plus } from 'lucide-react';
import { useSession } from '@/lib/auth/client';
import { useStockOverview } from '@/hooks/useStock';
import { StatCards } from '@/components/features/stock/StatCards';
import { StockStatusBadge } from '@/components/features/stock/StockStatusBadge';
import { ItemPhoto } from '@/components/features/stock/ItemPhoto';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StockOverviewPage() {
  const { data, isLoading } = useStockOverview();
  const { data: session } = useSession();
  const isAdmin = session?.user.role === 'administrator';

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <Link href="/stock/movements" className={cn(buttonVariants(), 'gap-2')}>
          <Plus className="h-4 w-4" /> Catat Masuk / Keluar
        </Link>
      </div>

      <StatCards data={data} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Barang menipis / habis */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Perlu Perhatian</CardTitle>
            {isAdmin && (
              <Link href="/stock/inventory" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Inventory <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {data.lowStockItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-secondary">Semua stok aman 👍</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border/60">
                {data.lowStockItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-2">
                    <ItemPhoto src={item.photoUrl} alt={item.name} className="h-9 w-9 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{item.name}</p>
                      <p className="font-mono text-xs text-text-secondary">{item.code}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-text-primary">
                      {item.currentStock} {item.unit}
                    </span>
                    <StockStatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Pergerakan terbaru */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Pergerakan Terbaru</CardTitle>
            <Link href="/stock/history" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Riwayat <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {data.recentMovements.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Inbox className="h-8 w-8 text-text-secondary" aria-hidden="true" />
                <p className="text-sm text-text-secondary">Belum ada pergerakan stok.</p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-border/60">
                {data.recentMovements.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        m.type === 'masuk' ? 'bg-success-subtle text-green-700' : 'bg-warning-subtle text-amber-700'
                      }`}
                      aria-hidden="true"
                    >
                      {m.type === 'masuk' ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{m.itemName}</p>
                      <p className="text-xs text-text-secondary">{formatTime(m.createdAt)} · {m.createdByName ?? '—'}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {m.type === 'keluar' ? '−' : '+'}
                      {m.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
