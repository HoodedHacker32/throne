import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Character } from '../db'
import { Portrait } from './Portrait'
import { classLine } from '../lib/character'

export function CharacterCard({ c, actions }: { c: Character; actions?: ReactNode }) {
  const pct = c.hpMax ? Math.max(0, Math.min(100, (c.hpCurrent / c.hpMax) * 100)) : 0
  const body = (
    <>
      <Portrait c={c} />
      <div className="nm">{c.name}</div>
      <small>Level {c.level} {[c.species, classLine(c)].filter(Boolean).join(' ') || 'adventurer'}</small>
      <div className="hpbar">
        <div className={`bar ${pct <= 33 ? 'low' : ''}`} aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
        <small className="tnum">HP {c.hpCurrent} / {c.hpMax}{c.hpTemp ? ` (+${c.hpTemp})` : ''} · AC {c.ac}</small>
      </div>
    </>
  )
  if (!actions) return <Link to={`/characters/${c.id}`} className="rcard">{body}</Link>
  return (
    <div className="rcard has-actions">
      <Link to={`/characters/${c.id}`} className="rcard-main">{body}</Link>
      <div className="rcard-actions">{actions}</div>
    </div>
  )
}
