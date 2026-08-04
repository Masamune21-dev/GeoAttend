import type { StockStatus } from '@/types/api';

/**
 * Label stok untuk tampilan & ekspor. Berkas terpisah dari `@/lib/stock`
 * (yang menyentuh database) agar aman diimpor komponen client.
 */
export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  aman: 'Aman',
  menipis: 'Menipis',
  habis: 'Habis',
};
