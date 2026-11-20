import type { CSSProperties } from 'react';
import arch from '../assets/brand/fifth-element.svg';

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const ROTATION: Record<Corner, number> = {
  'bottom-right': 0,
  'bottom-left': 90,
  'top-left': 180,
  'top-right': 270,
};

export interface FifthElementProps {
  corner?: Corner;
  size?: number;
  /** Purple or black on light surfaces, white on purple, black or photos. */
  color?: string;
  /** 0.3 is the brand rule (30 % tint on colour, 30 % opacity on images). */
  opacity?: number;
  /** Negative values bleed the arch off the edge. */
  offset?: number;
}

/**
 * The 5th Element: one arch, 1/8 of the number 8. At most one per page (hero or sign-in).
 * The parent needs `position: relative` and `overflow: hidden`.
 */
export function FifthElement({
  corner = 'bottom-right',
  size = 220,
  color = 'var(--itm8-purple)',
  opacity = 0.3,
  offset = 0,
}: FifthElementProps) {
  const [v, h] = corner.split('-') as ['top' | 'bottom', 'left' | 'right'];
  const style: CSSProperties & Record<'--itm8-arch-url' | '--itm8-arch-color', string> = {
    '--itm8-arch-url': `url("${arch}")`,
    '--itm8-arch-color': color,
    width: size,
    height: size,
    opacity,
    [v]: offset,
    [h]: offset,
    transform: `rotate(${ROTATION[corner]}deg)`,
  };
  return <span aria-hidden="true" className="itm8-arch" style={style} />;
}
