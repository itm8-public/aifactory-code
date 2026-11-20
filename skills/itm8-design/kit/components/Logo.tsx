import type { ImgHTMLAttributes } from 'react';
import purple from '../assets/logo/itm8-logo-purple.svg';
import white from '../assets/logo/itm8-logo-white.svg';
import black from '../assets/logo/itm8-logo-black.svg';

const files = { purple, white, black } as const;

export interface LogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** `purple` on light surfaces (default), `white` on purple, black or photos, `black` as a secondary option. */
  variant?: keyof typeof files;
  /** Height in px; 32 to 40 in a header. Never stretch, recolour or redraw the logo. */
  height?: number;
}

export function Logo({ variant = 'purple', height = 32, alt = 'itm8', ...rest }: LogoProps) {
  return <img src={files[variant]} alt={alt} height={height} style={{ height, width: 'auto', display: 'block' }} {...rest} />;
}
