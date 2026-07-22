import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
  {
    variants: {
      variant: {
        default: 'bg-primary-subtle text-primary ring-primary/15',
        success: 'bg-success-subtle text-green-700 ring-green-600/15',
        destructive: 'bg-destructive-subtle text-red-700 ring-red-600/15',
        warning: 'bg-warning-subtle text-amber-700 ring-amber-600/15',
        secondary: 'bg-secondary text-text-secondary ring-slate-400/15',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
