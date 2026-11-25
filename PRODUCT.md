# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Web app / installable PWA first, with a desktop build (wrapper such as Tauri or Electron) as the second target. Exact framework: delegated, to be chosen at build time. Local-first storage (plain markdown plus assets on the user's machine), optional sync later.

## Users
Two roles, often the same person across different tables.
- Players: look up and run their character during play, import existing sheets, keep personal notes on their character and the campaign, keep character art. Phones, tablets, laptops.
- Dungeon Masters: run a campaign across sessions. Keep campaign notes, maps, drawings, frequently reused resources (a world map made in Inkarnate), and run a light table console on a tablet or laptop mid-session.
Creator is an amateur graphic designer and a D&D Beyond user who finds Beyond lacking.

## Product Purpose
A D&D companion where notes management is the headline feature. It covers what D&D Beyond leaves out or paywalls: real note-taking tied to characters and campaigns, support for books the user owns only physically, and free access to the core tools. Success means a table can run an entire campaign from it, with every note, sheet, map and roll findable.

## Positioning
Notes-first, not rules-database-first. Works with the books you actually own (physical or not) instead of selling content. Local-first, so notes are plain files the user owns.

## Operating Context
- Sessions at a physical or virtual table: low light, one hand on a device, quick glances.
- Between sessions: long-form writing, organizing, reading back.
- Character sheets arrive as D&D Beyond PDFs or other common formats.
- Mixed dice: virtual rolls and physical dice with manually entered results.

## Capabilities and Constraints
Confirmed v1 scope (all four, notes is the headline):
- Notes and character sheets: markdown notes linked to characters, character art, PDF import (D&D Beyond and other common formats). Sheets must work like D&D Beyond's: a Standard step-by-step builder AND a free-write mode where the user types straight into the finished sheet. Long rest, short rest, inventory and resource tracking included.
- DM library and maps: campaign notes, maps, drawings, reusable resources.
- DM combat console: active enemies, initiative, HP, conditions. Deliberately simple.
- Dice: virtual roller of D&D Beyond quality, plus manual entry of physical rolls.
Constraints: local-first with optional sync; desktop and PWA; no copyrighted book content shipped (user supplies their own). Open: licensing posture for rules content (SRD only vs user-supplied), sync backend, exact import formats.

## Brand Commitments
Name: Throne (homophone of "thrown", as in thrown dice). Not yet cleared: other THRONE software marks exist in Class 9/42, so trademark and domain checks are still open.
Wordmark: "Throne" set in Metamorphous, with the "o" replaced by a red (#ba0000) d20 showing a 0 in Pirata One (older d20s are numbered 0-9 twice). The red die is identical in light and dark modes; only the letters and the 0 flip colour.
App icon: the red d20 on a dark rounded tile.
Descriptor, binding: "Unofficial D&D Campaign Manager". Wherever the branding mentions D&D it must say it is unofficial. The app is D&D only, not a general TTRPG tool.
App look, binding: the user chose the category standard on purpose, a D&D Beyond-style app (dark charcoal chrome, red accents, parchment content panels, condensed headings), executed at full craft with the Throne logo colours and Metamorphous/Pirata One. The craft bar is the quality of D&D Beyond (tabletop sheet and builder), Obsidian/Notion (notes), Foundry VTT/Roll20 (DM tools) and Linear/Things (general polish). We copy workflow and structure, never D&D Beyond's logo, artwork, fonts or trade dress. The app is a real multi-screen app with separate Player and DM menus, not one crowded page.
The user redraws the final logo in Affinity, so the HTML mockups in brand/ are concept direction, not final art.

## Evidence on Hand
No product content, screenshots or users yet. D&D Beyond is open in the user's browser as a reference for the character sheet flow. Nothing may be invented as proof.

## Product Principles
- Notes are first-class: every character, NPC, map and session is a note someone can link to.
- Plain files the user owns; the app never holds notes hostage.
- Fast at the table, deep between sessions.
- Works with whatever books and tools the table already has.
- Free core; no paywall on basics.
