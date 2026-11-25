# Throne: project plan

Unofficial D&D Campaign Manager. Notes first, local-first, free core.
Product truth lives in [PRODUCT.md](PRODUCT.md). This file is the plan to build it.

## 1. What we are making

A D&D companion app where **notes management is the headline feature**. It fills the gaps in D&D Beyond: real note-taking tied to characters and campaigns, support for books you own physically, no paywall on the basics.

**Two roles, one app**
- **Player:** view and run characters, import existing sheets, keep character notes and art.
- **DM:** campaign notes, maps and drawings, a reusable resource library, and a light table console for tablets and laptops.

**Principles**
1. Notes are first-class: characters, NPCs, places, sessions and maps are all notes you can link to.
2. You own your data: plain markdown and image files on your machine.
3. Fast at the table, deep between sessions.
4. Works with whatever books and tools the table already has.
5. Free core. No paywalled basics.

## 2. Scope (confirmed)

**Working agreement:** once this plan is agreed I work through it end to end without waiting for further instructions, and report at the end of each milestone. Decisions I can make from the plan I make and record here. I only stop for things that cost money, publish something, or need your accounts.

**Research done so far** is in [docs/ddb-analysis.md](docs/ddb-analysis.md): the D&D Beyond PDF export (readable form fields, fully importable), the 5-step character builder, and the digital sheet layout we are matching.

| Area | What it includes |
|---|---|
| Notes | Markdown notes, links between notes, tags, search, images, folders per campaign |
| Characters | Standard step-by-step builder (like D&D Beyond), **and** a free-write mode where you type straight into the finished sheet. Long rest, short rest, inventory, resource tracking. PDF import. Character art. |
| DM library | Campaign notes, maps (e.g. an Inkarnate world map), drawings, reusable resources |
| Combat console | Active enemies, initiative, HP, conditions. Deliberately simple. |
| Dice | Virtual roller of D&D Beyond quality, plus typing in physical rolls |

**Platforms:** installable web app (PWA) first, desktop build second. Phones for players, tablets and laptops for DMs.
**Storage:** local-first, optional sync later.

## 3. Milestones

Each milestone ends with something usable, in this order.

**M0: Foundation**
- Project scaffold, PWA shell, design tokens from the brand (section 6), file/storage layer, import/export of a whole campaign as a folder or zip.

**M1: Notes core (the headline)**
- Create, edit and organise markdown notes. Wiki-style links, backlinks, tags, full-text search, image embeds.
- Campaign and notebook structure. Quick capture for use at the table.

**M2: Characters**
- Free-write sheet first (fastest to ship, covers any source).
- Then the step-by-step builder, rests, inventory and resource tracking.
- PDF import (needs inspection of real D&D Beyond exports before we commit to an approach).
- Character art, character notes linked to the sheet.

**M3: DM library and maps**
- Map and image library, simple drawing/annotation, pinning notes to map locations.
- Reusable resources (tables, NPC cards, handouts).

**M4: Dice**
- 3D-quality virtual dice with advantage/disadvantage and modifiers, roll history, plus manual entry of physical rolls.
- Dice integrated with sheets (click a skill to roll it).

**M5: Combat console**
- Initiative order, enemy list with HP and conditions, turn tracking, notes per combatant, quick-add from the library.

**M6: Sync and sharing**
- Optional account, multi-device sync, sharing a campaign with players.

**M7: Polish and launch**
- Accessibility pass, performance, onboarding, a trademark and domain check, legal review of the branding.

Milestones M0 to M2 give us a real product; M3 to M5 turn it into the full table companion.

## 3a. Status (2026-11-24)

| Milestone | State |
|---|---|
| M0 Foundation | Done: PWA shell, tokens, Dexie storage, campaign export/import as a zip |
| M1 Notes core | Done: markdown, wikilinks, backlinks, tags, search, images, folders, quick capture |
| M2 Characters | Done: free-write sheet, 5-step builder, rests, inventory, resources, spells, multiclass, DDB PDF import, portraits, linked notes |
| M3 DM library and maps | Done: library, maps with pins linked to notes and freehand drawing, random tables, NPC cards. Not yet: handout sharing |
| M4 Dice | Done: 3D dice (Throne red, results always from the crypto roller), pool roller with advantage and modifiers, physical rolls, game log, click-to-roll everywhere |
| M5 Combat console | Done: initiative, HP, conditions, turns, notes, encounter difficulty, saved monsters |
| M6 Sync and sharing | Sync done: optional account, campaigns/characters/notes/maps/monsters/tables across devices, conflict-safe. Not yet: sharing a campaign with players |
| M7 Polish and launch | In progress: code-splitting, welcome guide, accessibility pass, DESIGN.md done. Open: trademark/domain check, dark logo |

## 4. Recommended technical approach (proposal, not decided)

- **Language/UI:** TypeScript with a component framework (React or Svelte; pick at M0).
- **Storage:** notes as markdown files with frontmatter; structured data (characters, combat) as JSON; images as files. In the browser this sits on IndexedDB/OPFS; on desktop, real files on disk.
- **Desktop:** wrap the same app with Tauri (lighter than Electron).
- **Sync (M6):** design the data model now so sync can be added later, ideally a conflict-friendly approach so offline edits merge.
- **Search:** local full-text index.
- **Dice:** a WebGL/physics-based roller (separate module so it can be swapped).

Open: framework choice, sync backend, whether the desktop build ships with M0 or later.

## 5. Content and legal

- **Rules content:** ship only what we have rights to. The D&D System Reference Document (SRD 5.1) is published under a Creative Commons licence, so SRD content is fair game; confirm exact terms before use. Anything beyond that is user-supplied or entered by hand.
- **Books you own physically:** the free-write sheet and manual entry cover this without shipping any copyrighted text.
- **Branding:** always label it "Unofficial" wherever D&D is mentioned. Do not use Wizards of the Coast logos, fonts, or art.
- **D&D Beyond import:** only handle files the user exports themselves. Do not scrape or log in on their behalf. Check terms before building anything beyond PDF parsing.
- **Name:** "Throne" is not cleared. Other THRONE software marks exist. Search the trademark databases and domains, and consult a trademark attorney, before launch.

## 6. Brand and design

**Name and marks (final art lives in Affinity, copy in `brand/logo/`)**
- Wordmark "Throne": letters in Metamorphous, the o is a red d20 with a 0 in Pirata One (older d20s are numbered 0 to 9 twice).
- Tagline: "UNOFFICIAL D&D CAMPAIGN MANAGER" in Linux Libertine G.
- App icon: the red die on a dark rounded tile.
- Colours so far: red `#ba0000`, ink `#14100e`, bone `#efe6d2`. The red die is identical in light and dark mode.

**App look (next design step)**
The first picker round of generic looks was rejected: none felt like D&D. The app's look should be built from the logo (red die, Metamorphous and Pirata One type, ink and bone), not from an outside style.

**How Impeccable is used**
- `PRODUCT.md` is written and is the source of product truth.
- App screens are an "Operate" surface: task first, scanability and consistency win, the brand shows in precise details.
- Order of work: `shape` a screen (brief, no code) → build it → `critique` → `polish` → `audit` for accessibility and responsiveness.
- After the first build, `document` writes `DESIGN.md` from what was actually built.
- `live` iterates variants in the browser on a running app.
- Impeccable was updated to v4.10.0. Its doctor flagged one optional setting (`buildPath`) that only matters when image generation is available.

## 6b. Assets still to produce
- Dark-mode logo (halo colour must match the dark background).
- Favicon and app-icon sizes (use the simplified or solid die; the full die clogs near 16 px).
- SVG exports from Affinity with the 0 and halo as curves.

## 7. Open decisions
1. Framework and sync approach.
2. Whether the desktop build is part of v1.
3. Exact import formats beyond D&D Beyond PDFs.
4. Final name, once the trademark check is done.
5. How much SRD content to include.
6. App look direction, built from the logo.

## 8. Accounts and backend
- **Supabase:** the account has one project (`learn-elvish`), which belongs to something else and is left alone. Throne gets its own project when sync (M6) starts. Creating a project has a cost, so I confirm the cost with you at that point.
- **D&D Beyond:** signed in via the built-in browser, read-only research. No character data is changed or created.

## 9. Next actions (in order, no waiting)
1. Scaffold the app (M0) and build the design tokens from the logo.
2. Build the notes core (M1).
3. Build the character sheet, then the PDF importer using the field map (M2).
4. Trademark and domain check for Throne runs in parallel whenever a search is cheap.
