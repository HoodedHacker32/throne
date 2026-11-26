import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type LibraryItem, type Note, type NoteKind } from '../db'
import { embedKey, extractEmbeds, extractLinks, renderMarkdown } from '../lib/markdown'
import { shrinkImage } from '../lib/image'
import { ArrowLeft, ChevronDown, ChevronRight, Folder, FolderOpen, ImagePlus, Plus, Trash2 } from 'lucide-react'
import { useCharacters } from '../lib/hooks'
import { DraftInput } from '../components/DraftInput'
import { NpcCardEditor } from '../components/NpcCardEditor'

const KINDS: NoteKind[] = ['note', 'character', 'npc', 'location', 'session']

export function NotesPage({ campaignId }: { campaignId: number | undefined }) {
  const { noteId } = useParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'split' | 'edit' | 'read'>(() => window.innerWidth < 800 ? 'read' : 'split')
  const [kindFilter, setKindFilter] = useState<NoteKind | 'all'>('all')
  const [activeFolder, setActiveFolder] = useState('')
  const [closed, setClosedState] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('throne.foldersClosed') ?? '[]') } catch { return [] } })
  const toggle = (f: string) => {
    const next = closed.includes(f) ? closed.filter(x => x !== f) : [...closed, f]
    setClosedState(next); try { localStorage.setItem('throne.foldersClosed', JSON.stringify(next)) } catch { /* private mode */ }
  }

  const notes = useLiveQuery(
    () => (campaignId ? db.notes.where('campaignId').equals(campaignId).reverse().sortBy('updatedAt') : []),
    [campaignId], [] as Note[],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const byKind = kindFilter === 'all' ? notes : notes.filter(n => n.kind === kindFilter)
    if (!q) return byKind
    return byKind.filter(n =>
      n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q)))
  }, [notes, query, kindFilter])

  const current = notes.find(n => String(n.id) === noteId)

  async function createNote(title = 'Untitled note', kind: NoteKind = 'note') {
    if (!campaignId) return
    const now = Date.now()
    const id = await db.notes.add({ campaignId, title, body: `# ${title}\n\n`, kind, tags: [], createdAt: now, updatedAt: now, folder: activeFolder || undefined })
    navigate(`/notes/${id}`)
  }

  // Folder tree: every folder path and its parents, sorted, with the notes directly inside each.
  const searching = query.trim() !== ''
  const tree = useMemo(() => {
    const paths = new Set<string>()
    for (const n of filtered) {
      const parts = (n.folder ?? '').split('/').map(x => x.trim()).filter(Boolean)
      for (let i = 1; i <= parts.length; i++) paths.add(parts.slice(0, i).join('/'))
    }
    const sorted = [...paths].sort((a, b) => a.localeCompare(b))
    const notesIn = (f: string) => filtered.filter(n => (n.folder ?? '').split('/').map(x => x.trim()).filter(Boolean).join('/') === f)
    return { folders: sorted.map(f => ({ path: f, depth: f.split('/').length - 1, name: f.split('/').pop()!, notes: notesIn(f), count: filtered.filter(n => { const p = (n.folder ?? '').trim(); return p === f || p.startsWith(f + '/') }).length })), root: notesIn('') }
  }, [filtered])
  const hidden = (path: string) => closed.some(c => path !== c && path.startsWith(c + '/'))
  const item = (n: Note, depth = 0) => (
    <button key={n.id} className={`note-item ${String(n.id) === noteId ? 'active' : ''}`} style={{ paddingLeft: 14 + depth * 14 }}
      onClick={() => navigate(`/notes/${n.id}`)}>
      <span className="t">{n.title || 'Untitled'}</span>
      <span className="m"><span className="kind">{n.kind}</span>
        {searching && n.folder ? <span className="muted">{n.folder} · </span> : null}
        {n.body.replace(/^#.*$/m, '').replace(/[#>*_|\-\[\]!]/g, '').trim().slice(0, 60)}</span>
    </button>
  )

  const titles = useMemo(() => new Map(notes.map(n => [n.title.toLowerCase(), n])), [notes])

  return (
    <div className={`notes-layout ${current ? 'has-side' : ''}`}>
      <aside className={`notes-list ${current ? 'hide-m' : ''}`} aria-label="Note list">
        <div className="head">
          <div className="panel-h" style={{ margin: 0 }}><h2>Notes</h2>
            <button className="btn primary sm" onClick={() => createNote()} title={activeFolder ? `New note in ${activeFolder}` : 'New note'}><Plus size={14} /> New{activeFolder ? ` in ${activeFolder.split('/').pop()}` : ''}</button></div>
          <input className="field" type="search" placeholder="Search notes and tags" value={query}
            onChange={e => setQuery(e.target.value)} aria-label="Search notes" />
          <div className="chips" role="group" aria-label="Filter by type">
            {(['all', ...KINDS] as const).map(k => <button key={k} className="chip" aria-pressed={kindFilter === k} onClick={() => setKindFilter(k)}>{k === 'all' ? 'All' : k}</button>)}
          </div>
        </div>
        <div className="scroll">
          {filtered.length === 0 && <div className="empty">No notes match.</div>}
          {searching ? filtered.map(n => item(n)) : (
            <>
              {tree.folders.map(f => hidden(f.path) ? null : (
                <div key={f.path} className="folder">
                  <button className={`folder-h ${activeFolder === f.path ? 'active' : ''}`} style={{ paddingLeft: 10 + f.depth * 14 }}
                    onClick={() => { toggle(f.path); setActiveFolder(f.path) }} aria-expanded={!closed.includes(f.path)}>
                    {closed.includes(f.path) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    {closed.includes(f.path) ? <Folder size={15} /> : <FolderOpen size={15} />}
                    <span className="grow">{f.name}</span><small className="muted tnum">{f.count}</small>
                  </button>
                  {!closed.includes(f.path) && f.notes.map(n => item(n, f.depth + 1))}
                </div>
              ))}
              {tree.root.length > 0 && tree.folders.length > 0 && (
                <button className={`folder-h root ${activeFolder === '' ? 'active' : ''}`} onClick={() => setActiveFolder('')}>
                  <span className="grow">Not in a folder</span><small className="muted tnum">{tree.root.length}</small>
                </button>
              )}
              {tree.root.map(n => item(n))}
            </>
          )}
        </div>
      </aside>

      {current ? (
        <Editor key={current.id} note={current} notes={notes} titles={titles} view={view} setView={setView}
          onOpen={id => navigate(`/notes/${id}`)} onCreate={createNote} onClose={() => navigate('/notes')}
          onDeleted={() => navigate('/notes')} />
      ) : (
        <section className="note-editor hide-m">
          <div className="empty">
            <h2>Pick a note, or start one</h2>
            <p>Everything at the table lives here: characters, NPCs, places, sessions. Link them with [[double brackets]].</p>
            <button className="btn primary" onClick={() => createNote()}><Plus size={16} /> New note</button>
          </div>
        </section>
      )}
    </div>
  )
}

function Editor(props: {
  note: Note; notes: Note[]; titles: Map<string, Note>; view: 'split' | 'edit' | 'read'
  setView: (v: 'split' | 'edit' | 'read') => void
  onOpen: (id: number) => void; onCreate: (title: string) => void; onClose: () => void; onDeleted: () => void
}) {
  const { note, notes, titles, view, setView } = props
  const chars = useCharacters()
  const [title, setTitle] = useState(note.title)
  // The textarea is uncontrolled so typing never waits on React: the text lives in the DOM (and bodyRef), and the
  // preview, links and save follow a moment later.
  const [body, setBodyState] = useState(note.body)
  const bodyRef = useRef(note.body), titleRef = useRef(note.title)
  const bodyTimer = useRef<number | undefined>(undefined)
  const setBody = (v: string) => { bodyRef.current = v; if (src.current && src.current.value !== v) src.current.value = v; window.clearTimeout(bodyTimer.current); setBodyState(v) }
  const typed = (v: string) => { bodyRef.current = v; window.clearTimeout(bodyTimer.current); bodyTimer.current = window.setTimeout(() => setBodyState(v), 200) }
  // Save whatever is unsaved when leaving the note or hiding the app.
  const stored = useRef(note); stored.current = note
  useEffect(() => {
    const flush = () => {
      const n = stored.current
      if (bodyRef.current !== n.body || titleRef.current !== n.title)
        db.notes.update(n.id, { title: titleRef.current, body: bodyRef.current, updatedAt: Date.now() })
    }
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', onHide)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onHide); flush() }
  }, [note.id])
  const [folder, setFolder] = useState(note.folder ?? '')
  const folders = useMemo(() => [...new Set(notes.map(n => (n.folder ?? '').trim()).filter(Boolean))].sort(), [notes])
  useEffect(() => {
    const clean = folder.split('/').map(x => x.trim()).filter(Boolean).join('/')
    if (clean === (note.folder ?? '')) return
    const t = window.setTimeout(() => db.notes.update(note.id, { folder: clean || undefined }), 400)
    return () => window.clearTimeout(t)
  }, [folder, note.id, note.folder])
  const saveTimer = useRef<number | undefined>(undefined)
  const src = useRef<HTMLTextAreaElement>(null)
  const preview = useRef<HTMLDivElement>(null)
  const imgIn = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // Library images for this campaign, keyed for ![[name]] embeds.
  const library = useLiveQuery(() => db.library.where('campaignId').equals(note.campaignId).toArray(), [note.campaignId], [] as LibraryItem[])
  const urls = useMemo(() => new Map(library.filter(l => l.mime.startsWith('image/')).map(l => [embedKey(l.name), URL.createObjectURL(l.blob)])), [library])
  useEffect(() => () => urls.forEach(u => URL.revokeObjectURL(u)), [urls])

  useEffect(() => {
    window.clearTimeout(saveTimer.current)
    if (title === note.title && body === note.body) return
    saveTimer.current = window.setTimeout(() => {
      db.notes.update(note.id, { title, body, updatedAt: Date.now() })
    }, 350)
    return () => window.clearTimeout(saveTimer.current)
  }, [title, body, note.id, note.title, note.body])

  const html = useMemo(() => view === 'edit' ? '' : renderMarkdown(body, t => titles.has(t.toLowerCase())), [body, titles, view])

  const backlinks = useMemo(
    () => notes.filter(n => n.id !== note.id &&
      extractLinks(n.body).some(l => l.toLowerCase() === title.trim().toLowerCase())),
    [notes, note.id, title],
  )
  const outgoing = useMemo(() => extractLinks(body), [body])
  const embeds = useMemo(() => extractEmbeds(body), [body])
  const onMaps = library.filter(l => l.pins?.some(p => p.noteId === note.id))
  const navigate = useNavigate()

  // Fill embed placeholders with object URLs after each render of the preview.
  useEffect(() => {
    preview.current?.querySelectorAll<HTMLImageElement>('img[data-embed]').forEach(img => {
      const u = urls.get(embedKey(img.dataset.embed ?? ''))
      if (u) { img.src = u; img.classList.remove('missing') } else { img.removeAttribute('src'); img.classList.add('missing') }
    })
  }, [html, urls, view])

  /** Save images to the campaign library and insert ![[name]] at the cursor. */
  async function addImages(files: File[]) {
    const imgs = files.filter(f => f.type.startsWith('image/'))
    if (!imgs.length) return
    const taken = new Set(library.map(l => embedKey(l.name)))
    const names: string[] = []
    for (const f of imgs) {
      const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19).replace(/:/g, '')
      let name = /^image\.\w+$/i.test(f.name) || !f.name ? `Pasted image ${stamp}` : f.name.replace(/\.[^.]+$/, '')
      for (let i = 2; taken.has(embedKey(name)); i++) name = `${name.replace(/ \d+$/, '')} ${i}`
      taken.add(embedKey(name))
      const blob = await shrinkImage(f)
      await db.library.add({ campaignId: note.campaignId, name, kind: 'image', mime: blob.type || f.type, blob, createdAt: Date.now() })
      names.push(name)
    }
    const text = names.map(n => `![[${n}]]`).join('\n')
    const el = src.current
    const cur = bodyRef.current
    const start = el?.selectionStart ?? cur.length, end = el?.selectionEnd ?? cur.length
    const before = cur.slice(0, start), after = cur.slice(end)
    const pad = before && !before.endsWith('\n') ? '\n' : ''
    setBody(`${before}${pad}${text}\n${after}`)
    if (view === 'read') setView('split')
  }

  function onPreviewClick(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest('a[data-wiki]') as HTMLElement | null
    if (!a) return
    e.preventDefault()
    const t = a.dataset.wiki ?? ''
    const hit = titles.get(t.toLowerCase())
    if (hit) props.onOpen(hit.id)
    else props.onCreate(t)
  }

  async function remove() {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    await db.notes.delete(note.id)
    props.onDeleted()
  }

  return (
    <>
      <section className="note-editor">
        <div className="note-bar">
          <button className="btn ghost sm" onClick={props.onClose} aria-label="Back to list"><ArrowLeft size={16} /></button>
          <DraftInput className="title-input" value={title} delay={250} onInput={e => { titleRef.current = e.currentTarget.value }} onValue={setTitle} aria-label="Note title" />
          <select className="field" style={{ width: 'auto' }} value={note.kind} aria-label="Note type"
            onChange={e => db.notes.update(note.id, { kind: e.target.value as NoteKind })}>
            {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <DraftInput className="field folder-in" list="folder-list" placeholder="Folder" aria-label="Folder" value={folder}
            onValue={setFolder} />
          <datalist id="folder-list">{folders.map(f => <option key={f} value={f} />)}</datalist>
          <select className="field" style={{ width: 'auto' }} value={note.characterId ?? ''} aria-label="Linked character"
            onChange={e => db.notes.update(note.id, { characterId: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">No character</option>
            {chars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="seg" role="group" aria-label="View">
            {(['edit', 'split', 'read'] as const).map(v => (
              <button key={v} aria-pressed={view === v} className={v === 'split' ? 'hide-s' : ''} onClick={() => setView(v)}>{v}</button>
            ))}
          </div>
          <button className="btn ghost sm" onClick={() => imgIn.current?.click()} aria-label="Insert image"><ImagePlus size={16} /></button>
          <input ref={imgIn} type="file" accept="image/*" multiple hidden onChange={e => { addImages([...(e.target.files ?? [])]); e.target.value = '' }} />
          <button className="btn ghost sm" onClick={remove} aria-label="Delete note"><Trash2 size={16} /></button>
        </div>
        {note.kind === 'npc' && <NpcCardEditor note={note} />}
        <div className={`note-body ${view !== 'split' ? 'single' : ''} ${dragging ? 'dragging' : ''}`}
          onDragOver={e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); setDragging(true) } }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); setDragging(false); addImages([...e.dataTransfer.files]) } }}>
          {view !== 'read' && (
            <textarea ref={src} className="md-source" defaultValue={bodyRef.current} onInput={e => typed(e.currentTarget.value)}
              onBlur={e => setBody(e.currentTarget.value)}
              onPaste={e => { const files = [...e.clipboardData.files]; if (files.some(f => f.type.startsWith('image/'))) { e.preventDefault(); addImages(files) } }}
              spellCheck aria-label="Markdown source" placeholder="Write in markdown. [[Links]] to other notes, paste or drop images." />
          )}
          {view !== 'edit' && (
            <div ref={preview} className="md-preview" tabIndex={0} aria-label="Preview" onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>
      </section>
      <aside className="notes-side" aria-label="Links and tags">
        <section>
          <h2>Linked from</h2>
          {backlinks.length === 0 && <div className="muted small">Nothing links here yet.</div>}
          {backlinks.map(b => <button key={b.id} className="linkbtn" onClick={() => props.onOpen(b.id)}>{b.title}</button>)}
        </section>
        <section>
          <h2>Links to</h2>
          {outgoing.length === 0 && <div className="muted small">Use [[double brackets]] to link.</div>}
          {outgoing.map(l => {
            const hit = titles.get(l.toLowerCase())
            return <button key={l} className="linkbtn" onClick={() => hit ? props.onOpen(hit.id) : props.onCreate(l)}>
              {l}{hit ? '' : ' (create)'}</button>
          })}
        </section>
        {onMaps.length > 0 && (
          <section>
            <h2>On maps</h2>
            {onMaps.map(m => <button key={m.id} className="linkbtn" onClick={() => navigate(`/dm/library/${m.id}`)}>{m.name} <span className="muted small">({m.pins!.filter(p => p.noteId === note.id).map(p => p.label).join(', ')})</span></button>)}
          </section>
        )}
        {embeds.length > 0 && (
          <section>
            <h2>Images</h2>
            {embeds.map(n => <div key={n} className={`small ${urls.has(embedKey(n)) ? '' : 'error'}`}>{n}{urls.has(embedKey(n)) ? '' : ' (not in library)'}</div>)}
          </section>
        )}
        <section>
          <h2>Tags</h2>
          <div>{note.tags.map(t => <span key={t} className="tag">{t}</span>)}</div>
          <input className="field" placeholder="Add a tag, press Enter" aria-label="Add tag"
            onKeyDown={e => {
              if (e.key !== 'Enter') return
              const v = e.currentTarget.value.trim().toLowerCase()
              if (v && !note.tags.includes(v)) db.notes.update(note.id, { tags: [...note.tags, v] })
              e.currentTarget.value = ''
            }} />
        </section>
      </aside>
    </>
  )
}
