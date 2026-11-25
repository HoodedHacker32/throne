import { useEffect } from 'react'
import { useUI } from '../state'
import { describe } from '../lib/dice'

export function RollToast() {
  const last = useUI(s => s.lastRoll)
  const clear = useUI(s => s.clearRoll)
  useEffect(() => {
    if (!last) return
    const t = window.setTimeout(clear, 4500)
    return () => window.clearTimeout(t)
  }, [last, clear])
  if (!last) return null
  const r = last.result
  const nat = r.formula.startsWith('1d20') || r.physical ? (r.kept ?? r.dice[0]) : undefined
  const cls = nat === 20 ? 'crit' : nat === 1 ? 'fumble' : ''
  return (
    <div className={`toast ${cls}`} role="status" aria-live="polite" onClick={clear}>
      <span className="toast-total">{r.total}</span>
      <span className="toast-body">
        <b>{r.who ? `${r.who.replace(/^Sample:\s*/, '')} · ` : ''}{r.label || r.formula}</b>
        <small>
          {r.physical ? 'physical' : r.formula}{r.mode !== 'normal' ? ` ${r.mode}` : ''} · {describe(r)}
          {nat === 20 ? ' · natural 20' : nat === 1 ? ' · natural 1' : ''}
        </small>
      </span>
    </div>
  )
}
