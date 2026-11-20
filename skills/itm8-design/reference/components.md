# Components

All components are plain React with CSS classes from `components.css`. Import them from
`./design/components` (path relative to `src/web`).

## Button

```tsx
<Button onClick={save}>Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="pop" iconRight={<span aria-hidden="true">→</span>}>Get started</Button>
<Button variant="ghost" size="sm">Edit</Button>
<Button href="/items/new">New item</Button>
```

Variants: `primary` (default), `secondary`, `pop`, `ghost`, `inverse` (white on purple). Sizes
`sm`, `md` (default), `lg`. `fullWidth` for forms on phones. One `pop` per view. A destructive
button is `secondary` with explicit words ("Delete customer") and a confirmation, never red.

## Badge

```tsx
<Badge>Draft</Badge>
<Badge variant="solid">Live</Badge>
<Badge variant="pop">New</Badge>
<Badge variant="neutral">Archived</Badge>
<Badge variant="outline">Pilot</Badge>
```

## Card and ServiceCard

```tsx
<Card>…</Card>                       // elevated (default)
<Card variant="outlined">…</Card>     // hairline border, for lists and forms
<Card variant="muted">…</Card>        // lavender-pale panel
<Card variant="inverse">…</Card>      // purple, white text
<Card interactive onClick={open}>…</Card>

<ServiceCard icon={<Icon name="security" />} title="Security" linkLabel="Read more" href="/security">
  Short copy, one or two sentences.
</ServiceCard>
```

## Input

```tsx
<Input label="Title" name="title" required hint="Shown on the list page." />
<Input label="E-mail" type="email" error="Enter an address like name@example.com." />
```

The error sets `aria-invalid` and links the text with `aria-describedby`.

## Tabs

```tsx
const [tab, setTab] = useState('open');
<Tabs label="Item status" items={[{ value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }]}
      value={tab} onChange={setTab} />
{tab === 'open' ? <OpenList /> : <DoneList />}
```

## Logo, Icon, FifthElement

```tsx
<Logo />                         // purple, 32 px high
<Logo variant="white" height={40} />
<Icon name="databases" tile />   // names: ITM8_ICONS
<section style={{ position: 'relative', overflow: 'hidden', background: 'var(--surface-inverse)' }}>
  <FifthElement corner="top-right" color="var(--itm8-white)" size={260} offset={-20} />
  …
</section>
```

## Patterns

- **Page:** `<header className="itm8-header"><div className="itm8-container itm8-header__inner">…`
  then `<main className="itm8-container">`.
- **Lists:** an outlined card per row or a plain table with `--surface-muted` banding; status as
  a `Badge`; the row action as a `ghost` button.
- **Forms:** one column, `Input` per field, the primary button last, errors next to the field.
- **Loading and empty states:** a short sentence in `--text-muted`; no spinners longer than a
  second without text.
