import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Dices, ScrollText, Trash2, X } from 'lucide-react'
import { db } from '../db'
import { DICE, describe, rollPool } from '../lib/dice'
import { record } from '../lib/roller'
import { fmt } from '../lib/rules'
import { useUI } from '../state'
import { Drawer } from './Drawer'
import { DiceSettings } from './DiceSettings'

/** Floating d20 on every screen: build a pool of dice, add a modifier, roll. Plus the game log. */
export function DiceDock() {
  const { dockOpen: open, setDock, logOpen, setLog, rollMode, setRollMode } = useUI()
  const [pool, setPool] = useState<Record<number, number>>({})
  const [modifier, setModifier] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const count = Object.values(pool).reduce((a, b) => a + b, 0)
  const singleD20 = count === 1 && pool[20] === 1

  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setDock(false)
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setDock(false) }
    window.addEventListener('keydown', k); window.addEventListener('mousedown', click)
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('mousedown', click) }
  }, [open, setDock])

  const add = (d: number) => setPool(p => ({ ...p, [d]: Math.min(20, (p[d] ?? 0) + 1) }))
  const sub = (d: number) => setPool(p => ({ ...p, [d]: Math.max(0, (p[d] ?? 0) - 1) }))
  const formula = Object.entries(pool).filter(([, n]) => n).sort((a, b) => Number(b[0]) - Number(a[0]))
  function go() {
    if (!count) return
    record(rollPool(pool, modifier, singleD20 ? rollMode : 'normal', 'Custom roll'))
  }

  return (
    <>
      <div className={`dock ${open ? 'open' : ''}`} ref={ref}>
        {open && (
          <div className="dock-pop" role="dialog" aria-label="Roll dice">
            <div className="dock-h">
              <h2>Roll dice</h2>
              <button className="btn ghost sm" onClick={() => setLog(true)}><ScrollText size={14} /> Game log</button>
              <button className="icon-btn ghostly" aria-label="Close" onClick={() => setDock(false)}><X size={16} /></button>
            </div>
            <div className="dock-dice">
              {[20, 12, 100, 10, 8, 6, 4].filter(d => (DICE as readonly number[]).includes(d)).map(d => (
                <button key={d} className={`dock-die ${pool[d] ? 'on' : ''}`} onClick={() => add(d)} aria-label={`Add a d${d}${pool[d] ? `, ${pool[d]} in pool` : ''}`}>
                  <span className="dd-d">d</span>{d}
                  {pool[d] ? <span className="badge tnum">{pool[d]}</span> : null}
                </button>
              ))}
            </div>
            <div className="dock-pool" aria-live="polite">
              {formula.length === 0 ? <span className="muted small">Tap dice to add them to the pool.</span>
                : formula.map(([d, n]) => (
                  <button key={d} className="pool-chip" onClick={() => sub(Number(d))} aria-label={`Remove one d${d}`}>{n}d{d} <X size={10} /></button>
                ))}
            </div>
            <div className="dock-row">
              <div className="stepper" role="group" aria-label="Modifier">
                <button className="btn sm" aria-label="Lower modifier" onClick={() => setModifier(modifier - 1)}>−</button>
                <span className="tnum small">mod <b>{fmt(modifier)}</b></span>
                <button className="btn sm" aria-label="Raise modifier" onClick={() => setModifier(modifier + 1)}>+</button>
              </div>
              <div className="seg" role="group" aria-label="Advantage">
                {(['disadvantage', 'normal', 'advantage'] as const).map(m => (
                  <button key={m} aria-pressed={rollMode === m} onClick={() => setRollMode(m)} title={singleD20 || m === 'normal' ? undefined : 'Applies to a single d20'}>
                    {m === 'normal' ? 'Norm' : m === 'advantage' ? 'Adv' : 'Dis'}</button>
                ))}
              </div>
            </div>
            <DiceSettings compact />
            <div className="dock-foot">
              <button className="btn ghost" onClick={() => { setPool({}); setModifier(0) }} disabled={!count && !modifier}>Reset</button>
              <button className="btn primary grow-btn" onClick={go} disabled={!count}>Roll {formula.map(([d, n]) => `${n}d${d}`).join(' + ')}{modifier ? ` ${fmt(modifier)}` : ''}</button>
            </div>
          </div>
        )}
        <button className="dock-fab" onClick={() => setDock(!open)} aria-expanded={open} aria-label="Roll dice">
          <Dices size={24} />
        </button>
      </div>
      {logOpen && <GameLog onClose={() => setLog(false)} />}
    </>
  )
}

export function GameLog({ onClose }: { onClose: () => void }) {
  const rolls = useLiveQuery(() => db.rolls.orderBy('at').reverse().limit(100).toArray(), [], [])
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [rolls.length])
  const list = rolls.slice().reverse()
  return (
    <Drawer title="Game log" onClose={onClose}>
      {list.length === 0 && <p className="muted">Every roll you make shows here, newest at the bottom.</p>}
      <ol className="log">
        {list.map(r => (
          <li key={r.id} className={r.kept === 20 || (r.dice.length === 1 && r.formula.startsWith('1d20') && r.dice[0] === 20) ? 'crit' : ''}>
            <div className="log-top"><b>{r.who || 'Table'}</b><time className="muted small">{new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
            <div className="log-mid">
              <span className="log-label">{r.label || 'Roll'}{r.mode !== 'normal' ? ` · ${r.mode}` : ''}{r.physical ? ' · physical' : ''}</span>
              <span className="log-total tnum">{r.total}</span>
            </div>
            <div className="log-f tnum">{r.physical ? 'physical' : r.formula}: {describe(r)}</div>
          </li>
        ))}
      </ol>
      <div ref={end} />
      {list.length > 0 && <div className="foot"><span /><button className="btn ghost sm" onClick={() => confirm('Clear the game log?') && db.rolls.clear()}><Trash2 size={14} /> Clear log</button></div>}
    </Drawer>
  )
}
