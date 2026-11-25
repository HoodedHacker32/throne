import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search } from 'lucide-react'
import { db } from '../db'
import { useUI } from '../state'
import { useCharacters, useNotes } from '../lib/hooks'
import { check } from '../lib/roller'
import { useLiveQuery } from 'dexie-react-hooks'
import { rollAndRecord, useTableLookup } from './TablesPanel'
import { classLine } from '../lib/character'

interface Cmd { id: string; label: string; hint: string; run: () => void }

/** Ctrl/Cmd+K quick switcher: jump to any page, character or note, or run a quick action. */
export function Palette() {
  const { paletteOpen: open, setPalette, setMode, campaignId } = useUI()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const chars = useCharacters()
  const notes = useNotes()
  const tables = useLiveQuery(() => db.randomTables.orderBy('name').toArray(), [], [])
  const lookup = useTableLookup()

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault(); setPalette(!useUI.getState().paletteOpen)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [setPalette])
  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => input.current?.focus(), 0) } }, [open])

  const go = (path: string, mode?: 'player' | 'dm') => () => { if (mode) setMode(mode); navigate(path) }
  const all: Cmd[] = useMemo(() => [
    { id: 'p-home', label: 'Home', hint: 'Player', run: go('/', 'player') },
    { id: 'p-chars', label: 'Characters', hint: 'Player', run: go('/characters', 'player') },
    { id: 'p-notes', label: 'Notes', hint: 'Page', run: go('/notes') },
    { id: 'p-dice', label: 'Dice', hint: 'Player', run: go('/dice', 'player') },
    { id: 'd-camp', label: 'Campaign', hint: 'DM', run: go('/dm', 'dm') },
    { id: 'd-combat', label: 'Combat', hint: 'DM', run: go('/dm/combat', 'dm') },
    { id: 'd-lib', label: 'Library', hint: 'DM', run: go('/dm/library', 'dm') },
    { id: 'a-note', label: 'New note', hint: 'Action', run: async () => {
      if (!campaignId) return
      const now = Date.now()
      const id = await db.notes.add({ campaignId, title: 'Untitled note', body: '# Untitled note\n\n', kind: 'note', tags: [], createdAt: now, updatedAt: now })
      navigate(`/notes/${id}`)
    } },
    { id: 'a-capture', label: 'Quick note (session log)', hint: 'Action', run: () => useUI.getState().setCapture(true) },
    { id: 'a-sync', label: 'Sync: sign in or sync now', hint: 'Account', run: () => useUI.getState().setSyncOpen(true) },
    { id: 'a-welcome', label: 'Show the welcome guide', hint: 'Help', run: () => useUI.getState().setWelcome(true) },
    { id: 'a-char', label: 'New character (builder)', hint: 'Action', run: go('/characters/new', 'player') },
    { id: 'a-import', label: 'Import D&D Beyond PDF', hint: 'Action', run: go('/characters/import', 'player') },
    { id: 'a-d20', label: 'Roll a d20', hint: 'Action', run: () => check('d20', 0) },
    ...chars.map(c => ({ id: `c${c.id}`, label: c.name, hint: `Character · ${classLine(c) || 'sheet'}`, run: go(`/characters/${c.id}`) })),
    ...tables.map(t => ({ id: `t${t.id}`, label: `Roll: ${t.name}`, hint: 'Random table', run: () => { rollAndRecord(t, lookup) } })),
    ...notes.map(n => ({ id: `n${n.id}`, label: n.title || 'Untitled', hint: `Note · ${n.kind}`, run: go(`/notes/${n.id}`) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [chars, notes, campaignId, tables, lookup])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return all.slice(0, 14)
    return all.map(c => {
      const l = c.label.toLowerCase()
      const score = l.startsWith(s) ? 0 : l.includes(s) ? 1 : c.hint.toLowerCase().includes(s) ? 2 : 9
      return { c, score }
    }).filter(x => x.score < 9).sort((a, b) => a.score - b.score).slice(0, 14).map(x => x.c)
  }, [all, q])

  if (!open) return null
  const run = (c?: Cmd) => { if (!c) return; setPalette(false); c.run() }
  return (
    <div className="palette-scrim" onMouseDown={() => setPalette(false)}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Quick switcher" onMouseDown={e => e.stopPropagation()}>
        <div className="palette-in">
          <Search size={18} aria-hidden="true" />
          <input ref={input} value={q} placeholder="Jump to a page, character or note…" aria-label="Search"
            onChange={e => { setQ(e.target.value); setSel(0) }}
            onKeyDown={e => {
              if (e.key === 'Escape') setPalette(false)
              else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(list.length - 1, sel + 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(0, sel - 1)) }
              else if (e.key === 'Enter') run(list[sel])
            }} />
          <kbd>Esc</kbd>
        </div>
        <ul className="palette-list" role="listbox">
          {list.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => run(c)}>
              <span className="grow">{c.label}</span><small>{c.hint}</small>
              {i === sel && <CornerDownLeft size={14} aria-hidden="true" />}
            </li>
          ))}
          {list.length === 0 && <li className="muted">Nothing matches “{q}”.</li>}
        </ul>
      </div>
    </div>
  )
}
