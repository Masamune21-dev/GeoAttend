import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'flex items-start gap-2.5 rounded-md px-3 py-2.5 text-sm [&>svg]:mt-0.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        info: 'bg-primary-subtle text-primary',
        success: 'bg-success-subtle text-green-700',
        warning: 'bg-warning-subtle text-amber-700',
        destructive: 'bg-destructive-subtle text-red-700',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
);

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
} as const;

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** Sembunyikan ikon bawaan (mis. bila konten sudah punya ikon sendiri). */
  hideIcon?: boolean;
}

/**
 * Kotak pesan inline (error form, peringatan, info). Selalu ikon + teks —
 * makna tidak boleh disampaikan lewat warna saja (DESIGN.md §6).
 */
export function Alert({ className, variant, hideIcon, children, ...props }: AlertProps) {
  const Icon = ICONS[variant ?? 'info'];
  return (
    <div
      role={variant === 'destructive' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {!hideIcon && <Icon aria-hidden="true" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
