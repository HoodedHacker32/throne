import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/** Right-hand detail panel. Sits over the page on desktop, full width on phones. Esc closes. */
export function Drawer({ title, onClose, children, sheet }: { title: ReactNode; onClose: () => void; children: ReactNode; sheet?: boolean }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
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
