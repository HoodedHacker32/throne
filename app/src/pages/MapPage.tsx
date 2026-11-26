import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Eraser, ExternalLink, Hand, MapPin as PinIcon, Maximize, Minus, Pencil, Plus, Trash2, Undo2 } from 'lucide-react'
import { db, type LibraryItem, type MapPin, type MapStroke, type Note } from '../db'
import { Drawer } from '../components/Drawer'
import { useMedia, useOptimistic } from '../lib/hooks'

type Tool = 'pan' | 'pin' | 'draw' | 'erase'
const COLORS = ['#ba0000', '#14100e', '#2f6fb5', '#2f6a3f', '#d4a017']
const uid = () => Math.random().toString(36).slice(2, 10)

/** A map with pins (linked to notes) and freehand drawing. Pan by dragging, zoom with wheel, pinch or the buttons. */
export function MapPage() {
  const { id } = useParams()
  const item = useLiveQuery(() => db.library.get(Number(id)), [id])
  if (item === undefined) return <div className="page"><p className="muted">Loading…</p></div>
  if (!item.mime.startsWith('image/')) return <div className="page"><p>This file is not an image. <Link to="/dm/library">Back to the library</Link></p></div>
  return <MapView key={item.id} item={item} />
}

function MapView({ item }: { item: LibraryItem }) {
  const navigate = useNavigate()
  const wide = useMedia('(min-width: 1100px)')
  const url = useMemo(() => URL.createObjectURL(item.blob), [item.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const notes = useLiveQuery(() => db.notes.where('campaignId').equals(item.campaignId).sortBy('title'), [item.campaignId], [] as Note[])

  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [view, setView] = useState({ s: 1, x: 0, y: 0 })
  const [tool, setTool] = useState<Tool>('pan')
  const [color, setColor] = useState(COLORS[0])
  const [sel, setSel] = useState<string | null>(null)
  const [draft, setDraft] = useState<[number, number][] | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ x: number; y: number; vx: number; vy: number; dist?: number; s?: number; moved: boolean } | null>(null)
  const history = useRef<{ pins: MapPin[]; strokes: MapStroke[] }[]>([])

  // Instant local view of pins, strokes and name while they are written to IndexedDB.
  const [it, write] = useOptimistic(item, useCallback((p: Partial<LibraryItem>) => db.library.update(item.id, p), [item.id]))
  const pins = it.pins ?? [], strokes = it.strokes ?? []
  const save = (patch: Partial<Pick<LibraryItem, 'pins' | 'strokes'>>) => {
    history.current.push({ pins, strokes }); if (history.current.length > 50) history.current.shift()
    return write(patch)
  }
  const undo = () => { const h = history.current.pop(); if (h) write(h) }

  // Fit the image to the viewport once its size is known.
  const fit = () => {
    const el = box.current
    if (!el || !size) return
    const s = Math.min(el.clientWidth / size.w, el.clientHeight / size.h) * 0.96
    setView({ s, x: (el.clientWidth - size.w * s) / 2, y: (el.clientHeight - size.h * s) / 2 })
  }
  useEffect(fit, [size]) // eslint-disable-line react-hooks/exhaustive-deps

  const toImage = (cx: number, cy: number): [number, number] => {
    const r = box.current!.getBoundingClientRect()
    return [(cx - r.left - view.x) / view.s, (cy - r.top - view.y) / view.s]
  }
  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    const r = box.current!.getBoundingClientRect()
    const px = cx === undefined ? r.width / 2 : cx - r.left, py = cy === undefined ? r.height / 2 : cy - r.top
    setView(v => {
      const s = Math.min(8, Math.max(0.05, v.s * factor))
      return { s, x: px - (px - v.x) * (s / v.s), y: py - (py - v.y) * (s / v.s) }
    })
  }
  useEffect(() => {
    const el = box.current
    if (!el) return
    const wheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY) }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  })

  function down(e: RPointerEvent) {
    if ((e.target as Element).closest('.map-pin')) return
    box.current!.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: view.x, vy: view.y, dist: Math.hypot(a.x - b.x, a.y - b.y), s: view.s, moved: true }
      setDraft(null)
      return
    }
    gesture.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }
    if (tool === 'draw') setDraft([toImage(e.clientX, e.clientY)])
  }
  function move(e: RPointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    if (pointers.current.size === 2 && g.dist && g.s) {
      const [a, b] = [...pointers.current.values()]
      const s = Math.min(8, Math.max(0.05, g.s * Math.hypot(a.x - b.x, a.y - b.y) / g.dist))
      const r = box.current!.getBoundingClientRect()
      const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top, ox = g.x - r.left, oy = g.y - r.top
      setView({ s, x: mx - (ox - g.vx) * (s / g.s), y: my - (oy - g.vy) * (s / g.s) })
      return
    }
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 4) g.moved = true
    if (tool === 'draw' && draft) {
      const p = toImage(e.clientX, e.clientY), last = draft[draft.length - 1]
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) * view.s > 2) setDraft([...draft, p])
    } else if (tool === 'pan' || tool === 'pin' || tool === 'erase') {
      if (g.moved) setView(v => ({ ...v, x: g.vx + e.clientX - g.x, y: g.vy + e.clientY - g.y }))
    }
  }
  function up(e: RPointerEvent) {
    const g = gesture.current
    pointers.current.delete(e.pointerId)
    if (pointers.current.size > 0) return
    gesture.current = null
    if (tool === 'draw' && draft) {
      if (draft.length > 1 && size) save({ strokes: [...strokes, { id: uid(), points: draft.map(([x, y]) => [Math.round(x), Math.round(y)]), color, width: Math.max(size.w, size.h) / 300 }] })
      setDraft(null)
      return
    }
    if (g && !g.moved && tool === 'pin') {
      const [x, y] = toImage(e.clientX, e.clientY)
      if (!size || x < 0 || y < 0 || x > size.w || y > size.h) return
      const pin: MapPin = { id: uid(), x: Math.round(x), y: Math.round(y), label: `Pin ${pins.length + 1}`, color }
      save({ pins: [...pins, pin] }); setSel(pin.id); setTool('pan')
    }
  }

  const pin = pins.find(p => p.id === sel)
  const panel = pin && (
    <PinPanel pin={pin} notes={notes}
      set={patch => save({ pins: pins.map(p => p.id === pin.id ? { ...p, ...patch } : p) })}
      remove={() => { save({ pins: pins.filter(p => p.id !== pin.id) }); setSel(null) }}
      newNote={async () => {
        const now = Date.now()
        const nid = await db.notes.add({ campaignId: item.campaignId, title: pin.label, body: `# ${pin.label}\n\nA place on the map *${item.name}*.\n\n`, kind: 'location', tags: [], createdAt: now, updatedAt: now })
        await save({ pins: pins.map(p => p.id === pin.id ? { ...p, noteId: nid } : p) })
        navigate(`/notes/${nid}`)
      }} />
  )
  const pinScale = 1 / view.s // keep pins the same size on screen at any zoom

  return (
    <div className={`map-page tool-${tool}`}>
      <div className="map-bar">
        <Link to="/dm/library" className="btn ghost sm" aria-label="Back to library"><ArrowLeft size={16} /></Link>
        <input className="title-input map-title" value={it.name} aria-label="Map name" onChange={e => write({ name: e.target.value })} />
        <div className="seg" role="group" aria-label="Tool">
          {([['pan', Hand, 'Move'], ['pin', PinIcon, 'Pin'], ['draw', Pencil, 'Draw'], ['erase', Eraser, 'Erase']] as const).map(([t, Icon, l]) => (
            <button key={t} aria-pressed={tool === t} onClick={() => setTool(t)} title={l}><Icon size={14} /> <span className="hide-s">{l}</span></button>
          ))}
        </div>
        {(tool === 'draw' || tool === 'pin') && (
          <div className="swatches" role="group" aria-label="Colour">
            {COLORS.map(c => <button key={c} className="swatch" style={{ background: c }} aria-pressed={color === c} aria-label={`Colour ${c}`} onClick={() => setColor(c)} />)}
          </div>
        )}
        <div className="map-zoom">
          <button className="btn ghost sm" onClick={undo} aria-label="Undo" title="Undo"><Undo2 size={16} /></button>
          <button className="btn ghost sm" onClick={() => zoomAt(1 / 1.3)} aria-label="Zoom out"><Minus size={16} /></button>
          <span className="tnum small">{Math.round(view.s * 100)}%</span>
          <button className="btn ghost sm" onClick={() => zoomAt(1.3)} aria-label="Zoom in"><Plus size={16} /></button>
          <button className="btn ghost sm" onClick={fit} aria-label="Fit to screen"><Maximize size={16} /></button>
        </div>
      </div>
      <div className="map-body">
        <div ref={box} className="map-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div className="map-layer" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, width: size?.w, height: size?.h }}>
            <img src={url} alt={item.name} draggable={false} onLoad={e => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
            {size && (
              <svg className="map-ink" viewBox={`0 0 ${size.w} ${size.h}`} width={size.w} height={size.h}>
                {strokes.map(s => (
                  <polyline key={s.id} points={s.points.map(p => p.join(',')).join(' ')} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round"
                    className={tool === 'erase' ? 'erasable' : ''}
                    onPointerDown={tool === 'erase' ? (e => { e.stopPropagation(); save({ strokes: strokes.filter(x => x.id !== s.id) }) }) : undefined} />
                ))}
                {draft && <polyline points={draft.map(p => p.join(',')).join(' ')} stroke={color} strokeWidth={Math.max(size.w, size.h) / 300} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
              </svg>
            )}
            {pins.map(p => (
              <button key={p.id} className={`map-pin ${sel === p.id ? 'sel' : ''}`} style={{ left: p.x, top: p.y, transform: `translate(-50%, -100%) scale(${pinScale})`, ['--pin' as string]: p.color ?? COLORS[0] }}
                onClick={() => tool === 'erase' ? save({ pins: pins.filter(x => x.id !== p.id) }) : setSel(p.id)} aria-label={`Pin: ${p.label}`}>
                <PinIcon size={30} fill="currentColor" strokeWidth={1.5} />
                <span className="pin-label">{p.label}</span>
              </button>
            ))}
          </div>
          {pins.length === 0 && strokes.length === 0 && (
            <p className="map-hint">Choose <b>Pin</b> and tap the map to mark a place, or <b>Draw</b> to sketch a route.</p>
          )}
        </div>
        {wide && (
          <aside className="map-side">
            {panel ?? (
              <>
                <h3 className="group-h">Pins ({pins.length})</h3>
                {pins.length === 0 && <p className="muted small">No pins yet.</p>}
                {pins.map(p => (
                  <button key={p.id} className="pin-row" onClick={() => {
                    setSel(p.id)
                    const el = box.current!
                    setView(v => ({ ...v, x: el.clientWidth / 2 - p.x * v.s, y: el.clientHeight / 2 - p.y * v.s }))
                  }}>
                    <span className="pin-dot" style={{ background: p.color ?? COLORS[0] }} />
                    <span className="grow">{p.label}</span>
                    {p.noteId && <small className="muted">note</small>}
                  </button>
                ))}
                <p className="muted small" style={{ marginTop: 12 }}>{strokes.length} drawn line{strokes.length === 1 ? '' : 's'}. Use Erase and tap a line to remove it.</p>
              </>
            )}
          </aside>
        )}
      </div>
      {!wide && pin && <Drawer sheet title={pin.label || 'Pin'} onClose={() => setSel(null)}>{panel}</Drawer>}
    </div>
  )
}

function PinPanel({ pin, notes, set, remove, newNote }: {
  pin: MapPin; notes: Note[]; set: (p: Partial<MapPin>) => void; remove: () => void; newNote: () => void
}) {
  const linked = notes.find(n => n.id === pin.noteId)
  return (
    <div className="pin-panel">
      <label className="lab" htmlFor="pin-l">Label</label>
      <input id="pin-l" className="field" value={pin.label} onChange={e => set({ label: e.target.value })} />
      <label className="lab">Colour</label>
      <div className="swatches">
        {COLORS.map(c => <button key={c} className="swatch" style={{ background: c }} aria-pressed={(pin.color ?? COLORS[0]) === c} aria-label={`Colour ${c}`} onClick={() => set({ color: c })} />)}
      </div>
      <label className="lab" htmlFor="pin-n">Linked note</label>
      <select id="pin-n" className="field" value={pin.noteId ?? ''} onChange={e => set({ noteId: e.target.value ? Number(e.target.value) : undefined })}>
        <option value="">None</option>
        {notes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
      </select>
      <div className="actions-row" style={{ marginTop: 10 }}>
        {linked ? <Link className="btn sm" to={`/notes/${linked.id}`}><ExternalLink size={14} /> Open {linked.title}</Link>
          : <button className="btn sm primary" onClick={newNote}><Plus size={14} /> New place note</button>}
      </div>
      <div className="foot"><span /><button className="btn ghost sm" onClick={remove}><Trash2 size={14} /> Remove pin</button></div>
    </div>
  )
}
