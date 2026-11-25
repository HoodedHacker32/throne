import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { db } from '../db'
import { DICE, describe, manualRoll, roll } from '../lib/dice'
import { record } from '../lib/roller'
import { fmt } from '../lib/rules'
import { useUI } from '../state'
import { RollModeBar } from './SheetPage'
import { DiceSettings } from '../components/DiceSettings'

export function DicePage() {
  const [count, setCount] = useState(1)
  const [modifier, setModifier] = useState(0)
  const [label, setLabel] = useState('')
  const [phys, setPhys] = useState('')
  const [physMod, setPhysMod] = useState('')
  const rollMode = useUI(s => s.rollMode)
  const last = useUI(s => s.lastRoll)
  const history = useLiveQuery(() => db.rolls.orderBy('at').reverse().limit(50).toArray(), [], [])

  const go = (sides: number) => record(roll(sides, count, modifier, sides === 20 && count === 1 ? rollMode : 'normal', label.trim()))
  function physical() {
    const v = Math.floor(Number(phys))
    if (!v) return
    record(manualRoll(v, Math.floor(Number(physMod) || 0), label.trim() || 'Physical roll'))
    setPhys('')
  }
  const r = last?.result
  const nat = r && (r.formula.startsWith('1d20') || r.physical) ? (r.kept ?? r.dice[0]) : undefined

  return (
    <div className="page">
      <div className="page-head"><div><h1>Dice</h1><p>Roll here, or type in what your real dice showed. Both go in the history.</p></div></div>
      <div className="grid cols-2 dice-layout">
        <section className="panel">
          <div className="panel-h"><h2>Tray</h2><DiceSettings compact /></div>
          <div className="tray-opts">
            <div className="stepper" role="group" aria-label="Number of dice">
              <button className="btn sm" aria-label="Fewer dice" onClick={() => setCount(Math.max(1, count - 1))}>−</button>
              <span className="tnum"><b>{count}</b> {count === 1 ? 'die' : 'dice'}</span>
              <button className="btn sm" aria-label="More dice" onClick={() => setCount(Math.min(20, count + 1))}>+</button>
            </div>
            <div className="stepper" role="group" aria-label="Modifier">
              <button className="btn sm" aria-label="Lower modifier" onClick={() => setModifier(modifier - 1)}>−</button>
              <span className="tnum">mod <b>{fmt(modifier)}</b></span>
              <button className="btn sm" aria-label="Raise modifier" onClick={() => setModifier(modifier + 1)}>+</button>
            </div>
          </div>
          <input className="field" placeholder="Label (optional), e.g. Stealth" value={label} onChange={e => setLabel(e.target.value)} aria-label="Roll label" />
          <RollModeBar />
          <div className="dice-grid">
            {DICE.map(d => (
              <button key={d} className="die" onClick={() => go(d)} aria-label={`Roll ${count}d${d}${modifier ? fmt(modifier) : ''}`}>
                <b><span className="die-d">d</span>{d}</b><small className="tnum">{count > 1 ? `${count}d${d}` : ' '}</small>
              </button>
            ))}
          </div>
          <div className={`result ${nat === 20 ? 'crit' : nat === 1 ? 'fumble' : ''}`} aria-live="polite">
            {r ? (<>
              <div className="total tnum">{r.total}</div>
              <div className="lbl2">{r.label || r.formula} · [{r.dice.join(', ')}]{r.modifier ? ` ${fmt(r.modifier)}` : ''}{r.mode !== 'normal' ? ` · ${r.mode}` : ''}</div>
            </>) : <div className="lbl2">Pick a die.</div>}
          </div>
        </section>

        <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
          <section className="panel">
            <div className="panel-h"><h2>Physical roll</h2></div>
            <p className="muted small">Rolled real dice? Enter the number shown and any modifier.</p>
            <div className="add-row">
              <input className="field" inputMode="numeric" placeholder="Die shows" value={phys} onChange={e => setPhys(e.target.value.replace(/\D/g, ''))} aria-label="Die result" />
              <input className="field" inputMode="numeric" placeholder="Mod" value={physMod} onChange={e => setPhysMod(e.target.value.replace(/[^\d-]/g, ''))} aria-label="Modifier" style={{ maxWidth: 90 }} />
              <button className="btn primary" onClick={physical} disabled={!phys}>Log it</button>
            </div>
          </section>
          <section className="panel">
            <div className="panel-h"><h2>History</h2>
              {history.length > 0 && <button className="btn ghost sm" onClick={() => confirm('Clear all roll history?') && db.rolls.clear()}><Trash2 size={14} /> Clear</button>}
            </div>
            {history.length === 0 && <p className="muted">No rolls yet.</p>}
            <div className="history">
              {history.map(h => (
                <div key={h.id} className="row">
                  <span className="roll-total">{h.total}</span>
                  <span className="grow"><span className="ellipsis">{h.who ? <b>{h.who.replace(/^Sample:\s*/, '')} · </b> : null}{h.label || h.formula}</span>
                    <small className="muted block tnum">{h.physical ? 'physical' : h.formula}{h.mode !== 'normal' ? ` ${h.mode}` : ''}: {describe(h)}</small></span>
                  <small className="muted">{new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
