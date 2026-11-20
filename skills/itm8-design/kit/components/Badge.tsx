import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant = 'purple' | 'solid' | 'pop' | 'neutral' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children?: ReactNode;
}

/** Small status or category pill. Always say the status in words; colour alone is not enough. */
export function Badge({ variant = 'purple', className, children, ...rest }: BadgeProps) {
  return (
    <span className={['itm8-badge', `itm8-badge--${variant}`, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </span>
  );
}
