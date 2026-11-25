import Dexie, { type EntityTable } from 'dexie'
import type { Ability } from './lib/rules'

export type NoteKind = 'note' | 'character' | 'npc' | 'location' | 'session'

/** syncId links a local campaign to its cloud row; syncedVersion/syncedHash record the last state both sides agreed on. */
export interface Campaign { id: number; name: string; createdAt: number; syncId?: string; syncedVersion?: number; syncedHash?: string }

export interface Note {
  id: number; campaignId: number; characterId?: number; title: string; body: string
  kind: NoteKind; tags: string[]; createdAt: number; updatedAt: number
  /** Folder path like "Sessions/Arc 1". Empty or missing = top level. */
  folder?: string
  /** NPC card (used when kind is npc). */
  card?: NpcCard
}

export type ActionKind = 'action' | 'bonus' | 'reaction' | 'other'
export interface Attack { name: string; bonus: string; damage: string; notes: string; range?: string; kind?: ActionKind }
export interface Item { name: string; qty: number; weight: number; equipped: boolean; notes?: string }
export interface Spell {
  name: string; level: number; prepared: boolean
  time?: string; range?: string; components?: string; duration?: string
  concentration?: boolean; ritual?: boolean; hit?: string; source?: string; notes?: string
}
export interface Resource { name: string; max: number; used: number; rest: 'short' | 'long'; kind?: ActionKind }

/** One class on a (possibly multiclass) character. `used` = hit dice of this class spent. */
export interface ClassLevel { name: string; subclass: string; level: number; hitDie: number; used: number }

export interface Character {
  id: number
  campaignId?: number
  mode: 'guided' | 'freewrite'
  name: string; species: string; className: string; subclass: string; level: number
  background: string; alignment: string; player: string
  abilities: Record<Ability, number>
  saveProf: Ability[]
  skillProf: Record<string, 0 | 1 | 2>
  hpMax: number; hpCurrent: number; hpTemp: number
  hitDie: number; hitDiceUsed: number
  /** Multiclass breakdown. When absent the character has one class: className/subclass/level/hitDie. */
  classes?: ClassLevel[]
  ac: number; speed: number; initiativeBonus: number; inspiration: boolean
  attacks: Attack[]; inventory: Item[]
  coins: { cp: number; sp: number; ep: number; gp: number; pp: number }
  resources: Resource[]
  features: string
  /** Free text, one group per line, e.g. "Armor: Light, Medium". */
  proficiencies?: string
  senses?: string
  defenses?: string
  conditions?: string[]
  /** Spellcasting: ability, slot maxima and used counts indexed by spell level (index 0 unused). */
  spellAbility?: Ability | ''
  slots?: number[]; slotsUsed?: number[]
  spells?: Spell[]
  traits: string; ideals: string; bonds: string; flaws: string; backstory: string
  portrait?: string
  createdAt: number; updatedAt: number
}

export interface Combatant {
  id: number; campaignId: number; name: string; initiative: number
  hp: number; maxHp: number; ac: number; conditions: string[]; isPlayer: boolean; characterId?: number
  tempHp?: number; notes?: string; cr?: string
}

export interface CombatState { id: number; campaignId: number; round: number; turn: number; active: boolean }

/** A pin on a map, in the image's own pixel coordinates. */
export interface MapPin { id: string; x: number; y: number; label: string; noteId?: number; color?: string }
/** A freehand line on a map, image pixel coordinates. */
export interface MapStroke { id: string; points: [number, number][]; color: string; width: number }
export interface LibraryItem {
  id: number; campaignId: number; name: string; kind: 'map' | 'image' | 'handout'
  mime: string; blob: Blob; createdAt: number
  pins?: MapPin[]; strokes?: MapStroke[]
  /** sha-256 of the blob, filled in when the file is synced. */
  hash?: string
}

/** A reusable monster you saved from a fight (any campaign). */
export interface Monster { id: number; name: string; hp: number; ac: number; cr?: string; initBonus: number; notes?: string; createdAt: number }

/** A reusable random table (any campaign). `rows` is the text the DM typed: one entry per line, optional "1-3:" ranges. */
export interface RandomTable { id: number; name: string; rows: string; createdAt: number; updatedAt: number }

/** Structured card for NPC notes. */
export interface NpcCard { role?: string; species?: string; look?: string; voice?: string; wants?: string; secret?: string }

export interface RollLog { id: number; at: number; label: string; formula: string; dice: number[]; modifier: number; total: number; physical: boolean; mode: string; kept?: number; who?: string }

export const db = new Dexie('throne') as Dexie & {
  campaigns: EntityTable<Campaign, 'id'>
  notes: EntityTable<Note, 'id'>
  characters: EntityTable<Character, 'id'>
  combatants: EntityTable<Combatant, 'id'>
  combat: EntityTable<CombatState, 'id'>
  library: EntityTable<LibraryItem, 'id'>
  rolls: EntityTable<RollLog, 'id'>
  monsters: EntityTable<Monster, 'id'>
  randomTables: EntityTable<RandomTable, 'id'>
}

db.version(1).stores({
  campaigns: '++id, name',
  notes: '++id, campaignId, title, kind, updatedAt, *tags',
})
db.version(2).stores({
  campaigns: '++id, name',
  notes: '++id, campaignId, characterId, title, kind, updatedAt, *tags',
  characters: '++id, campaignId, name, updatedAt',
  combatants: '++id, campaignId, initiative',
  combat: '++id, campaignId',
  library: '++id, campaignId, kind, createdAt',
  rolls: '++id, at',
})
db.version(3).stores({ monsters: '++id, name' })
db.version(4).stores({ randomTables: '++id, name' })

export const blankCharacter = (over: Partial<Character> = {}): Omit<Character, 'id'> => ({
  mode: 'freewrite', name: 'New character', species: '', className: '', subclass: '', level: 1,
  background: '', alignment: '', player: '',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  saveProf: [], skillProf: {},
  hpMax: 10, hpCurrent: 10, hpTemp: 0, hitDie: 8, hitDiceUsed: 0,
  ac: 10, speed: 30, initiativeBonus: 0, inspiration: false,
  attacks: [], inventory: [], coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, resources: [],
  features: '', proficiencies: '', senses: '', defenses: '', conditions: [], spellAbility: '', slots: [], slotsUsed: [], spells: [], traits: '', ideals: '', bonds: '', flaws: '', backstory: '',
  createdAt: Date.now(), updatedAt: Date.now(), ...over,
})

/** First-run sample content so the app is not empty. Everything here is labelled sample. */
export async function seedIfEmpty() {
  if ((await db.campaigns.count()) > 0) return
  const now = Date.now()
  const campaignId = await db.campaigns.add({ name: 'Sample campaign', createdAt: now })
  const mk = (title: string, kind: NoteKind, body: string, tags: string[] = ['sample']) =>
    ({ campaignId, title, kind, body, tags, createdAt: now, updatedAt: now })
  await db.notes.bulkAdd([
    mk('Welcome to Throne', 'note',
`# Welcome to Throne

This is a **sample note**. Notes are plain markdown, and you link between them with double brackets, like [[Warden Vael]] or [[The Sunken Chapel]].

- Switch between **Player** and **DM** with the toggle at the top.
- Characters, NPCs, places and sessions are all notes you can link.
- A link that points nowhere yet is dashed. Click it to create the note.

> Unofficial D&D Campaign Manager. Not affiliated with Wizards of the Coast.`),
    mk('Warden Vael', 'npc', `# Warden Vael\n\nKeeper of [[The Sunken Chapel]] gate. Lies about the tithe.\n\n**Wants:** the party out before the tide.`),
    mk('The Sunken Chapel', 'location', `# The Sunken Chapel\n\nHalf flooded at high tide. [[Warden Vael]] holds the only key.`),
    mk('Session 1: the tide comes in', 'session', `# Session 1\n\nThe party reached [[The Sunken Chapel]] at dusk. Ask [[Warden Vael]] about the ledger.`),
  ])
  await db.characters.add({
    ...blankCharacter({
      mode: 'guided', campaignId, name: 'Sample: Wren Ashdown', species: 'Elf', className: 'Ranger', level: 1, background: 'Criminal / Spy',
      alignment: 'Neutral Good', abilities: { str: 10, dex: 18, con: 14, int: 17, wis: 10, cha: 16 }, saveProf: ['str', 'dex'],
      skillProf: { acrobatics: 1, deception: 1, insight: 1, perception: 1, stealth: 1, survival: 1 },
      hpMax: 12, hpCurrent: 12, hitDie: 10, ac: 14, speed: 35,
      attacks: [
        { name: 'Crossbow, Hand', bonus: '+6', damage: '1d6+4 piercing', notes: 'Light, loading', range: '30/120' },
        { name: 'Scimitar', bonus: '+6', damage: '1d6+4 slashing', notes: 'Finesse, light', range: '5 ft.' },
        { name: 'Unarmed Strike', bonus: '+2', damage: '1 bludgeoning', notes: '' },
      ],
      inventory: [
        { name: 'Studded Leather', qty: 1, weight: 13, equipped: true }, { name: 'Crossbow, Hand', qty: 1, weight: 3, equipped: true },
        { name: 'Scimitar', qty: 1, weight: 3, equipped: true }, { name: 'Rations', qty: 10, weight: 2, equipped: false },
        { name: 'Torch', qty: 10, weight: 1, equipped: false },
      ],
      coins: { cp: 0, sp: 0, ep: 0, gp: 22, pp: 0 },
      resources: [{ name: "Hunter's Mark", max: 2, used: 0, rest: 'long', kind: 'bonus' }],
      features: '=== SPECIES TRAITS ===\n\n* Darkvision\nYou can see in dim light within 60 feet as if it were bright light.\n\n* Fey Ancestry\nAdvantage on saves to avoid or end the Charmed condition.\n\n=== CLASS FEATURES ===\n\n* Favored Enemy\nHunter\'s Mark is always prepared.',
      proficiencies: 'Armor: Light, Medium, Shields\nWeapons: Simple, Martial\nTools: Thieves\' Tools\nLanguages: Common, Elvish',
      senses: 'Darkvision 60 ft.', defenses: 'Immune to magical sleep',
      spellAbility: 'wis', slots: [0, 2], slotsUsed: [],
      spells: [
        { name: 'Druidcraft', level: 0, prepared: true, time: '1 action', range: '30 ft.', components: 'V, S', duration: 'Instantaneous', source: 'Species' },
        { name: "Hunter's Mark", level: 1, prepared: true, time: '1 bonus action', range: '90 ft.', components: 'V', duration: 'Concentration, up to 1 hour', concentration: true, hit: '1d6', source: 'Favored Enemy' },
      ],
    }),
  })
}
