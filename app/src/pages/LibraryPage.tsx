import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TablesPanel } from '../components/TablesPanel'
import { Trash2, Upload, X } from 'lucide-react'
import { db, type LibraryItem } from '../db'
import { useCampaignId } from '../lib/hooks'

type Kind = LibraryItem['kind']
const KINDS: { k: Kind | 'all'; label: string }[] = [
  { k: 'all', label: 'All' }, { k: 'map', label: 'Maps' }, { k: 'image', label: 'Images' }, { k: 'handout', label: 'Handouts' },
]

export function LibraryPage() {
  const cid = useCampaignId()
  const items = useLiveQuery(() => cid ? db.library.where('campaignId').equals(cid).reverse().sortBy('createdAt') : [], [cid], [] as LibraryItem[])
  const [filter, setFilter] = useState<Kind | 'all'>('all')
  const [kind, setKind] = useState<Kind>('map')
  const [open, setOpen] = useState<LibraryItem | null>(null)
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const urls = useMemo(() => new Map(items.map(i => [i.id, URL.createObjectURL(i.blob)])), [items])
  useEffect(() => () => urls.forEach(u => URL.revokeObjectURL(u)), [urls])

  async function upload(files: FileList | null) {
    if (!files || !cid) return
    const now = Date.now()
    await db.library.bulkAdd([...files].map((f, i) => ({
      campaignId: cid, name: f.name.replace(/\.[^.]+$/, ''), kind, mime: f.type, blob: f, createdAt: now + i,
    })))
    if (input.current) input.current.value = ''
  }
  const shown = items.filter(i => filter === 'all' || i.kind === filter)
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'tables' ? 'tables' : 'files'
  const tabs = (
    <div className="tabs lib-tabs" role="tablist">
      <button role="tab" aria-selected={tab === 'files'} onClick={() => setParams({}, { replace: true })}>Maps &amp; files</button>
      <button role="tab" aria-selected={tab === 'tables'} onClick={() => setParams({ tab: 'tables' }, { replace: true })}>Random tables</button>
    </div>
  )
  if (tab === 'tables') return (
    <div className="page">
      <div className="page-head"><div><h1>Library</h1><p>Random tables work in every campaign. Roll them here or from the quick switcher.</p></div></div>
      {tabs}
      <TablesPanel />
    </div>
  )

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Library</h1><p>Maps, art and handouts for this campaign. Stored on this device.</p></div>
        <div className="actions-row">
          <select className="field" style={{ width: 'auto' }} value={kind} onChange={e => setKind(e.target.value as Kind)} aria-label="Upload as">
            <option value="map">Map</option><option value="image">Image</option><option value="handout">Handout</option>
          </select>
          <button className="btn primary" onClick={() => input.current?.click()}><Upload size={16} /> Upload</button>
          <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={e => upload(e.target.files)} />
        </div>
      </div>
      {tabs}
      <div className="chips" style={{ marginBottom: 14 }}>
        {KINDS.map(k => <button key={k.k} className="chip" aria-pressed={filter === k.k} onClick={() => setFilter(k.k)}>{k.label}</button>)}
      </div>
      {shown.length === 0 ? (
        <div className="panel empty dropzone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files) }}>
          <h2>Nothing here yet</h2><p>Upload a world map from Inkarnate, a dungeon sketch or a handout. Drop files here on desktop.</p>
        </div>
      ) : (
        <div className="lib-grid">
          {shown.map(i => (
            <figure key={i.id} className="lib-item">
              <button className="lib-open" onClick={() => i.mime.startsWith('image/') ? navigate(`/dm/library/${i.id}`) : setOpen(i)} aria-label={`Open ${i.name}`}>
                {(i.pins?.length ?? 0) > 0 && <span className="lib-badge tnum">{i.pins!.length} pin{i.pins!.length === 1 ? '' : 's'}</span>}
                {i.mime.startsWith('image/') ? <img src={urls.get(i.id)} alt="" loading="lazy" /> : <div className="lib-file">PDF</div>}
              </button>
              <figcaption className="cap">
                <input className="field bare" value={i.name} aria-label="Name" onChange={e => db.library.update(i.id, { name: e.target.value })} />
                <span className="kind">{i.kind}</span>
                <button className="btn ghost sm" aria-label={`Delete ${i.name}`} onClick={() => confirm(`Delete ${i.name}?`) && db.library.delete(i.id)}><Trash2 size={16} /></button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {open && (
        <div className="viewer" role="dialog" aria-modal="true" aria-label={open.name} onClick={() => setOpen(null)}>
          <button className="icon-btn viewer-close" aria-label="Close" onClick={() => setOpen(null)}><X size={22} /></button>
          {open.mime.startsWith('image/')
            ? <img src={urls.get(open.id)} alt={open.name} onClick={e => e.stopPropagation()} />
            : <iframe title={open.name} src={urls.get(open.id)} onClick={e => e.stopPropagation()} />}
        </div>
      )}
    </div>
  )
}
