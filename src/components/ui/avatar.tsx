'use client';

import { useState } from 'react';
import { cn, getInitials } from '@/lib/utils';
import { Dialog } from './dialog';

interface AvatarProps {
  src?: string | null;
  name: string;
  /** Kelas ukuran, mis. "h-9 w-9". */
  className?: string;
  /** Kelas ukuran teks inisial (fallback), mis. "text-xs". */
  textClassName?: string;
  /** Klik untuk memperbesar foto (hanya bila ada foto). */
  preview?: boolean;
  /** Cincin border tipis di sekeliling. */
  ring?: boolean;
}

/**
 * Foto profil pengguna dengan fallback inisial berwarna.
 * Tampil seragam di seluruh aplikasi; opsional bisa di-klik untuk pratinjau.
 */
export function Avatar({ src, name, className, textClassName, preview, ring }: AvatarProps) {
  const [open, setOpen] = useState(false);
  const ringCls = ring ? 'ring-2 ring-border' : '';

  if (!src) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-white',
          ringCls,
          className,
          textClassName
        )}
      >
        {getInitials(name)}
      </span>
    );
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Foto ${name}`}
      className={cn('shrink-0 rounded-full object-cover', ringCls, className, preview && 'cursor-zoom-in')}
    />
  );

  if (!preview) return image;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Lihat foto ${name}`}
        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {image}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={name}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`Foto ${name}`} className="mx-auto max-h-[70vh] w-full rounded-lg object-contain" />
      </Dialog>
    </>
  );
}
