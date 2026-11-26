import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Dices, Plus, Search, Trash2 } from 'lucide-react'
import { db, type RandomTable } from '../db'
import { dieFor, parseRows, rollTable, STARTER_TABLES, type TableResult } from '../lib/tables'
import { useMedia } from '../lib/hooks'
import { useUI } from '../state'
import { ConfirmDelete } from './ConfirmDelete'
import { DraftInput, DraftTextarea } from './DraftInput'

/** Seed the starter tables once per device. */
async function seedTables() {
  try { if (localStorage.getItem('throne.tablesSeeded')) return } catch { /* ignore */ }
  if ((await db.randomTables.count()) === 0) {
    const now = Date.now()
    await db.randomTables.bulkAdd(STARTER_TABLES.map((t, i) => ({ ...t, createdAt: now + i, updatedAt: now + i })))
  }
  try { localStorage.setItem('throne.tablesSeeded', '1') } catch { /* ignore */ }
}

export function useTableLookup() {
  const tables = useLiveQuery(() => db.randomTables.toArray(), [], [] as RandomTable[])
  return useMemo(() => {
    const m = new Map(tables.map(t => [t.name.toLowerCase(), t.rows]))
    return (name: string) => m.get(name.toLowerCase())
  }, [tables])
}

/** Roll on a table, log it to the game log and flash the toast. */
export async function rollAndRecord(t: Pick<RandomTable, 'name' | 'rows'>, lookup: (n: string) => string | undefined): Promise<TableResult> {
  const r = rollTable(t.name, t.rows, lookup)
  const rec = { label: `${t.name}: ${r.text}`, formula: `1d${r.die}`, dice: [r.roll], modifier: 0, total: r.roll, mode: 'normal' as const }
  await db.rolls.add({ at: Date.now(), ...rec, physical: false })
  useUI.getState().showRoll(rec)
  return r
}

export function TablesPanel() {
  const tables = useLiveQuery(() => db.randomTables.orderBy('name').toArray(), [], [] as RandomTable[])
  const [sel, setSel] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<TableResult[]>([])
  const [del, setDel] = useState<RandomTable | null>(null)
  const wide = useMedia('(min-width: 900px)')
  const lookup = useTableLookup()
  useEffect(() => { seedTables() }, [])
  const cur = tables.find(t => t.id === sel)
  useEffect(() => { setResults([]) }, [sel])
  const shown = tables.filter(t => !q.trim() || t.name.toLowerCase().includes(q.trim().toLowerCase()))

  async function create() {
    const now = Date.now()
    let name = 'New table', i = 2
    while (tables.some(t => t.name.toLowerCase() === name.toLowerCase())) name = `New table ${i++}`
    const id = await db.randomTables.add({ name, rows: '', createdAt: now, updatedAt: now })
    setSel(id)
  }
  async function go(t: RandomTable) { const r = await rollAndRecord(t, lookup); setResults(prev => [r, ...prev].slice(0, 8)) }

  const list = (
    <div className="tables-list">
      <div className="search-row"><Search size={16} aria-hidden="true" />
        <input className="field" type="search" placeholder="Search tables" value={q} onChange={e => setQ(e.target.value)} aria-label="Search tables" /></div>
      {shown.map(t => {
        const die = dieFor(parseRows(t.rows))
        return (
          <div key={t.id} className={`table-row ${sel === t.id ? 'active' : ''}`}>
            <button className="tr-name" onClick={() => setSel(t.id)}><b>{t.name}</b><small className="muted tnum">{die ? `d${die}` : 'empty'}</small></button>
            <button className="btn sm" onClick={() => go(t)} disabled={!die} aria-label={`Roll on ${t.name}`}><Dices size={14} /> Roll</button>
          </div>
        )
      })}
      {shown.length === 0 && <p className="muted small">{tables.length ? 'No tables match.' : 'No tables yet.'}</p>}
      <button className="btn sm" onClick={create} style={{ marginTop: 10 }}><Plus size={14} /> New table</button>
    </div>
  )

  const editor = cur && (
    <div className="table-editor">
      {!wide && <button className="btn ghost sm back" onClick={() => setSel(null)}><ArrowLeft size={14} /> Tables</button>}
      <div className="te-head">
        <DraftInput className="title-input" value={cur.name} aria-label="Table name" onValue={v => db.randomTables.update(cur.id, { name: v, updatedAt: Date.now() })} />
        <button className="btn primary" onClick={() => go(cur)} disabled={!dieFor(parseRows(cur.rows))}><Dices size={16} /> Roll d{dieFor(parseRows(cur.rows)) || '–'}</button>
      </div>
      {results.length > 0 && (
        <ol className="table-results" aria-live="polite">
          {results.map((r, i) => (
            <li key={i} className={i === 0 ? 'latest' : ''}><span className="tnum roll-total">{r.roll}</span><span className="grow">{r.text}</span></li>
          ))}
        </ol>
      )}
      <label className="lab" htmlFor="te-rows">Entries, one per line</label>
      <DraftTextarea id="te-rows" className="field area mono" rows={12} value={cur.rows}
        placeholder={'1-2: Clear skies\n3: Fog\n4-6: Rain\n\nor just one entry per line'}
        onValue={v => db.randomTables.update(cur.id, { rows: v, updatedAt: Date.now() })} />
      <p className="muted small">Ranges like <code>1-3:</code> are optional. <code>{'{2d6}'}</code> rolls dice inside an entry, <code>{'{Table name}'}</code> rolls on another table. Lines starting with # are ignored.</p>
      <div className="foot"><span className="muted small tnum">{parseRows(cur.rows).length} entries</span>
        <button className="btn ghost sm" onClick={() => setDel(cur)}><Trash2 size={14} /> Delete table</button></div>
    </div>
  )

  return (
    <>
      {wide ? (
        <div className="tables-layout">
          <section className="panel">{list}</section>
          <section className="panel">{editor ?? <div className="empty"><h2>Pick a table</h2><p>Roll from the list, or open a table to edit its entries.</p></div>}</section>
        </div>
      ) : <section className="panel">{editor ?? list}</section>}
      {del && <ConfirmDelete what={`the table “${del.name}”`} onCancel={() => setDel(null)} onConfirm={async () => { await db.randomTables.delete(del.id); setDel(null); setSel(null) }} />}
    </>
  )
}
