const files = import.meta.glob<string>('../assets/icons/*.png', { eager: true, import: 'default' });

/** The itm8 icon library: black rounded strokes with lavender fills. Never recolour them. */
export const ITM8_ICONS = [
  'cloud-infrastructure',
  'digital-transformation',
  'security',
  'security-shield',
  'databases',
  'hosting',
  'development',
  'growth',
  'uptime',
  'sales',
  'crm',
  'intranet',
  'help-a-m8',
  'love-ambition',
  'heart-customers',
] as const;

export type Itm8IconName = (typeof ITM8_ICONS)[number];

export interface IconProps {
  name: Itm8IconName;
  size?: number;
  /** Wrap the icon in a soft lavender tile. */
  tile?: boolean;
  /** Leave empty when the icon is decorative (next to text that says the same). */
  alt?: string;
}

export function Icon({ name, size = 40, tile = false, alt = '' }: IconProps) {
  const src = files[`../assets/icons/${name}.png`];
  const img = <img className="itm8-icon" src={src} alt={alt} width={size} height={size} />;
  if (!tile) return img;
  const outer = size + Math.round(size * 0.4);
  return (
    <span className="itm8-icon-tile" style={{ width: outer, height: outer }}>
      {img}
    </span>
  );
}
