import { ArrowDownToLine, ArrowUpFromLine, Boxes, CircleAlert, Package, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { StockOverviewResponse } from '@/types/api';

interface StatCardsProps {
  data: StockOverviewResponse;
}

export function StatCards({ data }: StatCardsProps) {
  const cards = [
    { label: 'Jenis Barang', value: data.totalItems, icon: Package, color: 'text-primary bg-primary-subtle' },
    { label: 'Total Stok', value: data.totalStock, icon: Boxes, color: 'text-accent bg-sky-50' },
    { label: 'Masuk (periode)', value: data.totalIn, icon: ArrowDownToLine, color: 'text-success bg-success-subtle' },
    { label: 'Keluar (periode)', value: data.totalOut, icon: ArrowUpFromLine, color: 'text-amber-600 bg-warning-subtle' },
    { label: 'Stok Menipis', value: data.lowStockCount, icon: TrendingDown, color: 'text-amber-700 bg-warning-subtle' },
    { label: 'Stok Habis', value: data.outOfStockCount, icon: CircleAlert, color: 'text-destructive bg-destructive-subtle' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-3 p-4 md:p-4">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.color}`}
                aria-hidden="true"
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold tracking-tight text-text-primary tabular-nums">
                  {c.value.toLocaleString('id-ID')}
                </p>
                <p className="truncate text-xs text-text-secondary">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
