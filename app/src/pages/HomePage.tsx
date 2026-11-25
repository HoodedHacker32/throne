import { Link, Navigate } from 'react-router-dom'
import { Dices, FileUp, NotebookPen, UserPlus } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useUI } from '../state'
import { ago, useCharacters, useNotes } from '../lib/hooks'
import { CharacterCard } from '../components/CharacterCard'

export function HomePage() {
  const mode = useUI(s => s.mode)
  const chars = useCharacters()
  const notes = useNotes()
  const rolls = useLiveQuery(() => db.rolls.orderBy('at').reverse().limit(5).toArray(), [], [])
  if (mode === 'dm') return <Navigate to="/dm" replace />

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Your table</h1><p>Characters, notes and rolls for this campaign.</p></div>
        <div className="actions-row">
          <button className="btn" onClick={() => useUI.getState().setCapture(true)}><NotebookPen size={16} /> Quick note</button>
          <Link className="btn primary" to="/characters/new"><UserPlus size={16} /> New character</Link>
        </div>
      </div>

      <section className="panel" aria-labelledby="party-h">
        <div className="panel-h"><h2 id="party-h">Party</h2><Link to="/characters" className="btn ghost sm">All characters</Link></div>
        {chars.length === 0 ? (
          <div className="empty">
            <h3>No characters yet</h3>
            <p>Build one step by step, write one straight onto a sheet, or import a D&amp;D Beyond PDF.</p>
            <div className="actions-row center">
              <Link className="btn primary" to="/characters/new">Build a character</Link>
              <Link className="btn" to="/characters/import"><FileUp size={16} /> Import PDF</Link>
            </div>
          </div>
        ) : (
          <div className="grid roster">{chars.map(c => <CharacterCard key={c.id} c={c} />)}</div>
        )}
      </section>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <section className="panel" aria-labelledby="notes-h">
          <div className="panel-h"><h2 id="notes-h">Recent notes</h2><Link to="/notes" className="btn ghost sm">Open notes</Link></div>
          {notes.length === 0 && <p className="muted">Nothing written yet.</p>}
          {notes.slice(0, 6).map(n => (
            <Link key={n.id} to={`/notes/${n.id}`} className="row link-row">
              <span className="kind">{n.kind}</span>
              <span className="grow ellipsis">{n.title}</span>
              <small className="muted">{ago(n.updatedAt)}</small>
            </Link>
          ))}
        </section>
        <section className="panel" aria-labelledby="rolls-h">
          <div className="panel-h"><h2 id="rolls-h">Last rolls</h2><Link to="/dice" className="btn ghost sm"><Dices size={14} /> Dice</Link></div>
          {rolls.length === 0 && <p className="muted">Roll from a sheet or the dice tray and it shows here.</p>}
          {rolls.map(r => (
            <div key={r.id} className="row">
              <span className="roll-total">{r.total}</span>
              <span className="grow ellipsis">{r.label || r.formula}</span>
              <small className="muted">{r.physical ? 'physical' : r.formula}</small>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
