import { Dices } from 'lucide-react'
import { db, type Note, type NpcCard } from '../db'
import { rollTable } from '../lib/tables'
import { useTableLookup } from './TablesPanel'
import { DraftInput } from './DraftInput'

const FIELDS: { k: keyof NpcCard; label: string; table?: string; ph: string }[] = [
  { k: 'role', label: 'Role', table: 'NPC roles', ph: 'innkeeper, fence, rival…' },
  { k: 'species', label: 'Species', ph: 'Human, Dwarf…' },
  { k: 'look', label: 'Look', table: 'NPC looks', ph: 'one detail players will remember' },
  { k: 'voice', label: 'Voice', table: 'NPC voices', ph: 'how they talk' },
  { k: 'wants', label: 'Wants', table: 'NPC wants', ph: 'what they are after' },
  { k: 'secret', label: 'Secret', table: 'NPC secrets', ph: 'DM only' },
]

/** Quick-reference card for an NPC: the things you need mid-conversation. Fields can be rolled from tables. */
export function NpcCardEditor({ note }: { note: Note }) {
  const card = note.card ?? {}
  const lookup = useTableLookup()
  const set = (patch: NpcCard) => db.notes.update(note.id, { card: { ...card, ...patch }, updatedAt: Date.now() })
  return (
    <section className="npc-card" aria-label="NPC card">
      {FIELDS.map(f => {
        const rows = f.table ? lookup(f.table) : undefined
        return (
          <label key={f.k} className={`npc-f ${f.k === 'secret' ? 'secret' : ''}`}>
            <span className="npc-l">{f.label}</span>
            <span className="npc-v">
              <DraftInput className="field bare" value={card[f.k] ?? ''} placeholder={f.ph} onValue={v => set({ [f.k]: v })} />
              {rows !== undefined && <button type="button" className="npc-roll" title={`Roll on ${f.table}`} aria-label={`Roll ${f.label.toLowerCase()} from ${f.table}`}
                onClick={() => set({ [f.k]: rollTable(f.table!, rows, lookup).text })}><Dices size={14} /></button>}
            </span>
          </label>
        )
      })}
    </section>
  )
}

/** Build a random NPC from the starter tables (or whatever tables with those names exist). */
export function randomNpc(lookup: (n: string) => string | undefined): { title: string; card: NpcCard } {
  const r = (t: string) => { const rows = lookup(t); return rows === undefined ? '' : rollTable(t, rows, lookup).text }
  return {
    title: r('NPC names') || 'New NPC',
    card: { role: r('NPC roles'), look: r('NPC looks'), voice: r('NPC voices'), wants: r('NPC wants'), secret: r('NPC secrets') },
  }
}
