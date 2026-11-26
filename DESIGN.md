# Throne design system

How Throne looks and behaves, and why. The direction contract lives in `.impeccable/surfaces/app.md`; this file documents what was built against it. Tokens and component classes are in `app/src/index.css`.

**Direction in one line:** the category standard played straight. A D&D Beyond-style tabletop app (charcoal chrome, parchment panels, one red), one task per screen, separate Player and DM menus. We copy the workflow and information structure of tools people already know, never their trade dress.

## Colour

| Token | Parchment | Dark | Use |
|---|---|---|---|
| `--chrome` / `-2` / `-3` | #1b1b1b / #2a2a2a / #3a3a3a | same | Top bar, rail, tab bar, sheet header, drawer header, dice |
| `--page` | #d8d0bb | #131211 | Page background behind panels |
| `--panel` / `--panel-2` | #f6f1e4 / #ece4cf | #1f1c19 / #2a2622 | Content panels / insets, chips, table stripes |
| `--text` / `--text-2` | #231d17 / #5a5040 | #efe8d8 / #b3a995 | Body / secondary |
| `--line` | #c4b99d | #3b352d | Keylines, borders |
| `--red` | #ba0000 | #ba0000 | Fills: primary buttons, active states, pips, focus |
| `--accent-text` | #ba0000 | #ff7a70 | Red *text* (group headings, totals). Lighter in dark so it passes contrast |
| `--good` | #2f6a3f | #7fc08e | Healing, healthy HP, crits |
| `--link` | #8a1410 | #e8a39a | Links and wikilinks |

Rules: red means "primary action" or "active", nothing else. One red primary button per view. Never put red text on a dark surface without `--accent-text`. Themes switch with `data-theme` on `<html>`; chrome stays dark in both.

## Type

| Role | Font | Where |
|---|---|---|
| UI | Roboto 400/500/700 | Everything by default, 15px base |
| Headings | Roboto Condensed 700, uppercase, +0.04 to 0.1em tracking | Page titles, panel headings, labels, buttons, tabs |
| Names | Metamorphous | Wordmark, character, campaign, note and map titles only |
| Numerals | Pirata One | Big numbers: modifiers, HP, dice results, initiative |
| Reading | EB Garamond 20px | Rendered note text |

Only Latin subsets are loaded (fontsource `latin-*`). Use `.tnum` for numbers in columns.

## Shape, depth, motion

- Radii 8px (`--radius`) for panels, 6px (`--radius-sm`) for controls; pills for chips and HP pills.
- One shadow (`--shadow`) for panels. Modals and drawers use a stronger shadow plus a 2 to 3px red top or left edge.
- Motion is minimal: 150ms colour/border transitions, a 1px press. Respect `prefers-reduced-motion`.

## Layout

Three shells (`App.tsx`), chosen by width:

| Width | Navigation | Notes |
|---|---|---|
| ≥ 1200px | Labelled sidebar (232px) with party list, collapsible to 72px | Desktop is a first-class target, not a stretched phone |
| 800 to 1199px | Icon rail (92px) | Tablets |
| < 800px | Bottom tab bar with safe-area padding | iPhone 12 is the reference device |

Player menu: Home, Characters, Notes, Dice. DM menu: Campaign, Combat, Library, Notes. The route decides the role (DM routes live under `/dm`).

Desktop pages use the width: multi-column layouts, a right-hand **drawer** (`components/Drawer.tsx`) for details and edits instead of navigating away, hover states and keyboard shortcuts. On phones the drawer is full screen, or a bottom **sheet** (`<Drawer sheet>`) where the content behind must stay visible (map pins).

### The character sheet (non-negotiable)

The standard D&D sheet structure, in this order: header (portrait, name, class line, rests, edit) → one stat row (six abilities: modifier big, score small; proficiency; speed; inspiration; HP box) → left column saving throws, passive senses, proficiencies & training → middle column skills table → right column initiative, AC, defenses/conditions above the tabbed panel (Actions, Spells, Inventory, Features, Notes). Do not reorder, merge or restyle these regions. New features go inside a region or into the drawer. Narrower widths stack the same regions via container queries; phones add a section bar instead of one long scroll.

Click a **number** to roll it. Click a **name** to open its breakdown in the drawer.

## Components (class names in `index.css`)

- **Panels:** `.panel` with `.panel-h` (heading + red underline). Sheet boxes use `.box` with the label at the bottom (`.box-foot`), as on paper sheets.
- **Buttons:** `.btn`, `.btn.primary` (red, one per view), `.btn.ghost`, `.btn.sm`. Icon-only buttons always carry `aria-label`.
- **Choice:** `.chip` (toggle), `.fchip` (filter chips in tabs), `.seg` (segmented control), `.stepper` (− value +).
- **Data:** `table.t`, `.row`, `.pdot` (proficiency dot: hollow, filled, ringed for expertise), `.pip` (limited uses and slots: filled = available).
- **Overlays:** `.drawer`, `.modal` + `.modal-scrim`, `.palette` (Ctrl/Cmd+K), `.toast` (every roll), `.dock` (floating d20 roller).
- **Feedback:** `.callout` (`.req` red edge, `.ok` green), `.empty` (empty states always say what to do next).

## Interaction rules

- Everything autosaves; there is no Save button except where a choice is deliberate (rests, create character, capture).
- Destructive actions confirm. Deleting a character, campaign item or table requires typing DELETE (`ConfirmDelete`).
- Imports never overwrite: a campaign import creates a new campaign.
- Every roll goes to the toast and the game log with who rolled and the full formula. With 3D dice on, the dice land first (on the result we already rolled), then the number appears.
- Esc closes the top overlay. `/` or Ctrl/Cmd+K opens the quick switcher; Ctrl/Cmd+Shift+N opens quick capture.

## Accessibility

- Contrast meets WCAG AA in both themes (axe, 0 violations on 10 main screens, 2026-11-24).
- Touch targets ≥ 36px on phones (inline text links excepted). Inputs are 16px on phones so iOS does not zoom.
- Headings in order, landmarks labelled, scrollable regions focusable, visible focus ring (`--red-hot`).
- Status and results use `aria-live` (toast, dice results, capture confirmation).

## Content and brand

- Every user-facing surface that names the product says **"Unofficial D&D Campaign Manager"**; the welcome guide adds "Not affiliated with Wizards of the Coast".
- Bundled rules content is SRD 5.2 mechanics and numbers only, no book text. Starter random tables are original. The app starts empty: no sample notes or characters.
- No D&D Beyond or Wizards of the Coast logos, art or fonts.

## Finish review (2026-11-24)

Self-review against the direction contract. The Impeccable CLI is not installed in the cloud environment (its `buildPath` is an open owner decision), so this review was done by hand plus automated checks.

| Check | Result |
|---|---|
| Thesis: category standard, one task per screen, separate Player/DM menus | Pass |
| Own-world palette and type used as specified; red only for primary/active | Pass. Red text in dark theme now uses `--accent-text` |
| Sheet layout matches the standard sheet | Pass, owner-confirmed rule recorded above |
| Widths 1920 / 1440 / 1024 / 768 / 390 | Pass, no horizontal overflow on main screens |
| Accessibility (axe-core 4.10, both themes) | Pass, 0 violations |
| Touch targets on iPhone 12 | Pass except inline links |
| First load | 473 kB JS+CSS (was ~780 kB); screens load on demand |
| Console errors in scripted flows | None |

**Verdict:** shippable for personal and table use. Open before a public launch: trademark/domain check, dark-mode logo variant, Impeccable `buildPath`, and sync (M6).
