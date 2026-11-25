/** Random tables: parse the DM's text, roll, and expand {dice} and {Other table} references. */
import { roll } from './dice'

export interface Row { from: number; to: number; text: string }

/** One entry per line. "1-3: text", "4: text" or "3-4 text" set ranges; plain lines (even "3 goblins") get one number each.
 *  Lines starting with # and blank lines are ignored. */
export function parseRows(text: string): Row[] {
  const rows: Row[] = []
  let next = 1
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^(\d+)\s*(?:[-–]\s*(\d+))?\s*[:.)|]?\s+(.+)$/)
    if (m && (m[2] !== undefined || /^\d+\s*[:.)|]/.test(line))) {
      const from = Number(m[1]), to = m[2] !== undefined ? Number(m[2]) : from
      rows.push({ from: Math.min(from, to), to: Math.max(from, to), text: m[3].trim() })
      next = Math.max(from, to) + 1
    } else {
      rows.push({ from: next, to: next, text: line.replace(/^[-*]\s+/, '') })
      next++
    }
  }
  return rows
}

/** Die to roll: the highest number covered. */
export const dieFor = (rows: Row[]) => rows.reduce((m, r) => Math.max(m, r.to), 0)

export interface TableResult { table: string; roll: number; die: number; text: string; nested: TableResult[] }

/** Roll on a table. `lookup` finds other tables by name for {Name} references (case-insensitive, depth-limited). */
export function rollTable(name: string, text: string, lookup: (name: string) => string | undefined, depth = 0): TableResult {
  const rows = parseRows(text)
  const die = dieFor(rows)
  if (!die) return { table: name, roll: 0, die: 0, text: '(empty table)', nested: [] }
  const n = roll(die).total
  const row = rows.find(r => n >= r.from && n <= r.to)
  const nested: TableResult[] = []
  const out = (row?.text ?? '(no entry for this number)').replace(/\{([^{}]+)\}/g, (_all, inner: string) => {
    const dice = inner.trim().match(/^(\d*)d(\d+)\s*([+-]\s*\d+)?$/i)
    if (dice) return String(roll(Number(dice[2]), Number(dice[1] || 1), dice[3] ? Number(dice[3].replace(/\s/g, '')) : 0).total)
    const other = lookup(inner.trim())
    if (other === undefined || depth >= 3) return inner
    const r = rollTable(inner.trim(), other, lookup, depth + 1)
    nested.push(r)
    return r.text
  })
  return { table: name, roll: n, die, text: out, nested }
}

/** Starter tables, original content, so the feature is useful on day one. Editable and deletable. */
export const STARTER_TABLES: { name: string; rows: string }[] = [
  { name: 'NPC first names', rows: 'Aldric\nBrenna\nCoren\nDalia\nEsk\nFenna\nGarrow\nHollis\nIlsa\nJory\nKestrel\nLorne\nMira\nNoll\nOdette\nPell\nQuill\nRowan\nSable\nTamsin' },
  { name: 'NPC family names', rows: 'Ashdown\nBrightwater\nColdbrook\nDunmore\nEverhart\nFallow\nGreaves\nHawthorne\nIronside\nKettle\nLarkspur\nMarrow' },
  { name: 'NPC names', rows: '{NPC first names} {NPC family names}' },
  { name: 'NPC roles', rows: 'innkeeper\nblacksmith\ntemple acolyte\ncaravan guard\nfence\nferryman\nherbalist\nretired soldier\nscribe\ntax collector\nhunter\nstreet performer' },
  { name: 'NPC looks', rows: 'missing two fingers\nfreckled and sunburnt\nimmaculate clothes, muddy boots\nbraided grey beard\nink-stained hands\na fresh scar across the cheek\nalways wrapped in a too-big cloak\nbright green eyes, never blinks enough' },
  { name: 'NPC voices', rows: 'talks too fast\nwhispers everything\nlaughs at their own jokes\nanswers questions with questions\nformal, clipped sentences\nhums between sentences\ncalls everyone "friend"\nloses the thread mid-sentence' },
  { name: 'NPC wants', rows: 'to pay off a debt before winter\nrevenge on a former partner\nto be left alone\nnews of a missing sibling\nto leave town without being noticed\nrespect from the local guild\na cure for a sick child\nto sell something they should not have' },
  { name: 'NPC secrets', rows: 'is an informant for the local lord\nstole their name from a dead man\nowes money to the wrong people\nknows the way into the old crypt\nis not who the party thinks\nburied something under the floor' },
  { name: 'Tavern names', rows: 'The {Tavern words} and {Tavern words}\nThe Drowned {Tavern things}\nThe Last {Tavern things}\nThe Crooked {Tavern things}' },
  { name: 'Tavern words', rows: 'Lantern\nCrow\nAnchor\nThistle\nHound\nKettle\nCrown\nBarrel' },
  { name: 'Tavern things', rows: 'Rat\nCandle\nGoose\nMile\nFiddle\nPenny' },
  { name: 'Weather (d6)', rows: '1-2: Clear and cold\n3: Fog until midday\n4: Steady rain\n5: Wind from the hills, gusting\n6: Storm by nightfall' },
  { name: 'Pocket contents', rows: '{1d6} copper pieces\na crumpled love letter\na carved bone die\n{2d4} silver pieces and a button\na key with no lock\na half-eaten apple' },
]
