import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NotebookPen, X } from 'lucide-react'
import { db } from '../db'
import { useUI } from '../state'

const today = () => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

/** Jot something down at the table without leaving the screen you are on.
 *  Default: append a timestamped line to today's session log (created on first use, in the Sessions folder). */
export function QuickCapture() {
  const { captureOpen: open, setCapture, campaignId } = useUI()
  const [text, setText] = useState('')
  const [asNote, setAsNote] = useState(false)
  const [saved, setSaved] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)
  const navigate = useNavigate()

  useEffect(() => { if (open) { setSaved(''); setTimeout(() => area.current?.focus(), 0) } }, [open])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); setCapture(true) }
      else if (e.key === 'Escape' && useUI.getState().captureOpen) setCapture(false)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [setCapture])
  if (!open) return null

  async function save(openAfter = false) {
    const t = text.trim()
    if (!t || !campaignId) return
    const now = Date.now()
    let id: number
    if (asNote) {
      const title = t.split('\n')[0].replace(/^#+\s*/, '').slice(0, 80) || 'Quick note'
      id = await db.notes.add({ campaignId, title, body: `# ${title}\n\n${t.split('\n').slice(1).join('\n').trim()}\n`, kind: 'note', tags: [], createdAt: now, updatedAt: now })
      setSaved(`Saved as “${title}”`)
    } else {
      const title = `Session log ${today()}`
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const line = `- **${time}** ${t.replace(/\n+/g, ' ')}`
      const existing = await db.notes.where('campaignId').equals(campaignId).filter(n => n.title === title).first()
      if (existing) {
        id = existing.id
        await db.notes.update(id, { body: `${existing.body.replace(/\s+$/, '')}\n${line}\n`, updatedAt: now })
      } else {
        id = await db.notes.add({ campaignId, title, body: `# ${title}\n\n${line}\n`, kind: 'session', tags: ['log'], folder: 'Sessions', createdAt: now, updatedAt: now })
      }
      setSaved(`Added to ${title}`)
    }
    setText('')
    if (openAfter) { setCapture(false); navigate(`/notes/${id}`) } else area.current?.focus()
  }

  return (
    <div className="modal-scrim capture-scrim" onMouseDown={() => setCapture(false)}>
      <div className="modal capture" role="dialog" aria-modal="true" aria-label="Quick note" onMouseDown={e => e.stopPropagation()}>
        <div className="capture-h">
          <h2><NotebookPen size={18} /> Quick note</h2>
          <button className="icon-btn ghostly" aria-label="Close" onClick={() => setCapture(false)}><X size={18} /></button>
        </div>
        <textarea ref={area} className="field area" rows={4} value={text} onChange={e => setText(e.target.value)}
          placeholder={asNote ? 'First line becomes the title' : 'What just happened? e.g. “Vael lied about the tithe”'}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save() } }} />
        <div className="seg" role="group" aria-label="Save to">
          <button aria-pressed={!asNote} onClick={() => setAsNote(false)}>Today's session log</button>
          <button aria-pressed={asNote} onClick={() => setAsNote(true)}>New note</button>
        </div>
        {saved && <p className="small capture-ok" role="status">{saved}</p>}
        <div className="foot">
          <button className="btn ghost" onClick={() => save(true)} disabled={!text.trim()}>Save and open</button>
          <button className="btn primary" onClick={() => save()} disabled={!text.trim()}>Save <kbd className="hide-s">Ctrl ↵</kbd></button>
        </div>
      </div>
    </div>
  )
}
