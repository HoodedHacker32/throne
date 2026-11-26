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

/** First run: one empty campaign, nothing else. People start from their own characters and notes. */
export async function seedIfEmpty() {
  if ((await db.campaigns.count()) === 0) await db.campaigns.add({ name: 'My campaign', createdAt: Date.now() })
  await removeUntouchedSamples()
}

/** Older versions seeded sample notes and a sample character. Remove them once, but only if nobody has
 *  edited them (updatedAt === createdAt); anything the user changed is kept. */
async function removeUntouchedSamples() {
  try { if (localStorage.getItem('throne.samplesRemoved') === '1') return } catch { /* ignore */ }
  await db.transaction('rw', [db.campaigns, db.notes, db.characters], async () => {
    await db.notes.filter(n => n.tags.includes('sample') && n.updatedAt === n.createdAt).delete()
    await db.characters.filter(c => c.name.startsWith('Sample:') && c.updatedAt === c.createdAt).delete()
    await db.campaigns.filter(c => c.name === 'Sample campaign').modify({ name: 'My campaign' })
  })
  try { localStorage.setItem('throne.samplesRemoved', '1') } catch { /* ignore */ }
}
