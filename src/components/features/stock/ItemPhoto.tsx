import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ItemPhotoProps {
  src?: string | null;
  alt: string;
  className?: string;
}

/** Thumbnail foto barang dengan placeholder ikon bila kosong. */
export function ItemPhoto({ src, alt, className }: ItemPhotoProps) {
  if (!src) {
    return (
      <span
        className={cn(
          'flex items-center justify-center rounded-md bg-secondary text-text-secondary',
          className
        )}
        aria-hidden="true"
      >
        <Package className="h-1/2 w-1/2" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={cn('rounded-md object-cover', className)} />
  );
}
