import { useEffect, useRef, useState } from 'react'

/** Destructive confirm: the button only unlocks once the user types DELETE. */
export function ConfirmDelete({ what, onConfirm, onCancel }: { what: string; onConfirm: () => void; onCancel: () => void }) {
  const [v, setV] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    input.current?.focus()
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onCancel])
  const ok = v.trim().toUpperCase() === 'DELETE'
  return (
    <div className="modal-scrim" onMouseDown={onCancel}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="cd-h" onMouseDown={e => e.stopPropagation()}>
        <h2 id="cd-h">Delete {what}?</h2>
        <p>This removes it from this device and cannot be undone. Type <b>DELETE</b> to confirm.</p>
        <input ref={input} className="field" value={v} onChange={e => setV(e.target.value)} aria-label="Type DELETE to confirm"
          autoCapitalize="characters" autoComplete="off" onKeyDown={e => e.key === 'Enter' && ok && onConfirm()} />
        <div className="foot">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn primary" disabled={!ok} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}
