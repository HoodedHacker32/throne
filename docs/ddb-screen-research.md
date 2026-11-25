# DDB research report (for the Throne build session)

Observed signed in on a free account, desktop 1440px (phone 390px for the sheet only). Structure and interactions only. Test character "Throne research" was deleted afterwards. Screenshots (80 JPEGs) stay on the owner's PC and were not uploaded.

## 1/5 Character builder

### Start (/characters/builder)
- "Character Creation Method": three equal cards: STANDARD (step by step), QUICKBUILDER (NEW badge), PREMADE (browse and claim). Quickbuilder/Premade not opened.
- Picking Standard immediately creates a server-side character (uses a slot) and routes to /characters/{id}/builder/class/choose. Default name "<User>'s Character".

### Persistent chrome
- Step bar: Settings, 1 Class, 2 Background, 3 Species, 4 Abilities, 5 Equipment, What's Next. Free jump between steps, current underlined. No done/error state per step in the bar.
- Below: avatar upload, Character Name field + "Show suggestions", sticky left/right arrow buttons (PREV/NEXT) mid-viewport.
- Unfinished required choices: blue "!" badge + blue outline on the collapsible row, subtitle "N Choices"; badge disappears and row greys when done. Choice counts can grow when a choice reveals a sub-choice.
- Nothing blocks navigation. Only "View character sheet" is disabled ("Unavailable - character incomplete"). Direct sheet URL shows "Character Not Ready - missing Species, Class or Ability Scores". Hard minimum = species + class + ability scores.
- Autosave on every change; a blocking centered logo spinner for 1-2 s after each edit; green toasts ("Spell Added", "Equipment Chosen").

### Class
- Source-grouped accordion list (5.5e Core, 5e Core Basic Rules, Critical Role...), search, Collapse/Expand all. Row = icon, name, source, chevron.
- Click opens "Confirm Add Class" modal: tagline, summary, primary ability, hit die, saves, details link, expandable core traits, CANCEL / ADD CLASS.
- Manage view: Character Level + advancement type, Max HP and Hit Dice box with MANAGE HP; class block with Level select (1-20), red X remove; tabs CLASS FEATURES / SPELLS.
- Features = collapsible cards with prose (Show more) and inline selects (skills: chosen option removed from sibling select). Named-option choice (Primal Order) shows option descriptions then one select; choosing one revealed a second choice (extra cantrip).
- "Available at Higher Levels (13)" collapsed list. "+ Add Another Class" link = multiclass (not completed).
- Manage HP modal: Max HP display; Fixed HP (read-only), HP Modifier, Override HP; Hit Dice; potential values (fixed/average/possible); explanations; CANCEL / APPLY.
- Spells tab: Prepared Spells (n) and Known Spells accordions; counters "Cantrips 0/2", "Prepared 0/4 (22 known)"; spell-name filter, collapsible Level chips and Source chips; spell rows (school icon, name, concentration marker, LEARN button, chevron); LEARN turns into red Delete; lazy load with spinner.

### Background
- Collapsed help card "Ability Score Increases, Languages, and Alignment".
- Searchable dropdown grouped by source, with "Custom Background" first. Shows description, skills, tools, then choice cards (granted feat, ability scores).
- Ability Scores: select "three scores +1/+1/+1" or "two scores +2/+1"; then +2 / +1 selects limited to the background's three stats.
- Cards: Character Details (alignment, faith, lifestyle), Physical (hair, skin, eyes, height, weight, age, gender), Personal (personality, ideals, bonds, flaws), Notes (organizations, allies, enemies, backstory, other).

### Species
- Source filter select, "Show Legacy Content" toggle, search, grouped list (portrait, name, source). Confirm modal with traits list and expandable trait cards; CANCEL / CONFIRM.
- Manage: name, blurb, portrait, "Change Species"; trait accordions (Creature Type, Size, Speed, Darkvision, traits, "Languages - 2 Choices", Origin).

### Abilities
- Method select: Standard Array / Manual-Rolled / Point Buy.
- Standard Array: six selects (8,10,12,13,14,15), duplicates not prevented, TOTAL under each.
- Point Buy: "Points Remaining 27/27", selects 8-15 with cost in option text.
- Manual/Rolled: six number inputs; Dice Roll Groups (+Add Group), six ROLL buttons (4 dice shown, lowest greyed), per-roll assign select, RESET GROUP / APPLY ABILITY SCORES; 3D dice + toast even here.
- Score Calculations (always visible): 3x2 cards with Total, Modifier, Base, Bonus, Set Score, Stacking Bonus, Other Modifier input, Override Score input. Live updates.

### Equipment
- Starting Equipment: per source (class, background) checkbox rows "(A) items / OR / (B) 50 GP"; A expands pack contents. Red SKIP STARTING EQUIPMENT becomes ADD STARTING EQUIPMENT; Clear All.
- Accordions: Current Inventory (n, total weight; rows with icon, name, type, QTY, WEAR/WIELD/USE buttons), Other Possessions, Add Items (filter text, type chips, Proficient/Common/Magical/Container checkboxes, source chips, rows with ADD, LOAD MORE), Currency (pp/gp/ep/sp/cp inputs with conversions, total in GP).

### What's Next
- VIEW CHARACTER SHEET (disabled if incomplete), EXPORT TO PDF, View all my characters, "Come Together" with FIND A GROUP / START A NEW CAMPAIGN.

### Settings tab
- Sources checklist (Homebrew, 5.5e Core, 5.5e Expanded, Drops, WoW, 5e Core, 5e Expanded, Legacy, Partnered); Enable Dice Rolling; Optional Class Features; Customize Your Origin; Advancement (Milestone/XP); Hit Point Type (Fixed/Manual); Use Prerequisites (Feats, Multiclass); Level-Scaled Spells; Encumbrance (Standard/None/Variant); Ignore Coin Weight; Modifier display (top/bottom); Character Privacy (Campaign only / Public / Private).

### Patterns worth copying
- One URL per step, free navigation, autosave; inline badge + count for unfinished choices rather than blocking.
- Confirm-in-modal for class/species; source-grouped lists; per-character source toggles.
- Always-visible calculation panel with bonus/set/stacking/override.
- Spell pick counters; starting equipment package vs gold with explicit skip.

### Pain points to improve
- No done/error state in step bar; final button doesn't say what is missing.
- Blocking spinner after each edit; duplicate standard-array values allowed; native small selects; long accordion scroll; accordion sometimes needs two clicks; sticky arrows overlap content.

## 2/5 Character sheet

### Desktop layout
- Top: portrait, name + MANAGE, "Dwarf Druid 1 / Level 1"; buttons SHORT REST, LONG REST, FIND A GROUP, menu icon; edge tab toggles right drawer.
- Stat row: six ability shields (modifier big, score in circle, click to roll), Proficiency, Speed, Initiative, Armor Class, Heroic Inspiration, Defenses, Conditions ("Add Active Conditions"), Hit Points (HEAL / DAMAGE, current / max / temp).
- Left column: saving throws (dot + bonus, advantage note), passive senses, senses, proficiencies. Middle: skills table (prof dot, ability tag, name, click-to-roll bonus). Right: tabs ACTIONS, SPELLS, INVENTORY, FEATURES & TRAITS, BACKGROUND, NOTES, EXTRAS.
- Actions: filter chips (All, Attack, Action, Bonus Action, Reaction, Other, Limited Use), MANAGE CUSTOM, attack table (name, range, hit/DC, damage, notes), "Actions in Combat" links, bonus actions and reactions sections. Custom action editor not opened.
- Spells: modifier / spell attack / save DC; search, filter button, MANAGE SPELLS; level chips; sections Cantrip, 1st level with table (name, time, range, hit/DC, effect, notes); AT WILL / CAST tags; slot checkboxes.
- Background tab: chips All/Background/Characteristics/Appearance; characteristics grid; traits/ideals with "+ Add" links. Notes tab: chips All/Orgs/Allies/Enemies/Backstory/Other with inline "+ Add".

### Right drawers (not modals)
- Short Rest: explanation; checkboxes "Reset Maximum HP changes", "Automatically apply healing with dice result"; per-class hit dice with one checkbox per die; TAKE SHORT REST / RESET.
- Long Rest: explanation; radios Recover 1/2 hit dice (5e) vs all hit dice (5.5e); reset max HP checkbox; TAKE LONG REST / RESET; "Benefits of the Rest" list.
- HP Management: current / max / temp; healing input + green apply; live NEW HP; damage input + red apply; max HP modifier; override max HP.
- Conditions: all conditions as toggles with icon and expandable rules.
- Game Log: newest at bottom; entry = name, "ATHLETICS: CHECK", formula "5 - 1 = 4", dice set name, timestamp.
- Manage: portrait + rename, class line, CHANGE SHEET APPEARANCE, MY CHARACTER (Manage Character & Levels, Character Settings), PLAY (Game Log, rests, Find a Group), SHARE (Export to PDF).

### Phone (390px)
- Single column: header (portrait, name, Manage, HP box, Heroic Inspiration), band (proficiency, speed, initiative, armor, Defenses/Conditions buttons), 3x2 ability grid, saving throws, passive senses. Tabs hidden behind floating buttons: left d20 (dice/log), right grid FAB (section switcher) and "<<" FAB (sidebar). Hamburger nav. 1024px not tested.

### Patterns / pain points
- Drawers keep sheet visible; roll anywhere with log; HP drawer with live preview; rests with rule-set choice; FAB navigation on mobile.
- Drawers cover the HP box; tiny icon buttons; heavy art; log hidden behind drawer; no obvious free dice roller; tiny slot checkboxes; mobile hides tabs.

## 3/5 My Characters (/characters)
- Header: breadcrumb, H1, CREATE A CHARACTER, "Slots: 1/6 Used", links Find a group, Download blank sheet.
- Toolbar: search (name, level, class, species, campaign); Sort By (Created oldest/newest, Name A-Z/Z-A, Level low/high, Modified latest/oldest); Settings button.
- Cards: grid (3 across desktop), banner with name, "Level 1 | Elf | Ranger", footer actions VIEW / EDIT / COPY / DELETE. DELETE opens "Delete this character?" and you must type the word DELETE to enable the red button (good pattern).
- Phone: stacked toolbar, single-column cards.
- Pain points: no folders/tags/campaign filter, no bulk actions, no HP/AC on card, tiny text-link actions.

## 4/5 DM side (free account; no campaign created or joined by rule)
- My Campaigns shows only an empty state with CREATE NEW CAMPAIGN and CREATE FROM PREMADE CAMPAIGNS. Campaign page, invites, DM tools, Maps VTT, handouts, combat tracker NOT seen.
- Encounter Builder (/encounter-builder, beta, 2014 math): editable name; party count and average level + MANAGE CHARACTERS; SAVE; tabs MONSTERS / SUMMARY. Left filters (type, environment, source, alignment, homebrew, CR slider 0-30, "remember my filters"). Monster table (name, type, size, CR, difficulty dots, +ADD, variants chevron, drag handle). Sticky Encounter Summary (difficulty, total XP, adjusted XP, daily budget, Easy/Medium/Hard/Deadly thresholds, gauge). No initiative/combat tracker available.
- Pain points: very long unsearchable source list; party info hidden behind a dialog; 2014 vs 2024 math split across tools.

## 5/5 Dice
CORRECTION (verified after the user pointed it out): there IS a free-form dice roller. The earlier "no standalone roller" statement was wrong because I had not opened the button.
- Free-form roller: red d20 floating button at the bottom-left of the sheet opens a "Roll Dice" popover anchored to it (close X top-right). Contents: current dice set thumbnail + name with "Change Dice" link (to My Dice) and a gear icon; a 7-die palette (d20, d12, d100, d10, d8, d6, d4). Each click on a die adds one to the pool and shows a small count badge on it (highlighted); buttons RESET (clear pool) and red ROLL; "CLEAR DICE" link (clears dice from the screen). Rolled d20 + d6 -> 3D dice tumble over the sheet and toast "<Char> ROLLED CUSTOM 9" (type "CUSTOM", total). Result also goes in the Game Log.
- Gear opens a "3D Dice Settings" modal: Visibility radios (Shared Dice - see others' rolls / Only My Dice / Disable 3D Dice - notifications only), Sound Effects Volume slider, Particle Effects Enabled/Disabled, Post-Processing Effects Enabled/Disabled (performance), Shadow Quality High/Medium/Low.
- No modifier field or advantage/disadvantage control seen in the free-form popover (pool + ROLL only); did not test shift/ctrl-click.
- Also: click-to-roll numbers on the sheet (ability checks, saves, skills, initiative, attack, damage), builder ability-score roller.
- Feedback: full-page 3D dice animation, toast pill "<Char> rolled <TYPE> <total>", Game Log entry with formula. "Enable Dice Rolling" is a per-browser setting.
- My Dice (/my-dice): cosmetic dice-set gallery.
- Worth copying: formula breakdown in the log, result toast even when 3D is disabled, shared-dice visibility setting. Pain: ~1-2 s animation delay; no modifier or advantage/disadvantage in the free roller.
- Advantage/disadvantage toggle not seen (only a green "A" advantage note on saves).

## Not captured
Quickbuilder and Premade; multiclass completion; prepared-spell toggles on the sheet; Inventory/Features tabs in detail; custom action editor; sheet appearance picker; campaign/DM pages beyond empty state and Encounter Builder; 1024px width.
