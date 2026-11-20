---
name: itm8-design
description: itm8 design system for React and TypeScript app code in AI Factory web apps - CSS tokens, self-hosted fonts, Button, Badge, Card, ServiceCard, Input, Tabs, Logo, Icon and the 5th Element, plus the brand rules for layout, colour, type and voice. Use when building, styling or reviewing UI in an app scaffolded by aifactory-code or any itm8 React web app. For slides, documents, e-mail or plain HTML pages use the itm8-brand skill instead.
---

# itm8 design for app code

The kit is a port of the organisation's default **itm8 Design System** in Claude Design. Its
tokens are byte-identical to the ones the AI Factory Management app uses. A scaffolded web app
has the kit in `src/web/design/`; otherwise copy it from `${CLAUDE_PLUGIN_ROOT}/skills/itm8-design/kit/`.

## Set-up (already done by the scaffold)

```ts
// src/web/main.tsx, before any other style
import './design/fonts';      // self-hosted Miriam Libre, Fira Sans, Fira Mono
import './design/itm8.css';   // tokens, base element styles, component classes
```

Never load fonts, icons or scripts from a CDN or Google Fonts: the app's Content-Security-Policy
allows only its own origin, and it keeps personal data (IP addresses) away from third parties.

## Rules

Read [reference/rules.md](reference/rules.md) before you design a page. The short version:

- **Purple leads.** Headings are purple (`--text-heading`), body text is ink (`--text-body`).
  Purple and black full-bleed sections give rhythm; lavender-pale (`--surface-muted`) for soft
  panels and table banding.
- **Green is a pop, never a surface.** Only for the one call to action (`Button variant="pop"`),
  pills and key numbers. Green text on white uses `--accent-pop-strong`.
- **No danger colour exists.** Errors, "down" and destructive actions use ink on white with a
  text label ("Error:", "Failed", "Delete customer"). Never invent a red.
- **Sentence case** everywhere, uppercase only for the small overline label. **No emoji.**
- **One 5th Element arch per page at most**, on a hero or sign-in panel, at 30 % tint.
- **Accessible:** text contrast at least 4.5:1, visible focus (the lavender ring is built in),
  touch targets at least 44 px, status said in words not only colour.
- **Only tokens.** Use `var(--…)` from `design/tokens/*.css`; no raw hex values in components.

## Components

Import from `./design/components`. Details and examples: [reference/components.md](reference/components.md).

| Component | Use |
|---|---|
| `Button` | Actions. `primary` (default), `secondary`, `ghost`, `inverse` on purple, `pop` for the one main call to action. `href` renders a link |
| `Badge` | Status or category pill, always with words |
| `Card`, `ServiceCard` | Surfaces; the service tile pairs an itm8 icon, title, copy and "Read more →" |
| `Input` | Labelled text field with hint and error text |
| `Tabs` | Underline tabs with arrow-key support |
| `Logo` | The official wordmark: `purple` on light, `white` on dark |
| `Icon` | The 15-icon itm8 library, optionally on a lavender tile |
| `FifthElement` | The signature arch overlay |

Layout helpers in the CSS: `itm8-container` (1200 px max width, 48 px gutters) and
`itm8-header` (sticky, white at 86 % with blur).

## Customer brands

itm8 design is the default. For a customer app, ask which brand applies. To theme it, add one CSS
file after `itm8.css` that redefines the semantic tokens (`--surface-*`, `--text-*`,
`--accent-*`, `--border-*`, `--focus-ring`, `--font-heading`, `--font-body`) and swap the `Logo`.
Components use only semantic tokens, so nothing else changes. Remove the 5th Element and the itm8
icons in a customer theme unless the customer asks for itm8 branding.

## Gaps in the source system

- Icons are PNGs sliced from the brand sheet; vector icons are requested from itm8 Marketing.
- The source's white logo had no fill (it rendered black); the kit's white logo sets
  `fill="#FFFFFF"` on the same paths.
- The source's input used a red error colour, which the brand palette does not have; the kit uses
  an ink border and an "Error:" label.
