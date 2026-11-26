import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/** Right-hand detail panel. Sits over the page on desktop, full width on phones. Esc closes. */
export function Drawer({ title, onClose, children, sheet }: { title: ReactNode; onClose: () => void; children: ReactNode; sheet?: boolean }) {
  const ref = useRef<HTMLElement>(null)
  // Callers pass a new onClose every render; keep the latest in a ref so the effects below run once.
  const close = useRef(onClose)
  close.current = onClose
  // Focus the panel only when it opens. Re-focusing on every render stole focus from inputs inside it
  // (each keystroke saves and re-renders), which closed the iPhone keyboard after every letter.
  useEffect(() => { ref.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  return (
    <aside ref={ref} className={`drawer ${sheet ? 'sheet' : ''}`} role="dialog" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1}>
      <div className="drawer-h">
        <h2>{title}</h2>
        <button className="icon-btn light" onClick={onClose} aria-label="Close panel"><X size={18} /></button>
      </div>
      <div className="drawer-b">{children}</div>
    </aside>
  )
}
