/** Map D&D Beyond PDF export form fields to a Throne character. Pure, no pdf.js here, so it is testable. */
import type { Attack, Character, ClassLevel, Item, Spell } from '../db'
import { blankCharacter } from '../db'
import { ABILITIES, CLASSES, type Ability } from './rules'
import { castingTime } from './spells'

export type Fields = Record<string, string>

const SKILL_FIELDS: Record<string, string[]> = {
  acrobatics: ['AcrobaticsProf'], animal: ['AnimalHandlingProf'], arcana: ['ArcanaProf'], athletics: ['AthleticsProf'],
  deception: ['DeceptionProf'], history: ['HistoryProf'], insight: ['InsightProf'], intimidation: ['IntimidationProf'],
  investigation: ['InvestigationProf'], medicine: ['MedicineProf'], nature: ['NatureProf'], perception: ['PerceptionProf'],
  performance: ['PerformanceProf'], persuasion: ['PersuasionProf'], religion: ['ReligionProf'],
  sleight: ['SleightOfHandProf'], stealth: ['StealthProf'], survival: ['SurvivalProf'],
}
const SAVE_FIELDS: Record<Ability, string> = { str: 'StrProf', dex: 'DexProf', con: 'ConProf', int: 'IntProf', wis: 'WisProf', cha: 'ChaProf' }

/** Look a field up, tolerating the export's stray trailing spaces. */
export function field(f: Fields, name: string): string {
  return (f[name] ?? '').trim()
}
/** Trim key names; a non-empty value wins over an empty duplicate. */
export function normalise(raw: Fields): Fields {
  const out: Fields = {}
  for (const [k, v] of Object.entries(raw)) { const key = k.trim(); if (!(key in out) || (!out[key] && v)) out[key] = v }
  return out
}
const int = (s: string, d = 0) => { const m = s.match(/-?\d+/); return m ? Number(m[0]) : d }
const num = (s: string, d = 0) => { const m = s.match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : d }

/** "Ranger 1", "Fighter 3 / Wizard 2" -> first class name, total level. */
export function parseClassLevel(s: string) {
  const parts = [...s.matchAll(/([A-Za-z][A-Za-z' ]*?)\s+(\d+)/g)]
  if (!parts.length) return { className: s.trim(), subclass: '', level: 1 }
  const level = parts.reduce((t, p) => t + Number(p[2]), 0)
  const first = parts[0][1].trim()
  const known = CLASSES.find(c => first.toLowerCase().includes(c.name.toLowerCase()))
  const className = known?.name ?? first
  const subclass = known ? first.replace(new RegExp(known.name, 'i'), '').trim() : ''
  return { className: parts.length > 1 ? parts.map(p => `${p[1].trim()} ${p[2]}`).join(' / ') : className, subclass, level: Math.max(1, Math.min(20, level)) }
}

export function looksLikeDdb(raw: Fields) {
  const f = normalise(raw)
  return 'CharacterName' in f && ('CLASS  LEVEL' in f || 'STR' in f)
}

export function fromDdb(raw: Fields): Omit<Character, 'id'> {
  const f = normalise(raw)
  const abilities = Object.fromEntries(ABILITIES.map(a => [a, int(field(f, a.toUpperCase()), 10)])) as Record<Ability, number>
  const { className, subclass, level } = parseClassLevel(field(f, 'CLASS  LEVEL'))
  const classes = parseClasses(field(f, 'CLASS  LEVEL'))
  const known = CLASSES.find(c => (classes[0]?.name ?? className).startsWith(c.name))
  const hitDie = classes.length > 1 ? classes[0].hitDie : int(field(f, 'Total').replace(/^\d+d/, ''), known?.hitDie ?? 8)

  const skillProf: Character['skillProf'] = {}
  for (const [key, names] of Object.entries(SKILL_FIELDS)) {
    const v = names.map(n => field(f, n)).find(Boolean) ?? ''
    if (v) skillProf[key] = /^E$/i.test(v) ? 2 : 1 // P = proficient, E = expertise, other glyphs = proficient
  }
  const saveProf = ABILITIES.filter(a => field(f, SAVE_FIELDS[a]) !== '')

  const attacks: Attack[] = []
  for (let i = 1; i <= 6; i++) {
    const name = field(f, i === 1 ? 'Wpn Name' : `Wpn Name ${i}`)
    if (!name) continue
    const notes = field(f, `Wpn Notes ${i}`)
    const range = notes.match(/Range \(([^)]+)\)/)?.[1] ?? ''
    attacks.push({ name, bonus: field(f, `Wpn${i} AtkBonus`), damage: field(f, `Wpn${i} Damage`), notes: notes.replace(/,?\s*Range \([^)]+\)/, ''), range, kind: 'action' })
  }

  const inventory: Item[] = []
  for (let i = 0; i <= 40; i++) {
    const name = field(f, `Eq Name${i}`)
    if (!name) continue
    inventory.push({ name, qty: int(field(f, `Eq Qty${i}`), 1) || 1, weight: num(field(f, `Eq Weight${i}`)), equipped: false })
  }

  const maxHp = int(field(f, 'MaxHP'), 10)
  const cur = field(f, 'CurrentHP')
  const temp = field(f, 'TempHP')
  const join = (...names: string[]) => names.map(n => field(f, n)).filter(Boolean).join('\n\n')
  const details = [
    ['Gender', 'GENDER'], ['Age', 'AGE'], ['Size', 'SIZE'], ['Height', 'HEIGHT'], ['Weight', 'WEIGHT'], ['Faith', 'FAITH'],
    ['Skin', 'SKIN'], ['Eyes', 'EYES'], ['Hair', 'HAIR'],
  ].map(([l, n]) => field(f, n) && `${l}: ${field(f, n)}`).filter(Boolean).join('\n')

  const features = [
    join('FeaturesTraits1', 'FeaturesTraits2', 'FeaturesTraits3'),
    join('Actions1', 'Actions2'),
  ].filter(Boolean).join('\n\n')

  const backstory = [
    join('Backstory'),
    field(f, 'Appearance') && `Appearance: ${field(f, 'Appearance')}`,
    details,
    field(f, 'AlliesOrganizations') && `Allies and organisations: ${field(f, 'AlliesOrganizations')}`,
    join('AdditionalNotes1', 'AdditionalNotes2'),
  ].filter(Boolean).join('\n\n')

  const { spells, slots, ability } = parseSpells(f)

  return blankCharacter({
    spells, slots, slotsUsed: Array(10).fill(0), spellAbility: ability,
    mode: 'freewrite',
    name: field(f, 'CharacterName') || 'Imported character',
    player: field(f, 'PLAYER NAME'),
    species: field(f, 'RACE'),
    ...(classes.length > 1
      ? { classes, className: classes[0].name, subclass: classes[0].subclass, level: classes.reduce((t, k) => t + k.level, 0) }
      : { className, subclass, level }),
    background: field(f, 'BACKGROUND'), alignment: field(f, 'ALIGNMENT'),
    abilities, saveProf, skillProf,
    hpMax: maxHp, hpCurrent: cur && /\d/.test(cur) ? int(cur) : maxHp, hpTemp: /\d/.test(temp) ? int(temp) : 0,
    hitDie, ac: int(field(f, 'AC'), 10), speed: int(field(f, 'Speed'), 30),
    initiativeBonus: int(field(f, 'Init')) - Math.floor((abilities.dex - 10) / 2),
    inspiration: field(f, 'Inspiration') !== '',
    attacks, inventory,
    coins: { cp: int(field(f, 'CP')), sp: int(field(f, 'SP')), ep: int(field(f, 'EP')), gp: int(field(f, 'GP')), pp: int(field(f, 'PP')) },
    features,
    proficiencies: parseProficiencies(field(f, 'ProficienciesLang')),
    senses: field(f, 'AdditionalSenses'), defenses: [field(f, 'Defenses'), field(f, 'SaveModifiers')].filter(Boolean).join('\n'),
    traits: field(f, 'PersonalityTraits'), ideals: field(f, 'Ideals'), bonds: field(f, 'Bonds'), flaws: field(f, 'Flaws'),
    backstory,
  })
}

/** "=== ARMOR === \nLight Armor, ..." -> "Armor: Light Armor, ..." one group per line. */
export function parseProficiencies(text: string): string {
  const out: string[] = []
  for (const m of text.matchAll(/===\s*([^=]+?)\s*===\s*([^=]*)/g)) {
    const head = m[1].trim().toLowerCase().replace(/^\w/, c => c.toUpperCase())
    const body = m[2].replace(/\s*\n\s*/g, ' ').trim()
    if (body) out.push(`${head}: ${body}`)
  }
  return out.join('\n')
}

/** Page 4: rows 0-1 use "spellName0" style names, later rows "SpellName5" style. A "spellHeader<N>" starts a new level. */
export function parseSpells(f: Fields): { spells: Spell[]; slots: number[]; ability: Ability | '' } {
  const spells: Spell[] = []
  const slots = Array(10).fill(0)
  let level = 0
  const get = (a: string, b: string, n: number) => field(f, `${a}${n}`) || field(f, `${b}${n}`)
  for (let n = 0; n <= 80; n++) {
    const header = field(f, `spellHeader${n}`)
    if (header) {
      level = /cantrip/i.test(header) ? 0 : Number(header.match(/(\d)/)?.[1] ?? level)
      const sl = field(f, `spellSlotHeader${n}`).match(/(\d+)\s*Slots?/i)
      if (sl && level > 0) slots[level] = Number(sl[1])
    }
    const name = get('spellName', 'SpellName', n)
    if (!name) continue
    const prep = get('spellPrepared', 'Prepared', n)
    const duration = get('spellDuration', 'Duration', n)
    const notes = get('spellNotes', 'Notes', n)
    spells.push({
      name, level, prepared: level === 0 || /[PA]/i.test(prep),
      time: castingTime(get('spellCastingTime', 'CastingTime', n)), range: get('spellRange', 'Range', n),
      components: get('spellComponents', 'Components', n), duration,
      concentration: /concentration/i.test(duration), ritual: /ritual/i.test(notes),
      hit: get('spellSaveHit', 'SaveHit', n).replace(/^--$/, ''), source: get('spellSource', 'SpellSource', n), notes,
    })
  }
  const ab = field(f, 'spellCastingAbility0').toLowerCase().slice(0, 3)
  return { spells, slots, ability: (ABILITIES as readonly string[]).includes(ab) ? ab as Ability : '' }
}

/** "Fighter 3 / Wizard 2" -> two classes with hit dice from the class table. One class -> one item. */
export function parseClasses(s: string): ClassLevel[] {
  return [...s.matchAll(/([A-Za-z][A-Za-z' ]*?)\s+(\d+)/g)].map(m => {
    const raw = m[1].trim()
    const info = CLASSES.find(c => raw.toLowerCase().includes(c.name.toLowerCase()))
    return { name: info?.name ?? raw, subclass: info ? raw.replace(new RegExp(info.name, 'i'), '').trim() : '', level: Number(m[2]), hitDie: info?.hitDie ?? 8, used: 0 }
  })
}
