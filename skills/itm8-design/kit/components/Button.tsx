import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'pop' | 'ghost' | 'inverse';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  /** `primary` = purple fill (default). `pop` = the green call to action: at most one per view. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

const classes = (p: CommonProps, extra?: string) =>
  [
    'itm8-btn',
    `itm8-btn--${p.variant ?? 'primary'}`,
    `itm8-btn--${p.size ?? 'md'}`,
    p.fullWidth ? 'itm8-btn--full' : '',
    extra ?? '',
  ]
    .filter(Boolean)
    .join(' ');

/** itm8 button. Pass `href` to render a link that looks like a button. */
export function Button(props: ButtonProps | LinkProps) {
  const { variant, size, iconLeft, iconRight, fullWidth, children, className, ...rest } = props;
  const cls = classes({ variant, size, fullWidth }, className);
  if (typeof props.href === 'string') {
    return (
      <a className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {iconLeft}
        {children}
        {iconRight}
      </a>
    );
  }
  const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type={buttonRest.type ?? 'button'} className={cls} {...buttonRest}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
