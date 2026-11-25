# Throne

Unofficial D&D (5e) campaign manager. Notes-first (markdown, `[[wikilinks]]`, backlinks, tags, search), a Player side (characters, builder, DDB PDF import, rests, inventory, dice) and a DM side (campaign, combat console, library, notes). Local-first (IndexedDB), optional Supabase sync later. Web app / PWA first, desktop wrapper later. Free core.

Read first: `PRODUCT.md` (product + brand truth), `PLAN.md` (milestones M0-M7, status table in 3a), `DESIGN.md` (design system as built), `.impeccable/surfaces/app.md` (design direction contract), `docs/ddb-analysis.md` (D&D Beyond PDF field map).

## Working agreement
- This repository is **public** (live at https://hoodedhacker32.github.io/throne/, deployed by `pages.yml` on every push to `main`). It started from one clean commit; the earlier history is in the owner's private `throne-private` archive. Never push branches or commits from that archive here, and never commit personal data (names, local paths, real character exports, keys).
- The owner wants autonomous execution: do the work end to end, don't stop to ask unless a decision is truly theirs (money, accounts, publishing, deleting). They review from an iPhone, so keep commits small and push often; summarise in plain language.
- Work on a branch and open PRs, or commit to `main` if told to. Commit messages: short, imperative.
- Never commit personal files (D&D Beyond PDFs, `.env`, keys). Never use D&D Beyond/WotC logos, art or fonts. Bundled rules content = SRD only; mechanics numbers only, no book text.
- All user-facing branding says "Unofficial D&D Campaign Manager". Not affiliated with Wizards of the Coast.

## Stack (in `app/`)
Vite 8, React 19, TypeScript, react-router-dom 7, Dexie 4 (+ dexie-react-hooks), zustand, marked + DOMPurify, pdfjs-dist 6, lucide-react, vite-plugin-pwa, fontsource (metamorphous, pirata-one, roboto, roboto-condensed, eb-garamond, source-sans-3).

Commands (run in `app/`): `npm install`, `npm run dev`, `npx tsc -b` (typecheck), `npm run build`.

## Design (binding)
Impeccable skill drives UI work (`/impeccable`). The chosen look is the D&D Beyond-style "category standard": dark charcoal chrome (#1b1b1b / #2a2a2a), parchment content panels (#f4efe2), red #ba0000 for primary/active, Roboto Condensed headings, Metamorphous for the wordmark and names, Pirata One numerals, 6-8px radii. Quality bar: D&D Beyond, Obsidian/Notion, Foundry VTT/Roll20, Linear/Things. Copy workflow and structure, never trade dress. **Desktop is a first-class target, not a stretched phone** (laptops and tablets at the table, desktop wrapper later). Three layouts: >=1200px labelled sidebar with party list (collapsible), 800-1199px icon rail, <800px bottom tabs. Desktop pages use the width: multi-column layouts, right-hand detail drawer (`components/Drawer.tsx`) instead of navigating away, hover states, keyboard (Ctrl/Cmd+K or `/` quick switcher in `components/Palette.tsx`, Esc closes). **The character sheet layout is non-negotiable** (owner decision): it is the standard D&D sheet structure. Header (portrait, name, class line, rests); one stat row (six abilities with modifier big and score small, proficiency, speed, inspiration, HP box); then left column saving throws / passive senses / proficiencies & training, middle column skills table, right column initiative + AC + defenses/conditions above the tabbed panel (Actions, Inventory, Features, Notes; Spells later). Do not reorder, merge or restyle these regions into something else; add features inside them or in the right-hand drawer. Narrower screens may stack the same regions (see `docs/ddb-analysis.md` 3b), using container queries. Phones: separate Player and DM menus (Player: Home, Characters, Notes, Dice. DM: Campaign, Combat, Library, Notes). Design tokens and component classes live in `app/src/index.css`.

Brand: wordmark "Throne" in Metamorphous with the "o" as a red (#ba0000) d20 showing a Pirata One 0 (identical in light and dark). Colours: red #ba0000, ink #14100e, bone #efe6d2. Assets in `brand/`.

## Code map (`app/src/`)
- `lib/rules.ts` abilities, skills, 12 SRD classes, species, conditions, `mod()`, `profBonus()`, `fmt()`.
- `lib/dice.ts` crypto-random `roll()` with advantage/disadvantage, `manualRoll()` for physical dice.
- `lib/markdown.ts` `extractLinks()`, `renderMarkdown()` (wikilinks).
- `db.ts` Dexie v2 schema (campaigns, notes, characters, combatants, combat, library, rolls), `blankCharacter()`, `seedIfEmpty()` sample data.
- `state.ts` zustand UI store (mode player|dm, theme parchment|dark, campaignId), persisted to localStorage.
- `index.css` full design system (themes via `:root[data-theme]`).
- `pages/` one file per screen, `components/` shared bits (DieMark, Portrait, CharacterCard, RollToast).

## Current state (2026-11-22) - READ THIS
The app compiles, builds and runs. All screens exist and were checked in a browser at 1280 and 390 px (no console errors, no horizontal overflow):
- Shell (`App.tsx`): wordmark, Player/DM switch, campaign picker, theme toggle; left rail on desktop, bottom tabs on phones. Roll toast (`components/RollToast.tsx`) shows every roll app-wide.
- Player: Home (party + recent notes + last rolls), Characters list, Sheet (rests, HP damage/heal/temp, ability/save/skill/initiative/attack rolls, advantage toggle, Actions/Inventory/Features/Notes tabs, Edit = free-write of every field), Builder (5 steps, standard array/point buy/4d6/manual, +2/+1 increases), PDF import, Dice (tray, physical rolls, history).
- DM: Campaign overview (rename, new campaign, sessions/NPCs/places), Combat (initiative, add party, groups of monsters, HP, conditions, round/turn), Library (images/PDF blobs in Dexie, viewer).
- Notes re-skinned, filter by type, link a note to a character.
- Research pass (from `docs/ddb-screen-research.md`): builder v2 (one URL per step `/characters/new/:step`, autosaved draft in localStorage, step bar with done/needs-attention badges, background +2/+1 or +1x3, ability calc panel with other/override, SRD 5.2 starting kits A/B(/C) with AC from armour, review page naming what's missing); rests and HP as drawers; floating dice-pool dock with modifier + advantage and a game log (`components/DiceDock.tsx`, rolls record `who`); characters list search/sort/copy and type-DELETE confirm (`components/ConfirmDelete.tsx`); encounter difficulty from 2024 XP budgets (`lib/encounter.ts`).
- Desktop pass: sheet rebuilt on DDB's three-column desktop layout with a detail drawer and tab filters; labelled sidebar with party list; quick switcher; two-pane combat console.
- `lib/ddb.ts` maps DDB PDF fields to a character (pure, tested against `docs/fixtures`); `lib/pdf.ts` reads widget annotations with pdf.js (lazy-loaded).
- `lib/roller.ts` logs rolls to Dexie and flashes the toast; `lib/character.ts` derived stats; `lib/hooks.ts` campaign-scoped queries.

- Spells: `Spell` on the character, `lib/spells.ts` slot tables (full, half rounding up, Pact Magic) and casting ability per class; Spells tab (second tab, as on a standard sheet) with ability/attack/DC, slot pips, prepared toggles, level filters, spell drawer; long rest restores slots, short rest restores Pact Magic; DDB page-4 import (`parseSpells` in `lib/ddb.ts`).
- Supabase: owner confirmed the Free plan is fine (no cost). Create the project when sync work (M6) starts.

- Campaign export/import (`lib/backup.ts`, fflate): zip of notes as markdown, characters as JSON, library files, campaign.json; import always creates a new campaign. Buttons on the DM Campaign page.
- Portrait upload: tap the sheet header portrait; `lib/image.ts` crops/shrinks to a 320px JPEG data URL.
- Images in notes: paste, drop or the image button saves to the campaign library (`shrinkImage` downsizes big photos) and inserts Obsidian-style `![[name]]` (optional `|width`); `lib/markdown.ts` renders `img[data-embed]` placeholders that NotesPage fills with object URLs. Export rewrites embeds to the exported file name so the zip opens in Obsidian.
- Maps (M3): `pages/MapPage.tsx` at `/dm/library/:id` for any library image. Pan/zoom (wheel, pinch, buttons, fit), tools Move/Pin/Draw/Erase, colours, undo. Pins and strokes live on the `LibraryItem` in image pixel coordinates; pins link to notes ("New place note"), notes list "On maps". Desktop side panel lists pins; phone uses a bottom-sheet drawer (`Drawer sheet`).
- Saved monsters: Dexie v3 adds a global `monsters` table. Save a combatant from its combat panel (name without number, HP, AC, CR, init bonus, notes); chips above the fight quick-add N with rolled initiative and continued numbering. No bundled stat blocks (user data only).
- Multiclass: optional `classes: ClassLevel[]` on the character (name, subclass, level, hitDie, used); top-level className/subclass/level/hitDie/hitDiceUsed stay as a summary via `withClasses()`; read through `classesOf()` / `classLine()` in `lib/character.ts`. Edit sheet has a classes editor. Short rest spends dice per class, long rest returns the biggest dice first. `slotsForClasses()` uses the multiclass caster level (half casters round up); a Warlock mixed with other casters keeps Pact Magic separate (button adds it as a short-rest resource). DDB import parses "Fighter 3 / Wizard 2".
- Note folders: optional `folder` path on a note ("People/Chapel"); notes list shows a collapsible folder tree (flat while searching), clicking a folder makes New create inside it; export writes `notes/<folder>/<title>.md`.
- Quick capture (`components/QuickCapture.tsx`): top-bar button, Home button, palette entry, Ctrl/Cmd+Shift+N. Appends `- **time** text` to today's "Session log <date>" note (created in the Sessions folder), or saves a new note.
- Random tables: Dexie v4 `randomTables` (global; NOT `tables`, which Dexie reserves). `lib/tables.ts` parses one entry per line with optional `1-3:` ranges, expands `{2d6}` and `{Other table}` (depth 3); 13 original starter tables seeded once per device. Library page has a "Random tables" tab (`components/TablesPanel.tsx`), rolls go to the game log and toast; the palette lists "Roll: <table>".
- NPC cards: `card` on npc notes (role, species, look, voice, wants, secret) edited above the note body (`components/NpcCardEditor.tsx`), fields can be rolled from the matching tables; Campaign page NPCs has "Random" which builds a whole NPC.
- Polish pass: every page is `React.lazy` in `App.tsx` (first load ~473 kB JS+CSS), fonts load Latin subsets only, first-run guide (`components/Welcome.tsx`, `throne.welcomed` in localStorage, reopen from the palette), axe-clean in both themes (red text uses `--accent-text`), phone touch targets >= 36px. `DESIGN.md` documents the system and holds the finish review. Test scripts must set `throne.welcomed` or the guide covers the page.
- Deployment: `VITE_BASE` sets the sub-path (GitHub Pages `/throne/`), router uses `import.meta.env.BASE_URL`; PNG icons (192/512/maskable/apple-touch) rendered from the brand d20 with Pirata One; `public/_redirects` for Netlify/Cloudflare; `.github/workflows/pages.yml` deploys on push to main once the repo is public and Pages source is GitHub Actions. See `docs/DEPLOY.md`.
- Repo hygiene for going public: the DDB fixture is scrubbed (sample character, rules prose removed), no owner paths or real character names in current files. Keep it that way.
- 3D dice (`lib/dice3d.ts`, `@3d-dice/dice-box-threejs`, MIT): lazy-loaded chunk, transparent full-screen layer `#dice3d`, Throne-red dice with Pirata One numerals (set per die type via `DiceFactory.get(type).font`), Retina pixel ratio. Results are ALWAYS ours (crypto `roll()`), forced with `NdS@v1,v2` notation; `record()` awaits the landing before toast/log (6 s cap). d100 is shown as tens d100 + units d10. The library's reported value is stale for forced d4 (visual is correct), so never read results back from it. Sounds in `public/dice/` (felt surface, plastic/coin hits, not precached). Toggle 3D and sound in the Dice page and the dice dock (`components/DiceSettings.tsx`); off by default for prefers-reduced-motion.
- Sync (M6): Supabase project `throne` (ref `zbftadxrqirconzjfoso`, org Throne, eu-west-2, Free plan). Tables `sync_campaigns` (one JSON snapshot per campaign, `version` for compare-and-set) and `sync_global` (monsters + random tables), private bucket `throne-files` (`<user_id>/<sha256>`), RLS on everything (migration `throne_sync_v1`). Client: `lib/sync.ts` (lazy chunk with supabase-js), config in `lib/supabaseConfig.ts` (publishable key, safe to commit). Email + password auth. Pass logic: unchanged here + newer there -> pull; changed here only -> push; both -> keep the cloud version as a "(from another device)" copy, then push. A fresh device's untouched sample campaign is dropped instead of uploaded. UI: cloud button in the top bar + `components/SyncPanel.tsx`; auto-sync on start, every 45 s while visible, on hide and on reconnect. Tested end to end with two browser profiles (pull, push, conflict). Free-plan budget (1 GB files, 500 MB DB, 5 GB egress): images over 1 MB are re-encoded for the cloud copy (max 4096 px, WebP/JPEG; 22.9 MB test map -> 3.2 MB), unused files are garbage-collected daily (only files older than a day), and the sync panel shows usage. Keep anything big out of the database.

Next ideas: handout sharing, Impeccable CLI review once `buildPath` is decided.

## Open items (owner decisions, do not do unasked)
Trademark/domain check for "Throne"; dark-mode logo variant;  `.impeccable/config.json` buildPath unset.

## Testing UI
Serve the built app (`npm run build` then `npx vite preview` or `python -m http.server`) and look at it in a browser at ~1280, 768 and 390 px wide. Test touch targets and the phone layout; the owner uses an iPhone 12 (iOS 18, Safari), so avoid features Safari lacks and respect safe areas.

## Extra research
docs/ddb-screen-research.md: signed-in D&D Beyond structure/interaction research (builder, sheet, rests, HP drawer, dice, character list, encounter builder). Copy workflow and structure only, never trade dress. Screenshots stay on the owner's PC.
