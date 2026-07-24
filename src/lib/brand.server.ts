import { cookies, headers } from 'next/headers';
import { resolveBrand, type Brand } from './brand';

/**
 * Brand untuk Server Component: dari Host header.
 * Saat dev (bukan production), cookie `brand` bisa meng-override untuk pratinjau
 * (di-set middleware dari query `?brand=stok|geoattend`).
 */
export function getServerBrand(): Brand {
  if (process.env.NODE_ENV !== 'production') {
    const override = cookies().get('brand')?.value;
    if (override === 'stok' || override === 'geoattend') return override;
  }
  return resolveBrand(headers().get('host'));
}
