import { useRef, useState, type KeyboardEvent } from 'react';

export interface TabItem {
  value: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  /** Controlled value. Leave out and use `defaultValue` for an uncontrolled tab bar. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Accessible name of the tab list. */
  label: string;
}

/** Underline tabs. Arrow keys move between tabs. Render the panel yourself for the active value. */
export function Tabs({ items, value, defaultValue, onChange, label }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.value);
  const active = value ?? internal;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (v: string) => {
    if (value === undefined) setInternal(v);
    onChange?.(v);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((i) => i.value === active);
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step || index < 0) return;
    e.preventDefault();
    const next = (index + step + items.length) % items.length;
    select(items[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div className="itm8-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((item, i) => {
        const on = item.value === active;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            className="itm8-tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => select(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
