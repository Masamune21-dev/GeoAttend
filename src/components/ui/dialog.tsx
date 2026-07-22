'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Dialog modal: bottom sheet di mobile, tengah di desktop.
 * Tutup via Escape / klik overlay / tombol X.
 */
export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-[2px] animate-fade-in md:items-center md:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-surface p-4 shadow-floating animate-slide-up md:max-w-lg md:rounded-xl md:p-6',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar (mobile) */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 md:hidden" aria-hidden="true" />

        <div className="mb-4 flex items-center justify-between">
          {title && (
            <h2 className="text-lg font-semibold tracking-tight text-text-primary">{title}</h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="ml-auto rounded-full p-1.5 text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
