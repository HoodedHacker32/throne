import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, Eye, FileUp, PenLine, Pencil, Search, Trash2, UserPlus } from 'lucide-react'
import { blankCharacter, db, type Character } from '../db'
import { useCampaignId, useCharacters } from '../lib/hooks'
import { CharacterCard } from '../components/CharacterCard'
import { classLine } from '../lib/character'
import { ConfirmDelete } from '../components/ConfirmDelete'

type Sort = 'name' | 'name-desc' | 'level' | 'level-desc' | 'modified' | 'created'
const SORTS: [Sort, string][] = [
  ['modified', 'Recently changed'], ['created', 'Newest first'], ['name', 'Name A–Z'], ['name-desc', 'Name Z–A'],
  ['level-desc', 'Level high–low'], ['level', 'Level low–high'],
]
const read = () => { try { return (localStorage.getItem('throne.charSort') as Sort) || 'modified' } catch { return 'modified' } }

export function CharactersPage() {
  const chars = useCharacters()
  const campaignId = useCampaignId()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sort, setSortState] = useState<Sort>(read)
  const [del, setDel] = useState<Character | null>(null)
  const setSort = (s: Sort) => { setSortState(s); try { localStorage.setItem('throne.charSort', s) } catch { /* private mode */ } }

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = chars.filter(c => !s || [c.name, classLine(c), c.species, c.background, `level ${c.level}`].join(' ').toLowerCase().includes(s))
    const by: Record<Sort, (a: Character, b: Character) => number> = {
      name: (a, b) => a.name.localeCompare(b.name), 'name-desc': (a, b) => b.name.localeCompare(a.name),
      level: (a, b) => a.level - b.level || a.name.localeCompare(b.name), 'level-desc': (a, b) => b.level - a.level || a.name.localeCompare(b.name),
      modified: (a, b) => b.updatedAt - a.updatedAt, created: (a, b) => b.createdAt - a.createdAt,
    }
    return list.sort(by[sort])
  }, [chars, q, sort])

  async function freewrite() {
    const id = await db.characters.add(blankCharacter({ campaignId }))
    navigate(`/characters/${id}?edit=1`)
  }
  async function copy(c: Character) {
    const { id: _id, ...rest } = c
    void _id
    const now = Date.now()
    await db.characters.add({ ...rest, name: `${c.name} (copy)`, createdAt: now, updatedAt: now })
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Characters</h1><p>Three ways in: guided builder, free-write sheet, or a D&amp;D Beyond PDF.</p></div>
        <div className="actions-row">
          <Link className="btn" to="/characters/import"><FileUp size={16} /> Import PDF</Link>
          <button className="btn" onClick={freewrite}><PenLine size={16} /> Free-write</button>
          <Link className="btn primary" to="/characters/new"><UserPlus size={16} /> Builder</Link>
        </div>
      </div>
      {chars.length > 0 && (
        <div className="list-tools">
          <div className="search-row">
            <Search size={16} aria-hidden="true" />
            <input className="field" type="search" placeholder="Search by name, class, species, level" value={q} onChange={e => setQ(e.target.value)} aria-label="Search characters" />
          </div>
          <label className="sort"><span className="muted small">Sort</span>
            <select className="field" value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort characters">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <span className="muted small tnum">{shown.length} of {chars.length}</span>
        </div>
      )}
      {chars.length === 0
        ? <div className="panel empty"><h2>No characters yet</h2><p>Pick one of the options above to make your first.</p></div>
        : shown.length === 0 ? <div className="panel empty"><h2>No match</h2><p>Nothing matches “{q}”.</p></div>
        : <div className="grid roster">{shown.map(c => (
          <CharacterCard key={c.id} c={c} actions={<>
            <Link className="btn ghost sm" to={`/characters/${c.id}`}><Eye size={14} /> View</Link>
            <Link className="btn ghost sm" to={`/characters/${c.id}?edit=1`}><Pencil size={14} /> Edit</Link>
            <button className="btn ghost sm" onClick={() => copy(c)}><Copy size={14} /> Copy</button>
            <button className="btn ghost sm danger" onClick={() => setDel(c)} aria-label={`Delete ${c.name}`}><Trash2 size={14} /></button>
          </>} />
        ))}</div>}
      {del && <ConfirmDelete what={del.name} onCancel={() => setDel(null)} onConfirm={async () => { await db.characters.delete(del.id); setDel(null) }} />}
    </div>
  )
}
