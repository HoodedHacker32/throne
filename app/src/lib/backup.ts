/** Campaign export/import as a zip of plain files: notes as markdown, characters as JSON, library files as-is,
 *  plus campaign.json with everything needed to restore. Import always creates a new campaign (never overwrites). */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { embedKey } from './markdown'
import { db, type Campaign, type Character, type Combatant, type LibraryItem, type Note } from '../db'

const FORMAT = 'throne-campaign'
const VERSION = 1
const safe = (s: string) => (s.replace(/[\\/:*?"<>|#^[\]]+/g, ' ').replace(/\s+/g, ' ').trim() || 'untitled').slice(0, 80)
const ext = (mime: string, name: string) => name.match(/\.[a-z0-9]+$/i)?.[0] ?? ({ 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'application/pdf': '.pdf' } as Record<string, string>)[mime] ?? ''

interface Manifest {
  format: typeof FORMAT; version: number; exportedAt: string
  campaign: Omit<Campaign, 'id'>
  notes: (Omit<Note, 'campaignId'> & { file: string })[]
  characters: (Character & { file: string })[]
  combatants: Omit<Combatant, 'campaignId'>[]
  library: (Omit<LibraryItem, 'campaignId' | 'blob'> & { file: string })[]
}

function unique(used: Set<string>, base: string, e: string) {
  let name = `${base}${e}`, i = 2
  while (used.has(name.toLowerCase())) name = `${base} ${i++}${e}`
  used.add(name.toLowerCase())
  return name
}

export async function exportCampaign(campaignId: number): Promise<{ blob: Blob; filename: string }> {
  const campaign = await db.campaigns.get(campaignId)
  if (!campaign) throw new Error('Campaign not found')
  const notes = await db.notes.where('campaignId').equals(campaignId).toArray()
  const characters = (await db.characters.toArray()).filter(c => c.campaignId === campaignId || c.campaignId === undefined)
  const combatants = await db.combatants.where('campaignId').equals(campaignId).toArray()
  const library = await db.library.where('campaignId').equals(campaignId).toArray()

  const files: Zippable = {}
  const used = new Set<string>()
  const m: Manifest = {
    format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(),
    campaign: { name: campaign.name, createdAt: campaign.createdAt }, notes: [], characters: [], combatants: [], library: [],
  }
  const libFile = new Map<string, string>()
  for (const l of library) {
    const file = unique(used, `library/${safe(l.name)}`, ext(l.mime, l.name))
    files[file] = [new Uint8Array(await l.blob.arrayBuffer()), { level: 0 }]
    const { campaignId: _c, blob: _b, ...rest } = l; void _c; void _b
    m.library.push({ ...rest, file })
    libFile.set(embedKey(l.name), file.replace(/^library\//, ''))
  }
  for (const n of notes) {
    const dir = (n.folder ?? '').split('/').map(x => x.trim()).filter(Boolean).map(safe).join('/')
    const file = unique(used, `notes/${dir ? `${dir}/` : ''}${safe(n.title)}`, '.md')
    const front = ['---', `kind: ${n.kind}`, n.tags.length ? `tags: [${n.tags.join(', ')}]` : '', `updated: ${new Date(n.updatedAt).toISOString()}`, '---', ''].filter(l => l !== '').join('\n')
    // ![[name]] -> ![[name.png]] so Obsidian finds the exported file.
    const body = n.body.replace(/!\[\[([^[\]\n|]+)((?:\|\d+)?)\]\]/g, (all, name: string, w: string) => {
      const f = libFile.get(embedKey(name)); return f ? `![[${f}${w}]]` : all
    })
    files[file] = strToU8(`${front}\n${body}`)
    const { campaignId: _c, ...rest } = n; void _c
    m.notes.push({ ...rest, file })
  }
  for (const c of characters) {
    const file = unique(used, `characters/${safe(c.name)}`, '.json')
    files[file] = strToU8(JSON.stringify(c, null, 2))
    m.characters.push({ ...c, file })
  }
  for (const c of combatants) { const { campaignId: _c, ...rest } = c; void _c; m.combatants.push(rest) }
  files['campaign.json'] = strToU8(JSON.stringify(m, null, 2))
  files['README.txt'] = strToU8(`Throne campaign export: ${campaign.name}\nUnofficial D&D Campaign Manager. Not affiliated with Wizards of the Coast.\n\nnotes/       your notes as markdown (open in any editor, Obsidian works)\ncharacters/  character sheets as JSON\nlibrary/     maps, images and handouts\ncampaign.json  everything Throne needs to import this again\n`)
  const zipped = zipSync(files, { level: 6 })
  const date = new Date().toISOString().slice(0, 10)
  return { blob: new Blob([zipped.slice().buffer], { type: 'application/zip' }), filename: `${safe(campaign.name)} ${date}.throne.zip` }
}

/** Import a Throne zip as a NEW campaign. Returns the new campaign id. */
export async function importCampaign(file: File): Promise<number> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const raw = entries['campaign.json']
  if (!raw) throw new Error('This zip has no campaign.json, so it is not a Throne campaign export.')
  const m = JSON.parse(strFromU8(raw)) as Manifest
  if (m.format !== FORMAT) throw new Error('This file is not a Throne campaign export.')
  if (m.version > VERSION) throw new Error('This export comes from a newer version of Throne. Update the app and try again.')

  return db.transaction('rw', [db.campaigns, db.notes, db.characters, db.combatants, db.library], async () => {
    const existing = new Set((await db.campaigns.toArray()).map(c => c.name.toLowerCase()))
    let name = m.campaign.name
    if (existing.has(name.toLowerCase())) name = `${name} (imported)`
    const campaignId = await db.campaigns.add({ name, createdAt: m.campaign.createdAt ?? Date.now() })

    const charIds = new Map<number, number>()
    for (const c of m.characters) {
      const { id: oldId, file: _f, ...rest } = c; void _f
      charIds.set(oldId, await db.characters.add({ ...rest, campaignId }))
    }
    for (const n of m.notes) {
      const { id: _id, file, ...rest } = n; void _id
      // Prefer the markdown file so edits made outside Throne come back in.
      const md = entries[file] ? strFromU8(entries[file]).replace(/^---\n[\s\S]*?\n---\n\n?/, '') : rest.body
      await db.notes.add({ ...rest, body: md, campaignId, characterId: rest.characterId !== undefined ? charIds.get(rest.characterId) : undefined })
    }
    for (const c of m.combatants) {
      const { id: _id, ...rest } = c; void _id
      await db.combatants.add({ ...rest, campaignId, characterId: rest.characterId !== undefined ? charIds.get(rest.characterId) : undefined })
    }
    for (const l of m.library) {
      const bytes = entries[l.file]
      if (!bytes) continue
      const { id: _id, file: _f, ...rest } = l; void _id; void _f
      await db.library.add({ ...rest, campaignId, blob: new Blob([bytes.slice().buffer], { type: rest.mime }) })
    }
    return campaignId
  })
}

/** Trigger a browser download (iOS Safari opens the share sheet). */
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
