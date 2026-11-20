import type { HTMLAttributes, ReactNode } from 'react';

export type CardVariant = 'elevated' | 'outlined' | 'muted' | 'inverse';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Lift and deepen the shadow on hover. Use only when the whole card is clickable. */
  interactive?: boolean;
  children?: ReactNode;
}

/** Rounded surface with a low, purple-tinted shadow. */
export function Card({ variant = 'elevated', interactive = false, className, children, ...rest }: CardProps) {
  const cls = ['itm8-card', `itm8-card--${variant}`, interactive ? 'itm8-card--interactive' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}

export interface ServiceCardProps extends HTMLAttributes<HTMLDivElement> {
  /** An itm8 icon (see Icon) or an image URL. */
  icon?: ReactNode | string;
  title: string;
  linkLabel?: string;
  href?: string;
  children?: ReactNode;
}

/** The signature itm8 tile: icon, title, short copy and an optional "Read more" link. */
export function ServiceCard({ icon, title, linkLabel, href, children, className, ...rest }: ServiceCardProps) {
  return (
    <Card className={['itm8-service-card', className].filter(Boolean).join(' ')} {...rest}>
      {icon ? (
        <div className="itm8-service-card__icon">
          {typeof icon === 'string' ? <img src={icon} alt="" width={40} height={40} /> : icon}
        </div>
      ) : null}
      <h3 className="itm8-service-card__title">{title}</h3>
      {children ? <p className="itm8-service-card__body">{children}</p> : null}
      {linkLabel && href ? (
        <a className="itm8-service-card__link" href={href}>
          {linkLabel} <span aria-hidden="true">→</span>
        </a>
      ) : null}
    </Card>
  );
}
