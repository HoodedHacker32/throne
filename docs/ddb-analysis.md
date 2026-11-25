# D&D Beyond analysis

What we learned from a signed-in D&D Beyond account (one level-1 character) and its PDF export. This is research for building our own equivalent. We mimic the **workflow and information structure**, not D&D Beyond's artwork, logo, fonts or trade dress.

## 1. The PDF export is easy to import

- The export is a 4-page PDF (a flat file, but **with fillable form fields**). Reading the annotations (`/Widget`, name `/T`, value `/V`) gives every value directly. No OCR or layout guessing.
- The file has no standard AcroForm entry, so a normal "get fields" call returns 0. You must walk each page's annotations. Use a PDF library that exposes page annotations (pdf.js in the browser can do this).
- 775 named fields in our sample. Full list: [fixtures/ddb-export-ranger-fields.json](fixtures/ddb-export-ranger-fields.json).

**Field map (page 1, main sheet)**
- Identity: `CharacterName`, `CLASS  LEVEL` (two spaces), `PLAYER NAME`, `RACE` (labelled Species), `BACKGROUND`, `EXPERIENCE POINTS`.
- Abilities: `STR`/`STRmod`, `DEX`/`DEXmod ` (trailing space), `CON`, `INT`, `WIS`, `CHA`/`CHamod`.
- Saves: `StrProf`... (proficiency marker) and `ST Strength`... (bonus).
- Skills: per skill `<Skill>Prof` (marker `P` or empty), `<Skill>` (bonus), `<Skill>Mod` (ability). Some names are irregular (`Animal`, `SleightofHand`, `Stealth ` with a trailing space).
- Combat: `Init`, `AC`, `ProfBonus`, `AbilitySaveDC`, `Speed`, `MaxHP`, `CurrentHP`, `TempHP`, `HD`, `Total`, `Defenses`, `Inspiration`.
- Senses and proficiencies: `Passive1-3`, `AdditionalSenses`, `ProficienciesLang`.
- Actions text: `Actions1`, `Actions2`. Attacks: `Wpn Name`, `Wpn1 AtkBonus`, `Wpn1 Damage`, `Wpn Notes 1` and so on for rows 2 to 6.

**Page 2:** repeat header fields, `FeaturesTraits1-3`, currency `CP/SP/EP/GP/PP`, `Weight Carried`, `Encumbered`, `PushDragLift`, equipment rows `Eq Name0..25` with `Eq Qty` and `Eq Weight`, and `Attuned Name1-3`.
**Page 3:** `GENDER, AGE, SIZE, HEIGHT, WEIGHT, ALIGNMENT, FAITH, SKIN, EYES, HAIR`, `Appearance`, `Backstory`, `PersonalityTraits `, `Ideals`, `Bonds`, `Flaws`, `AlliesOrganizations`, `AdditionalNotes1-2`. `CHARACTER IMAGE` is an image field.
**Page 4 (spells):** `spellCastingAbility0`, `spellSaveDC0`, `spellAtkBonus0`, `spellCastingClass0`, then spell rows named `spellName<N>`, `SpellName<N>`, `spellSource`, `CastingTime`, `Range`, `Components`, `Duration`, `Notes`. The naming changes between rows 0-1 and later rows, so the importer needs both patterns.

**Importer notes**
- Values are strings with formatting already applied (`+4`, `13 lb.`). Parse, do not trust.
- Features text uses a plain-text convention (`=== RANGER FEATURES ===`, `* Feature • PHB-2024 119`). Store the raw text and parse headings as a bonus.
- The export is the 2024 rules (source tags like `PHB-2024`).
- The sample contains a few characters that decode as `�` (marker glyphs). Treat unknown glyphs in `*Prof` fields as "proficient if non-empty".
- Only process files the user exports themselves.

## 2. The character builder (steps and what each does)

URL pattern: `/characters/<id>/builder/<step>/manage`. Steps in order (2024 rules order):
1. **Class:** pick class and level, shows hit points and hit dice, collapsible class features with choices (e.g. Favored Enemy, Weapon Mastery), a Spells tab, "Add another class" for multiclass. "Manage HP" button.
2. **Background:** pick a background, then its ability score increases, languages and alignment; skill and tool proficiencies shown with dropdown choices; background feature; Suggested Characteristics; character details (alignment, faith, lifestyle, hair/skin/eyes, height/weight/age/gender, personality, ideals, bonds, flaws, notes, organizations, allies, enemies, backstory).
3. **Species:** pick a species, lists traits (creature type, size, speed, darkvision, lineage and so on), each trait expandable, some with choices (lineage, languages).
4. **Abilities:** a mode switch (Manual/Rolled shown; standard array and point buy are the other usual modes). Dice roll groups with assignable rolls, "Apply ability scores", ability score increases from background/species, and a calculations section per ability (base, bonus, set, stacking bonus, other modifier, override).
5. **Equipment:** starting equipment choices and a current-inventory list with quantity, wield/wear/use controls, "Other possessions", add items, and currency with total in GP.
6. **What's Next:** "View character sheet", "Export to PDF", "View all my characters", plus groups and campaign actions.
Also a **Settings** tab (source/content selection) and a persistent step bar with Prev/Next.

**What to copy:** the five-step flow, the persistent step bar, choices shown inline per trait, per-ability calculation transparency with overrides, inventory management, the final hand-off to the sheet.
**What we improve:** notes and backstory are first-class, a free-write mode skips the builder entirely, nothing is paywalled, and books you own are handled by manual entry.

## 3. The digital character sheet

Layout of the live sheet:
- **Header:** portrait, name, level/species/class, Share, Short Rest, Long Rest, Find a Group.
- **Top strip:** six ability scores (modifier large, score small), proficiency bonus, speed, heroic inspiration, initiative, armor class, hit points (heal/damage controls, current/max/temp).
- **Left column:** saving throws, passive senses, proficiencies and training, skills with proficiency dots and an ability tag.
- **Right panel (tabs):** Actions, Spells, Inventory, Features & Traits, Background, Notes, Extras. Actions has filters (All, Attack, Action, Bonus Action, Reaction, Other, Limited Use) and an attack table with range, hit/DC, damage and notes. Click a number to roll.
- Defenses and conditions sit beside the AC.

Takeaways for our sheet: scannable top strip, rest buttons in the header, one tabbed panel for everything else, every number clickable to roll.

## 3b. Responsive behaviour (studied 2026-11-22 on the public sheet at 1920, 1440, 1024, 768, 390 px)
- **Desktop (>=1024):** header band (portrait, name, sub line, rest buttons). One quick-info row: six abilities (label, big modifier, score in a pill below), proficiency, walking speed, heroic inspiration, hit points box (heal / amount / damage stacked on the left, current / max / temp on the right).
- Below, three columns: (1) saving throws as a 2x3 grid of pills (STR/DEX/CON down the first column), passive senses, proficiencies & training (armor, weapons, tools, languages); (2) skills table with PROF / MOD / SKILL / BONUS headers; (3) initiative, armor class and a defenses + conditions box, then the big tabbed panel.
- Section labels sit at the **bottom** of each box. Tabs have filter chips: Actions (All, Attack, Action, Bonus Action, Reaction, Other, Limited Use), Inventory (weight carried, search, All/Equipment/Backpack, table Active/Name/Weight/Qty/Cost/Notes), Features (All, Class Features, Species Traits, Feats).
- Clicking a label (ability, skill, item) opens a **right-hand detail sidebar** with the calculation breakdown and overrides; clicking the number rolls. The sidebar overlays content and can be pinned.
- **Tablet (768):** HP moves into the header; prof/speed/initiative/AC row, then abilities row, then two columns (saves + senses | skills).
- **Phone (390):** HP in header, compact prof/speed/init/AC row, abilities 3x2, then sections reached from a floating menu button.
- The builder needs a signed-in account (redirects to a marketing page), so section 2 above is the reference for it.

## 4. Open questions
- D&D Beyond is on the 2024 rules. The SRD (v5.2) is the content we may bundle, under a Creative Commons licence; confirm terms before use.
- Terms of service for importing: stay with user-exported PDFs only.
