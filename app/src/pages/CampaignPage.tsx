import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Map as MapIcon, NotebookPen, Plus, Swords, Upload } from 'lucide-react'
import { download, exportCampaign, importCampaign } from '../lib/backup'
import { randomNpc } from '../components/NpcCardEditor'
import { useTableLookup } from '../components/TablesPanel'
import { Dices } from 'lucide-react'
import { db, type NoteKind } from '../db'
import { useUI } from '../state'
import { ago, useCampaignId, useCharacters, useNotes } from '../lib/hooks'
import { CharacterCard } from '../components/CharacterCard'

const SECTIONS: { kind: NoteKind; label: string }[] = [
  { kind: 'session', label: 'Sessions' }, { kind: 'npc', label: 'NPCs' }, { kind: 'location', label: 'Places' },
]

export function CampaignPage() {
  const cid = useCampaignId()
  const setCampaign = useUI(s => s.setCampaign)
  const campaign = useLiveQuery(() => cid ? db.campaigns.get(cid) : undefined, [cid])
  const chars = useCharacters()
  const notes = useNotes()
  const fighters = useLiveQuery(() => cid ? db.combatants.where('campaignId').equals(cid).count() : 0, [cid], 0)
  const maps = useLiveQuery(() => cid ? db.library.where('campaignId').equals(cid).count() : 0, [cid], 0)
  const navigate = useNavigate()
  const fileIn = useRef<HTMLInputElement>(null)
  const lookup = useTableLookup()
  async function npc() {
    if (!cid) return
    const { title, card } = randomNpc(lookup)
    const now = Date.now()
    const id = await db.notes.add({ campaignId: cid, title, body: `# ${title}\n\n`, kind: 'npc', tags: [], card, createdAt: now, updatedAt: now })
    navigate(`/notes/${id}`)
  }
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  async function doExport() {
    if (!cid) return
    try { const { blob, filename } = await exportCampaign(cid); download(blob, filename); setMsg({ ok: true, text: `Exported ${filename}` }) }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Export failed.' }) }
  }
  async function doImport(f: File | undefined) {
    if (!f) return
    try { const id = await importCampaign(f); setCampaign(id); setMsg({ ok: true, text: 'Imported as a new campaign. Your existing campaigns were not changed.' }) }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Import failed.' }) }
    if (fileIn.current) fileIn.current.value = ''
  }

  async function newCampaign() {
    const name = prompt('Name the new campaign')?.trim()
    if (!name) return
    const id = await db.campaigns.add({ name, createdAt: Date.now() })
    setCampaign(id)
  }
  async function newNote(kind: NoteKind) {
    if (!cid) return
    const now = Date.now()
    const title = kind === 'session' ? `Session ${notes.filter(n => n.kind === 'session').length + 1}` : kind === 'npc' ? 'New NPC' : 'New place'
    const id = await db.notes.add({ campaignId: cid, title, body: `# ${title}\n\n`, kind, tags: [], createdAt: now, updatedAt: now })
    navigate(`/notes/${id}`)
  }
  if (!campaign) return <div className="page"><p className="muted">Loading…</p></div>

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="visually-hidden">Campaign: {campaign.name}</h1>
          <label className="lab" htmlFor="cname" style={{ marginTop: 0 }}>Campaign</label>
          <input id="cname" className="title-input campaign-name" value={campaign.name} onChange={e => db.campaigns.update(campaign.id, { name: e.target.value })} />
        </div>
        <div className="actions-row">
          <button className="btn" onClick={newCampaign}><Plus size={16} /> New campaign</button>
          <button className="btn" onClick={doExport}><Download size={16} /> Export</button>
          <button className="btn" onClick={() => fileIn.current?.click()}><Upload size={16} /> Import</button>
          <input ref={fileIn} type="file" accept=".zip,application/zip" hidden onChange={e => doImport(e.target.files?.[0])} />
          <Link className="btn primary" to="/dm/combat"><Swords size={16} /> {fighters ? 'Resume combat' : 'Run combat'}</Link>
        </div>
      </div>

      {msg && <p className={msg.ok ? 'callout ok' : 'callout req'} role="status">{msg.text}</p>}
      <div className="grid cols-3 stat-tiles">
        <Link to="/notes" className="panel tile"><NotebookPen size={20} /><b className="tnum">{notes.length}</b><span>notes</span></Link>
        <Link to="/dm/library" className="panel tile"><MapIcon size={20} /><b className="tnum">{maps}</b><span>maps and images</span></Link>
        <Link to="/dm/combat" className="panel tile"><Swords size={20} /><b className="tnum">{fighters}</b><span>in the initiative list</span></Link>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-h"><h2>Party</h2><Link className="btn ghost sm" to="/characters">Manage</Link></div>
        {chars.length === 0 ? <p className="muted">No characters in this campaign yet.</p>
          : <div className="grid roster">{chars.map(c => <CharacterCard key={c.id} c={c} />)}</div>}
      </section>

      <div className="grid cols-3" style={{ marginTop: 16 }}>
        {SECTIONS.map(s => {
          const list = notes.filter(n => n.kind === s.kind)
          return (
            <section key={s.kind} className="panel">
              <div className="panel-h"><h2>{s.label}</h2><span className="actions-row">
                {s.kind === 'npc' && <button className="btn ghost sm" onClick={npc} title="Random NPC from your tables"><Dices size={14} /> Random</button>}
                <button className="btn ghost sm" onClick={() => newNote(s.kind)}><Plus size={14} /> Add</button></span></div>
              {list.length === 0 && <p className="muted">None yet.</p>}
              {list.slice(0, 6).map(n => (
                <Link key={n.id} to={`/notes/${n.id}`} className="row link-row">
                  <span className="grow ellipsis">{n.title}{n.card?.role ? <small className="muted"> · {n.card.role}</small> : null}</span><small className="muted">{ago(n.updatedAt)}</small>
                </Link>
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}
