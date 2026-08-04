import { Badge } from '@/components/ui/badge';
import { STOCK_STATUS_LABEL } from '@/lib/stock/labels';
import type { StockStatus } from '@/types/api';

const VARIANT: Record<StockStatus, 'success' | 'warning' | 'destructive'> = {
  aman: 'success',
  menipis: 'warning',
  habis: 'destructive',
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  return <Badge variant={VARIANT[status]}>{STOCK_STATUS_LABEL[status]}</Badge>;
}
