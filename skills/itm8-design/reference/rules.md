# itm8 brand rules for app UI

Source: the itm8 Design System in Claude Design (built from the itm8 CVI, the PowerPoint master
and itm8.se) and the AI Factory Management app's release checklist.

## Feel

A grown-up purple universe: calm, warm, generous space, one idea per view. itm8 speaks like a
trusted colleague, never a vendor ("we" for itm8, "you" for the reader, "together" is a recurring
word). Plain language, short sentences, no jargon-heavy IT speak.

## Colour

| Token | Value | Use |
|---|---|---|
| `--itm8-purple` | #5F259F | Headings, logo, primary buttons, purple sections |
| `--itm8-purple-700` | #4A1C7C | Hover and press on purple |
| `--itm8-ink` / `--itm8-black` | #171717 / #000000 | Body text, black sections |
| `--itm8-lavender` | #9F7EC6 | Secondary fills, focus ring |
| `--itm8-lavender-light` | #CFBDE2 | Dividers, soft backgrounds |
| `--itm8-lavender-pale` | #EEE9F5 | Muted panels, table banding, icon tiles |
| `--itm8-green` | #B6DCCA | Pop only: one call to action, pills, key numbers |
| `--accent-pop-strong` | #1F7A52 | Readable green text on white |
| `--itm8-grey` | #9D9D9D | Captions and metadata (large text only on white: it is below 4.5:1 for body size) |
| `--itm8-grey-line` | #E2E2E2 | Hairlines |

Prefer the semantic aliases in components: `--surface-page`, `--surface-card`, `--surface-muted`,
`--surface-inverse`, `--text-heading`, `--text-body`, `--text-muted`, `--text-on-inverse`,
`--accent-primary`, `--accent-primary-hover`, `--accent-pop`, `--border-default`, `--focus-ring`.

Never: green backgrounds, gradients as a brand device, patterns or textures, a red or orange
status colour, recoloured logos or icons.

## Type

- Headings: Miriam Libre Bold, purple, tight tracking, balanced wrapping.
- Body: Fira Sans 400 (300 for large intro text), line height 1.6.
- Code and ids: Fira Mono.
- Scale tokens: `--fs-display` 72, `--fs-h1` 48, `--fs-h2` 36, `--fs-h3` 26, `--fs-h4` 20,
  `--fs-lead` 22, `--fs-body` 17, `--fs-body-sm` 15, `--fs-caption` 13, `--fs-overline` 12 (px).
- In dense app screens (tables, forms) use h2 for the page title and h3 for sections.

## Shape and motion

- Radii: cards 20 px (`--radius-card`), inputs 12 px, buttons and badges full pills.
- Shadows are low and purple-tinted (`--shadow-xs` to `--shadow-lg`); never grey drop shadows.
- Motion is calm: 140 to 400 ms, standard ease, no bounce. Cards lift 3 px on hover, buttons
  move 1 px down on press.

## Layout

- Max content width 1200 px (`--container-max`), 48 px gutters, 16 px on phones.
- Sticky header: white at 86 % with a 10 px blur, logo 32 to 40 px high.
- Full-bleed purple or black sections between white content; at most one 5th Element arch per
  page, on the hero or the sign-in panel.
- Test every page at 1280 px and 768 px wide.

## Voice in the UI

- Sentence case for every label, heading and button. Uppercase only for the small overline label.
- No emoji. The only inline glyph is the arrow "→" on links such as "Read more →".
- Empty states say what to do next ("No items yet. Add the first one."). Error messages say what
  happened and what to do, with the request id for support.
- Swedish UI for Swedish customers if they ask; English otherwise. Keep the tagline in English:
  "Let's build today's and tomorrow's IT. Together."

## Icons

The itm8 icon library (15 PNGs) is for topics: services, business areas, values. For small UI
glyphs (chevrons, close, menu) use plain text or a single local SVG; do not add an icon font or a
CDN icon set. If the app adds `lucide-react`, wrap it in one `Glyph` component and import lucide
nowhere else.
