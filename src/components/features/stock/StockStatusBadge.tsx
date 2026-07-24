import { Badge } from '@/components/ui/badge';
import type { StockStatus } from '@/types/api';

const MAP: Record<StockStatus, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  aman: { label: 'Aman', variant: 'success' },
  menipis: { label: 'Menipis', variant: 'warning' },
  habis: { label: 'Habis', variant: 'destructive' },
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const s = MAP[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
