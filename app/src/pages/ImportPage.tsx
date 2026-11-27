import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileUp } from 'lucide-react'
import { db, type Character } from '../db'
import { fromDdb, looksLikeDdb } from '../lib/ddb'
import { readPdfFields } from '../lib/pdf'
import { ABILITIES, fmt, mod } from '../lib/rules'
import { useCampaignId } from '../lib/hooks'

export function ImportPage() {
  const [draft, setDraft] = useState<Omit<Character, 'id'> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const campaignId = useCampaignId()
  const navigate = useNavigate()

  async function load(file: File | undefined) {
    if (!file) return
    setBusy(true); setError(''); setDraft(null)
    try {
      const { fields } = await readPdfFields(file)
      if (!looksLikeDdb(fields)) throw new Error('This PDF has no D&D Beyond character fields. Export the sheet from D&D Beyond (Export to PDF) and try that file.')
      setDraft(fromDdb(fields))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that PDF.')
    } finally { setBusy(false) }
  }
  async function save() {
    if (!draft) return
    const id = await db.characters.add({ ...draft, campaignId, createdAt: Date.now(), updatedAt: Date.now() })
    navigate(`/characters/${id}`)
  }

  return (
    <div className="page narrow">
      <Link to="/characters" className="btn ghost sm back"><ArrowLeft size={14} /> Characters</Link>
      <div className="page-head"><div><h1>Import a PDF</h1><p>Bring in a character you exported from D&amp;D Beyond. The file is read on this device and never uploaded.</p></div></div>

      <section className="panel">
        <label className="dropzone file-drop">
          <FileUp size={28} aria-hidden="true" />
          <b>{busy ? 'Reading…' : 'Choose a PDF'}</b>
          <small className="muted">On D&amp;D Beyond: open the character, then Export to PDF.</small>
          <input type="file" accept="application/pdf,.pdf" onChange={e => load(e.target.files?.[0])} disabled={busy} className="visually-hidden" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {draft && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-h"><h2>Check it looks right</h2></div>
          <h3 className="import-name">{draft.name}</h3>
          <p className="muted">Level {draft.level} {draft.species} {draft.className}{draft.background ? ` · ${draft.background}` : ''}</p>
          <div className="scores mini">
            {ABILITIES.map(a => <div key={a} className="score"><span className="lab" style={{ margin: 0 }}>{a}</span><b className="num">{draft.abilities[a]}</b><span className="m">{fmt(mod(draft.abilities[a]))}</span></div>)}
          </div>
          <ul className="import-facts">
            <li><b className="tnum">{draft.hpMax}</b> max HP, AC <b className="tnum">{draft.ac}</b>, speed <b className="tnum">{draft.speed}</b> ft.</li>
            <li><b className="tnum">{Object.keys(draft.skillProf).length}</b> skill proficiencies, saves: {draft.saveProf.join(', ').toUpperCase() || 'none'}</li>
            <li><b className="tnum">{draft.attacks.length}</b> attacks, <b className="tnum">{draft.inventory.length}</b> items, <b className="tnum">{draft.coins.gp}</b> gp</li>
            {(draft.spells?.length || draft.slots?.some(n => n > 0)) ? (
              <li><b className="tnum">{draft.spells?.length ?? 0}</b> spells{draft.slots?.some(n => n > 0) ? `, slots ${draft.slots.map((n, l) => l > 0 && n ? `${n}×${l}` : '').filter(Boolean).join(' ')}` : ''}{draft.spellAbility ? `, cast with ${draft.spellAbility.toUpperCase()}` : ''}</li>
            ) : null}
            <li>Features, personality and backstory text copied across</li>
          </ul>
          <div className="foot"><button className="btn ghost" onClick={() => setDraft(null)}>Discard</button><button className="btn primary" onClick={save}>Add to my characters</button></div>
        </section>
      )}
    </div>
  )
}
