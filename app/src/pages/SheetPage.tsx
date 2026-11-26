import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Bed, Camera, Coffee, Heart, Pencil, Plus, Search, Shield, Trash2 } from 'lucide-react'
import { db, type ActionKind, type Attack, type Character, type ClassLevel, type Item, type Note, type Spell } from '../db'
import { ABILITIES, ABILITY_NAMES, ALIGNMENTS, CLASSES, CONDITIONS, SKILLS, SPECIES, fmt, mod, profBonus, type Ability } from '../lib/rules'
import { abilityMod, classLine, classesOf, hitDiceLeft, initiative, passive, saveBonus, skillBonus, withClasses } from '../lib/character'
import { check, record, rollDamage } from '../lib/roller'
import { roll } from '../lib/dice'
import { useMedia, useOptimistic } from '../lib/hooks'
import { toPortrait } from '../lib/image'
import { CASTING_ABILITY, LEVEL_NAME, separatePact, shortRestSlots, slotsForClasses } from '../lib/spells'
import { useUI } from '../state'
import { Portrait } from '../components/Portrait'
import { Drawer } from '../components/Drawer'
import { ConfirmDelete } from '../components/ConfirmDelete'
import { DraftInput, DraftTextarea, NumberInput } from '../components/DraftInput'

type Tab = 'actions' | 'spells' | 'inventory' | 'features' | 'notes'
type Section = 'stats' | 'skills' | Tab
type Detail =
  | { t: 'ability'; a: Ability } | { t: 'skill'; key: string } | { t: 'hp' } | { t: 'conditions' } | { t: 'short' } | { t: 'long' }
  | { t: 'attack'; i: number } | { t: 'item'; i: number } | { t: 'spell'; i: number }
type Save = (p: Partial<Character>) => unknown

const TABS: Tab[] = ['actions', 'spells', 'inventory', 'features', 'notes']
const KIND_LABEL: Record<ActionKind, string> = { action: 'Actions', bonus: 'Bonus actions', reaction: 'Reactions', other: 'Other' }

export function SheetPage() {
  const { id } = useParams()
  const c = useLiveQuery(() => db.characters.get(Number(id)), [id])
  if (c === undefined) return <div className="page"><p className="muted">Loading…</p></div>
  return <Sheet key={c.id} c={c} />
}

function Sheet({ c: stored }: { c: Character }) {
  // Edits show instantly and are written behind the scenes, so fast typing is never overwritten.
  const [c, save] = useOptimistic(stored, useCallback((patch: Partial<Character>) => db.characters.update(stored.id, { ...patch, updatedAt: Date.now() }), [stored.id]))
  const [params, setParams] = useSearchParams()
  const editing = params.get('edit') === '1'
  const [tab, setTab] = useState<Tab>('actions')
  const [section, setSection] = useState<Section>('stats')
  const [detail, setDetail] = useState<Detail | null>(null)
  const phone = useMedia('(max-width: 640px)')
  const navigate = useNavigate()
  const pb = profBonus(c.level)
  const sub = [c.species, classLine(c), `Level ${c.level}`].filter(Boolean).join(' · ')
  const show = (s: Section) => !phone || section === s
  const activeTab: Tab = phone && TABS.includes(section as Tab) ? section as Tab : tab

  const [confirmDel, setConfirmDel] = useState(false)
  async function remove() {
    await db.characters.delete(c.id)
    navigate('/characters')
  }

  return (
    <div className="page sheet">
      <Link to="/characters" className="btn ghost sm back"><ArrowLeft size={14} /> Characters</Link>
      <header className="sheet-head">
        <label className="portrait-btn" title="Change portrait">
          <Portrait c={c} />
          <span className="portrait-edit" aria-hidden="true"><Camera size={14} /></span>
          <input type="file" accept="image/*" className="visually-hidden" aria-label="Change portrait"
            onChange={async e => { const f = e.target.files?.[0]; if (f) save({ portrait: await toPortrait(f) }); e.target.value = '' }} />
        </label>
        <div className="who">
          <h1>{c.name}</h1>
          <div className="sub">{sub}</div>
        </div>
        <button className="hp-mini" onClick={() => setDetail({ t: 'hp' })} aria-label={`Hit points ${c.hpCurrent} of ${c.hpMax}. Manage`}>
          <small>Hit points</small><b className="tnum">{c.hpCurrent}<span>/{c.hpMax}</span></b>
          {c.hpTemp > 0 && <small className="tnum">+{c.hpTemp} temp</small>}
        </button>
        <div className="actions">
          <button className="btn" onClick={() => setDetail({ t: 'short' })}><Coffee size={16} /> Short rest</button>
          <button className="btn" onClick={() => setDetail({ t: 'long' })}><Bed size={16} /> Long rest</button>
          <button className={`btn ${editing ? 'primary' : ''}`} onClick={() => setParams(editing ? {} : { edit: '1' }, { replace: true })}>
            <Pencil size={16} /> {editing ? 'Done' : 'Edit'}
          </button>
        </div>
      </header>

      {editing && <DetailsEditor c={c} save={save} onDelete={() => setConfirmDel(true)} />}
      {confirmDel && <ConfirmDelete what={c.name} onCancel={() => setConfirmDel(false)} onConfirm={remove} />}

      {phone && (
        <nav className="section-bar" aria-label="Sheet sections">
          {(['stats', 'skills', ...TABS] as Section[]).map(s => (
            <button key={s} aria-current={section === s ? 'true' : undefined} onClick={() => setSection(s)}>{s === 'stats' ? 'Abilities' : s}</button>
          ))}
        </nav>
      )}

      {show('stats') && <div className="quick">
        <div className="quick-abilities">
          {ABILITIES.map(a => (
            <div key={a} className="ab-box">
              <button className="ab-name" onClick={() => setDetail({ t: 'ability', a })}>{ABILITY_NAMES[a]}</button>
              <button className="ab-mod" onClick={() => check(`${ABILITY_NAMES[a]} check`, abilityMod(c, a), c.name)}
                aria-label={`Roll ${ABILITY_NAMES[a]} check, ${fmt(abilityMod(c, a))}`}>{fmt(abilityMod(c, a))}</button>
              <span className="ab-score tnum">{c.abilities[a]}</span>
            </div>
          ))}
        </div>
        <div className="quick-misc">
          <div className="q-box"><span className="k">Proficiency</span><span className="v">{fmt(pb)}</span><span className="s">bonus</span></div>
          <div className="q-box"><span className="k">Walking</span><span className="v">{c.speed}<small>ft.</small></span><span className="s">speed</span></div>
          <button className={`q-box insp ${c.inspiration ? 'on' : ''}`} onClick={() => save({ inspiration: !c.inspiration })} aria-pressed={c.inspiration}>
            <span className="k">Heroic</span><span className="v">{c.inspiration ? '★' : '☆'}</span><span className="s">inspiration</span>
          </button>
          <HpBox c={c} save={save} onManage={() => setDetail({ t: 'hp' })} />
        </div>
      </div>}


      <div className="sheet-grid">
        {show('stats') && (
          <div className="col-a">
            <section className="box">
              <div className="saves">
                {ABILITIES.map(a => (
                  <div key={a} className="save">
                    <span className={`pdot ${c.saveProf.includes(a) ? 'on' : ''}`} role="img" aria-label={c.saveProf.includes(a) ? 'Proficient' : 'Not proficient'} />
                    <button className="save-name" onClick={() => setDetail({ t: 'ability', a })}>{a}</button>
                    <button className="rollbtn tnum" onClick={() => check(`${ABILITY_NAMES[a]} save`, saveBonus(c, a), c.name)}
                      aria-label={`Roll ${ABILITY_NAMES[a]} saving throw, ${fmt(saveBonus(c, a))}`}>{fmt(saveBonus(c, a))}</button>
                  </div>
                ))}
              </div>
              <h2 className="box-foot">Saving throws</h2>
            </section>
            <section className="box">
              {(['perception', 'investigation', 'insight'] as const).map(k => (
                <div key={k} className="passive"><b className="tnum">{passive(c, k)}</b><span>Passive {k}</span></div>
              ))}
              {c.senses && <p className="senses-text">{c.senses}</p>}
              <h2 className="box-foot">Senses</h2>
            </section>
            <section className="box">
              <Proficiencies text={c.proficiencies ?? ''} onEdit={() => setParams({ edit: '1' }, { replace: true })} />
              <h2 className="box-foot">Proficiencies &amp; training</h2>
            </section>
          </div>
        )}

        {show('skills') && (
          <section className="box col-b">
            <table className="skills-t">
              <thead><tr><th>Prof</th><th>Mod</th><th>Skill</th><th className="r">Bonus</th></tr></thead>
              <tbody>
                {SKILLS.map(s => {
                  const p = c.skillProf[s.key] ?? 0
                  return (
                    <tr key={s.key}>
                      <td><span className={`pdot ${p === 1 ? 'on' : p === 2 ? 'exp' : ''}`} role="img" aria-label={['Not proficient', 'Proficient', 'Expertise'][p]} /></td>
                      <td className="ab">{s.ability}</td>
                      <td><button className="skill-name" onClick={() => setDetail({ t: 'skill', key: s.key })}>{s.name}</button></td>
                      <td className="r"><button className="rollbtn tnum" onClick={() => check(s.name, skillBonus(c, s.key), c.name)}
                        aria-label={`Roll ${s.name}, ${fmt(skillBonus(c, s.key))}`}>{fmt(skillBonus(c, s.key))}</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <h2 className="box-foot">Skills</h2>
          </section>
        )}

        {(!phone || section !== 'skills') && (
          <div className="col-c">
            {show('stats') && (
              <div className="combat-row">
                <button className="combat-box" onClick={() => check('Initiative', initiative(c), c.name)} aria-label={`Roll initiative, ${fmt(initiative(c))}`}>
                  <span className="k">Initiative</span><span className="v">{fmt(initiative(c))}</span>
                </button>
                <div className="combat-box ac"><Shield size={58} strokeWidth={1.2} aria-hidden="true" /><span className="v">{c.ac}</span><span className="k">Armor class</span></div>
                <button className="combat-box status" onClick={() => setDetail({ t: 'conditions' })}>
                  <span className="st-col"><span className="k">Defenses</span><span className="st-v">{c.defenses || <span className="muted">None</span>}</span></span>
                  <span className="st-col"><span className="k">Conditions</span>
                    <span className="st-v">{c.conditions?.length ? c.conditions.join(', ') : <span className="muted">Add active conditions</span>}</span></span>
                </button>
              </div>
            )}
            {(!phone || TABS.includes(section as Tab)) && (
              <section className="box primary-box">
                {!phone && (
                  <div className="tabs" role="tablist">
                    {TABS.map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
                  </div>
                )}
                {activeTab === 'actions' && <Actions c={c} save={save} open={i => setDetail({ t: 'attack', i })} />}
                {activeTab === 'spells' && <Spells c={c} save={save} open={i => setDetail({ t: 'spell', i })} />}
                {activeTab === 'inventory' && <Inventory c={c} save={save} open={i => setDetail({ t: 'item', i })} />}
                {activeTab === 'features' && <Features c={c} save={save} />}
                {activeTab === 'notes' && <CharacterNotes c={c} save={save} />}
              </section>
            )}
          </div>
        )}
      </div>

      {detail && (
        <DetailPanel key={JSON.stringify(detail)} c={c} d={detail} save={save} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}

/* ---------------- Top strip ---------------- */

function HpBox({ c, save, onManage }: { c: Character; save: Save; onManage: () => void }) {
  const [amt, setAmt] = useState('')
  const n = Math.max(0, Math.floor(Number(amt) || 0))
  const done = () => setAmt('')
  return (
    <div className="q-box hpbox">
      <div className="hp-ctl">
        <button className="btn sm heal" disabled={!n} onClick={() => { applyHeal(c, n, save); done() }}><Heart size={12} /> Heal</button>
        <input className="field num-in" inputMode="numeric" value={amt} onChange={e => setAmt(e.target.value.replace(/\D/g, ''))}
          aria-label="Amount" placeholder="0" onKeyDown={e => { if (e.key === 'Enter' && n) { applyDamage(c, n, save); done() } }} />
        <button className="btn sm dmg" disabled={!n} onClick={() => { applyDamage(c, n, save); done() }}>Damage</button>
      </div>
      <button className="hp-read" onClick={onManage} aria-label="Manage hit points">
        <span className="hp-cols">
          <span><span className="k">Current</span><b className={`tnum ${c.hpCurrent <= c.hpMax / 3 ? 'low' : ''}`}>{c.hpCurrent}</b></span>
          <span className="slash">/</span>
          <span><span className="k">Max</span><b className="tnum">{c.hpMax}</b></span>
          <span><span className="k">Temp</span><b className="tnum temp">{c.hpTemp || '--'}</b></span>
        </span>
        <span className="k hp-label">Hit points</span>
      </button>
    </div>
  )
}

function applyDamage(c: Character, n: number, save: Save) {
  const fromTemp = Math.min(c.hpTemp, n)
  save({ hpTemp: c.hpTemp - fromTemp, hpCurrent: Math.max(0, c.hpCurrent - (n - fromTemp)) })
}
const applyHeal = (c: Character, n: number, save: Save) => save({ hpCurrent: Math.min(c.hpMax, c.hpCurrent + n) })

export function RollModeBar() {
  const { rollMode, setRollMode } = useUI()
  return (
    <div className="rollmode" role="group" aria-label="d20 rolls">
      <span className="muted">d20 rolls:</span>
      {(['disadvantage', 'normal', 'advantage'] as const).map(m => (
        <button key={m} className="chip" aria-pressed={rollMode === m} onClick={() => setRollMode(m)}>{m === 'normal' ? 'Normal' : m === 'advantage' ? 'Advantage' : 'Disadvantage'}</button>
      ))}
    </div>
  )
}

function Proficiencies({ text, onEdit }: { text: string; onEdit: () => void }) {
  const groups = text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const i = l.indexOf(':')
    return i > 0 ? { h: l.slice(0, i), b: l.slice(i + 1).trim() } : { h: '', b: l }
  })
  if (!groups.length) return <p className="muted small">Armor, weapons, tools and languages. <button className="linklike" onClick={onEdit}>Add them</button></p>
  return <dl className="profs">{groups.map((g, i) => <div key={i}>{g.h && <dt>{g.h}</dt>}<dd>{g.b}</dd></div>)}</dl>
}

/* ---------------- Rest & edit ---------------- */

function ShortRest({ c, save, onClose }: { c: Character; save: Save; onClose: () => void }) {
  const list = classesOf(c)
  const left = hitDiceLeft(c)
  // How many dice of each class to spend.
  const [pick, setPick] = useState<number[]>(() => list.map(() => 0))
  const [auto, setAuto] = useState(true)
  const n = pick.reduce((a, b) => a + b, 0)
  const con = abilityMod(c, 'con')
  const pactReset = shortRestSlots(list)
  function take() {
    let heal = 0
    list.forEach((k, i) => {
      for (let j = 0; j < pick[i]; j++) {
        const r = roll(k.hitDie, 1, con, 'normal', `Hit die (${k.name || 'class'})`)
        record({ ...r, who: c.name })
        heal += Math.max(0, r.total)
      }
    })
    save({
      ...withClasses(list.map((k, i) => ({ ...k, used: k.used + pick[i] }))),
      hpCurrent: auto ? Math.min(c.hpMax, c.hpCurrent + heal) : c.hpCurrent,
      resources: c.resources.map(r => r.rest === 'short' ? { ...r, used: 0 } : r),
      ...(pactReset ? { slotsUsed: [] } : {}),
    })
    onClose()
  }
  const short = c.resources.filter(r => r.rest === 'short')
  const formula = list.map((k, i) => pick[i] ? `${pick[i]}d${k.hitDie}` : '').filter(Boolean).join(' + ')
  return (
    <Drawer title="Short rest" onClose={onClose}>
      <p className="muted">At least an hour of light activity. Spend hit dice to heal: each adds {fmt(con)} (Constitution).</p>
      <label className="lab">Hit dice to spend <span className="tnum">({left} of {c.level} left)</span></label>
      {left === 0 ? <p className="muted small">No hit dice left. A long rest gets them back.</p> : list.map((k, i) => {
        const avail = Math.max(0, k.level - k.used)
        return (
          <div key={i} className="hd-class">
            {list.length > 1 && <span className="small muted">{k.name || 'Class'} · {avail} of {k.level}</span>}
            <div className="hd-pick" role="group" aria-label={`${k.name} hit dice`}>
              {Array.from({ length: avail }, (_, j) => {
                const on = j < pick[i]
                return <button key={j} className={`hd ${on ? 'on' : ''}`} aria-pressed={on}
                  onClick={() => setPick(pick.map((x, q) => q === i ? (on ? j : j + 1) : x))}>d{k.hitDie}</button>
              })}
              {avail === 0 && <span className="muted small">none left</span>}
            </div>
          </div>
        )
      })}
      <label className="check" style={{ marginTop: 12 }}><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> Apply the healing automatically</label>
      <h3 className="group-h">What resets</h3>
      <p className="small">{[...short.map(r => r.name), ...(pactReset && (c.slots ?? []).some(Boolean) ? ['Pact Magic spell slots'] : [])].join(', ') || 'Nothing on this sheet recharges on a short rest.'}</p>
      <div className="drawer-foot">
        <button className="btn ghost" onClick={() => setPick(list.map(() => 0))} disabled={!n}>Reset</button>
        <button className="btn primary grow-btn" onClick={take}>Take short rest{n ? ` · roll ${formula}` : ''}</button>
      </div>
    </Drawer>
  )
}

function LongRest({ c, save, onClose }: { c: Character; save: Save; onClose: () => void }) {
  const [all, setAll] = useState(true)
  const list = classesOf(c)
  const spent = list.reduce((t, k) => t + k.used, 0)
  const regain = all ? spent : Math.min(spent, Math.max(1, Math.floor(c.level / 2)))
  function take() {
    // Give back the largest dice first when only some come back.
    let left = regain
    const order = list.map((k, i) => ({ k, i })).sort((a, b) => b.k.hitDie - a.k.hitDie)
    const used = list.map(k => k.used)
    for (const { i } of order) { const back = Math.min(used[i], left); used[i] -= back; left -= back }
    save({ ...withClasses(list.map((k, i) => ({ ...k, used: used[i] }))), hpCurrent: c.hpMax, hpTemp: 0, resources: c.resources.map(r => ({ ...r, used: 0 })), slotsUsed: [] })
    onClose()
  }
  return (
    <Drawer title="Long rest" onClose={onClose}>
      <p className="muted">At least eight hours, mostly sleeping.</p>
      <label className="lab">Hit dice</label>
      <label className="radio"><input type="radio" name="hd" checked={all} onChange={() => setAll(true)} /> Regain all spent hit dice (2024 rules)</label>
      <label className="radio"><input type="radio" name="hd" checked={!all} onChange={() => setAll(false)} /> Regain half your level, minimum 1 (2014 rules)</label>
      <h3 className="group-h">Benefits of the rest</h3>
      <ul className="benefits">
        <li>Hit points to maximum <span className="tnum muted">({c.hpCurrent} → {c.hpMax})</span></li>
        <li>Temporary hit points cleared</li>
        <li>Regain <b className="tnum">{regain}</b> hit {regain === 1 ? 'die' : 'dice'} <span className="tnum muted">({hitDiceLeft(c)} → {hitDiceLeft(c) + regain} of {c.level})</span></li>
        <li>{c.resources.length ? `Resets ${c.resources.map(r => r.name).join(', ')}` : 'All limited-use resources reset'}</li>
        {(c.slots ?? []).some(Boolean) && <li>All spell slots restored</li>}
      </ul>
      <div className="drawer-foot"><button className="btn primary grow-btn" onClick={take}>Take long rest</button></div>
    </Drawer>
  )
}

function ClassesEditor({ c, save }: { c: Character; save: Save }) {
  const list = classesOf(c, true)
  const set = (i: number, patch: Partial<ClassLevel>) => save(withClasses(list.map((k, j) => j === i ? { ...k, ...patch } : k)))
  return (
    <div className="classes-ed">
      <label className="lab">Classes <span className="muted small">· total level {c.level}, proficiency {fmt(profBonus(c.level))}</span></label>
      {list.map((k, i) => (
        <div key={i} className="class-row">
          <DraftInput className="field" list="class-list" aria-label="Class" placeholder="Class" value={k.name}
            onValue={v => { const info = CLASSES.find(x => x.name.toLowerCase() === v.toLowerCase()); set(i, { name: v, ...(info ? { hitDie: info.hitDie } : {}) }) }} />
          <DraftInput className="field" aria-label="Subclass" placeholder="Subclass" value={k.subclass} onValue={v => set(i, { subclass: v })} />
          <label className="cr-lvl"><span className="small muted">Lvl</span>
            <NumberInput className="field num-in" aria-label={`${k.name || 'Class'} level`} value={k.level} min={1} max={20}
              onNumber={n => set(i, { level: n })} /></label>
          <label className="cr-lvl"><span className="small muted">d</span>
            <select className="field" aria-label="Hit die" value={k.hitDie} onChange={e => set(i, { hitDie: Number(e.target.value) })}>
              {[6, 8, 10, 12].map(d => <option key={d} value={d}>{d}</option>)}
            </select></label>
          {list.length > 1 && <button className="btn ghost sm" aria-label={`Remove ${k.name || 'class'}`} onClick={() => save(withClasses(list.filter((_, j) => j !== i)))}><Trash2 size={16} /></button>}
        </div>
      ))}
      <datalist id="class-list">{CLASSES.map(x => <option key={x.name} value={x.name} />)}</datalist>
      <button className="btn sm" onClick={() => save(withClasses([...list, { name: '', subclass: '', level: 1, hitDie: 8, used: 0 }]))}><Plus size={14} /> Add another class</button>
      {list.length > 1 && <p className="muted small">Multiclassing: check your book for the ability score requirements and which proficiencies a new class grants.</p>}
    </div>
  )
}

function DetailsEditor({ c, save, onDelete }: { c: Character; save: Save; onDelete: () => void }) {
  const text = (k: keyof Character, label: string, list?: string[]) => (
    <div>
      <label className="lab" htmlFor={`f-${k}`}>{label}</label>
      <DraftInput id={`f-${k}`} className="field" list={list ? `l-${k}` : undefined} value={String(c[k] ?? '')}
        onValue={v => save({ [k]: v } as Partial<Character>)} />
      {list && <datalist id={`l-${k}`}>{list.map(x => <option key={x} value={x} />)}</datalist>}
    </div>
  )
  const number = (k: keyof Character, label: string) => (
    <div>
      <label className="lab" htmlFor={`f-${k}`}>{label}</label>
      <NumberInput id={`f-${k}`} className="field" value={Number(c[k] ?? 0)} min={0}
        onNumber={n => save({ [k]: n } as Partial<Character>)} />
    </div>
  )
  const area = (k: 'proficiencies' | 'senses' | 'defenses', label: string, hint: string) => (
    <div>
      <label className="lab" htmlFor={`f-${k}`}>{label}</label>
      <DraftTextarea id={`f-${k}`} className="field area" rows={k === 'proficiencies' ? 4 : 2} placeholder={hint} value={c[k] ?? ''}
        onValue={v => save({ [k]: v })} />
    </div>
  )
  return (
    <section className="panel editor-panel">
      <div className="panel-h"><h2>Edit sheet</h2><small className="muted">Free-write: change anything, it saves as you type.</small></div>
      <div className="form-grid">
        {text('name', 'Name')}
        {text('player', 'Player')}
        {text('species', 'Species', SPECIES.map(s => s.name))}
        {text('background', 'Background')}
        {text('alignment', 'Alignment', ALIGNMENTS)}
        {number('hpMax', 'Max HP')}
        {number('ac', 'Armor class')}
        {number('speed', 'Speed (ft.)')}
        <div>
          <label className="lab" htmlFor="f-init">Initiative bonus</label>
          <NumberInput id="f-init" className="field" value={c.initiativeBonus} min={-10} max={30}
            onNumber={n => save({ initiativeBonus: n })} />
        </div>
      </div>
      <ClassesEditor c={c} save={save} />
      <label className="lab">Ability scores and saving throw proficiency</label>
      <div className="scores">
        {ABILITIES.map((a: Ability) => (
          <div key={a} className="score">
            <label className="lab" htmlFor={`ab-${a}`} style={{ margin: 0 }}>{a}</label>
            <NumberInput id={`ab-${a}`} value={c.abilities[a]} min={1} max={30}
              onNumber={n => save({ abilities: { ...c.abilities, [a]: n } })} />
            <span className="m">{fmt(mod(c.abilities[a]))}</span>
            <label className="check"><input type="checkbox" checked={c.saveProf.includes(a)}
              onChange={e => save({ saveProf: e.target.checked ? [...c.saveProf, a] : c.saveProf.filter(x => x !== a) })} /> Save</label>
          </div>
        ))}
      </div>
      <div className="form-grid wide-areas">
        {area('proficiencies', 'Proficiencies & training', 'Armor: Light, Medium\nWeapons: Simple, Martial\nTools: …\nLanguages: Common, …')}
        {area('senses', 'Senses', 'Darkvision 60 ft.')}
        {area('defenses', 'Defenses', 'Resistant to fire')}
      </div>
      <p className="muted small">Skill proficiency: tap a skill name on the sheet. Portrait: tap the picture in the header.
        {c.portrait && <> <button className="linklike" onClick={() => save({ portrait: undefined })}>Remove portrait</button></>}</p>
      <div className="foot"><span /><button className="btn ghost" onClick={onDelete}><Trash2 size={16} /> Delete character</button></div>
    </section>
  )
}

/* ---------------- Tabs ---------------- */

function Chips<T extends string>({ value, set, options }: { value: T; set: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="filter-chips" role="group" aria-label="Filter">
      {options.map(([v, l]) => <button key={v} className="fchip" aria-pressed={value === v} onClick={() => set(v)}>{l}</button>)}
    </div>
  )
}

function Actions({ c, save, open }: { c: Character; save: Save; open: (i: number) => void }) {
  const [f, setF] = useState<'all' | ActionKind | 'limited'>('all')
  const kinds: ActionKind[] = ['action', 'bonus', 'reaction', 'other']
  const add = () => { save({ attacks: [...c.attacks, { name: 'New attack', bonus: '+0', damage: '1d6', notes: '', kind: f !== 'all' && f !== 'limited' ? f : 'action' }] }); open(c.attacks.length) }
  return (
    <>
      <div className="tab-tools">
        <Chips value={f} set={setF} options={[['all', 'All'], ['action', 'Attack'], ['bonus', 'Bonus action'], ['reaction', 'Reaction'], ['other', 'Other'], ['limited', 'Limited use']]} />
        <button className="btn sm" onClick={add}><Plus size={14} /> Add</button>
      </div>
      <RollModeBar />
      {kinds.filter(k => f === 'all' || f === k).map(k => {
        const rows = c.attacks.map((a, i) => ({ a, i })).filter(({ a }) => (a.kind ?? 'action') === k)
        if (!rows.length && f !== k) return null
        return (
          <div key={k} className="act-group">
            <h3 className="group-h">{KIND_LABEL[k]}{k === 'action' && <span className="muted"> · attacks per action: 1</span>}</h3>
            {rows.length === 0 ? <p className="muted small">Nothing here. Use Add to create one.</p> : (
              <div className="table-wrap"><table className="t attacks">
                <thead><tr><th>Attack</th><th className="hide-s">Range</th><th>Hit</th><th>Damage</th><th className="hide-m">Notes</th></tr></thead>
                <tbody>
                  {rows.map(({ a, i }) => (
                    <tr key={i}>
                      <td><button className="row-name" onClick={() => open(i)}>{a.name || 'Unnamed'}</button>
                        <small className="muted block show-m-only">{[a.range, a.notes].filter(Boolean).join(' · ')}</small></td>
                      <td className="hide-s tnum">{a.range || '—'}</td>
                      <td><button className="rollbtn tnum" onClick={() => check(`${a.name} to hit`, parseInt(a.bonus) || 0, c.name)}>{a.bonus || '+0'}</button></td>
                      <td><button className="rollbtn" onClick={() => rollDamage(`${a.name} damage`, a.damage, c.name)}>{a.damage || '—'}</button></td>
                      <td className="muted small hide-m">{a.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        )
      })}
      {(f === 'all' || f === 'limited') && <Resources c={c} save={save} />}
    </>
  )
}

function Resources({ c, save }: { c: Character; save: Save }) {
  const setRes = (i: number, patch: Partial<Character['resources'][number]>) =>
    save({ resources: c.resources.map((x, j) => j === i ? { ...x, ...patch } : x) })
  const [edit, setEdit] = useState(false)
  return (
    <div className="act-group">
      <h3 className="group-h">Limited use <button className="btn ghost sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Edit'}</button></h3>
      {c.resources.length === 0 && <p className="muted small">Spell slots, rages, channel divinity: anything with charges.</p>}
      {c.resources.map((r, i) => (
        <div key={i} className="res-row">
          {edit ? <DraftInput className="field grow" aria-label="Resource name" value={r.name} onValue={v => setRes(i, { name: v })} />
            : <span className="grow"><b>{r.name}</b> <small className="muted">· {r.rest} rest</small></span>}
          <div className="pips" role="group" aria-label={`${r.name}: ${r.max - r.used} of ${r.max} left`}>
            {Array.from({ length: r.max }, (_, k) => (
              <button key={k} className={`pip ${k < r.used ? 'used' : ''}`} aria-label={k < r.used ? 'Restore one use' : 'Use one'}
                onClick={() => setRes(i, { used: k < r.used ? k : k + 1 })} />
            ))}
          </div>
          {edit && <>
            <NumberInput className="field num-in" aria-label="Maximum uses" value={r.max} min={0} max={20}
              onNumber={n => setRes(i, { max: n, used: Math.min(r.used, n) })} />
            <select className="field" style={{ width: 'auto' }} aria-label="Recharges on" value={r.rest} onChange={e => setRes(i, { rest: e.target.value as 'short' | 'long' })}>
              <option value="short">Short rest</option><option value="long">Long rest</option>
            </select>
            <button className="btn ghost sm" aria-label={`Remove ${r.name}`} onClick={() => save({ resources: c.resources.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>
          </>}
        </div>
      ))}
      {edit && <button className="btn sm" onClick={() => save({ resources: [...c.resources, { name: 'New resource', max: 1, used: 0, rest: 'long' }] })}><Plus size={14} /> Add resource</button>}
    </div>
  )
}

function Spells({ c, save, open }: { c: Character; save: Save; open: (i: number) => void }) {
  const [f, setF] = useState<'all' | number>('all')
  const [q, setQ] = useState('')
  const spells = c.spells ?? []
  const cls = classesOf(c)
  const table = slotsForClasses(cls)
  const pact = separatePact(cls)
  const ab = (c.spellAbility || cls.map(k => CASTING_ABILITY[k.name]).find(Boolean) || '') as Ability | ''
  const slots = c.slots ?? [], used = c.slotsUsed ?? []
  const m = ab ? abilityMod(c, ab) : 0, pb = profBonus(c.level)
  const levels = [...new Set([...spells.map(s => s.level), ...slots.map((n, i) => n ? i : -1).filter(i => i > 0)])].sort((a, b) => a - b)
  const setUsed = (lvl: number, n: number) => { const u = [...used]; while (u.length < 10) u.push(0); u[lvl] = n; save({ slotsUsed: u }) }
  const add = (lvl: number) => { save({ spells: [...spells, { name: 'New spell', level: lvl, prepared: true }] }); open(spells.length) }
  if (!ab && !spells.length) {
    return (
      <div className="empty">
        <h3>No spellcasting</h3>
        <p>{c.className || 'This character'} has no spells yet. Set a spellcasting ability to start, or add a spell from a species trait or feat.</p>
        <div className="actions-row center">
          {ABILITIES.map(a => <button key={a} className="btn sm" onClick={() => save({ spellAbility: a })}>{ABILITY_NAMES[a]}</button>)}
        </div>
      </div>
    )
  }
  return (
    <>
      <div className="spell-head">
        <label className="sh-box"><span className="k">Ability</span>
          <select className="field" value={ab} onChange={e => save({ spellAbility: e.target.value as Ability })} aria-label="Spellcasting ability">
            <option value="">None</option>{ABILITIES.map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
          </select></label>
        <div className="sh-box"><span className="k">Modifier</span><b className="tnum">{fmt(m)}</b></div>
        <button className="sh-box" onClick={() => check('Spell attack', m + pb, c.name)}><span className="k">Spell attack</span><b className="tnum">{fmt(m + pb)}</b></button>
        <div className="sh-box"><span className="k">Save DC</span><b className="tnum">{8 + m + pb}</b></div>
      </div>
      <div className="tab-tools">
        <Chips value={String(f)} set={v => setF(v === 'all' ? 'all' : Number(v))} options={[['all', 'All'], ...levels.map(l => [String(l), l === 0 ? 'Cantrip' : `${l}`] as [string, string])]} />
        <div className="actions-row">
          {table.some(Boolean) && slots.slice(0, 10).join() !== table.join() &&
            <button className="btn sm ghost" onClick={() => save({ slots: table, slotsUsed: [] })} title={`Use the slot table for ${classLine(c)}`}>Set slots from class</button>}
          {pact && !c.resources.some(r => /pact magic/i.test(r.name)) &&
            <button className="btn sm ghost" onClick={() => save({ resources: [...c.resources, { name: `Pact Magic slots (level ${pact.level})`, max: pact.count, used: 0, rest: 'short' }] })}>Add Pact Magic slots</button>}
          <button className="btn sm" onClick={() => add(f === 'all' ? 0 : f)}><Plus size={14} /> Add spell</button>
        </div>
      </div>
      <div className="search-row"><Search size={16} aria-hidden="true" />
        <input className="field" type="search" placeholder="Search spells" value={q} onChange={e => setQ(e.target.value)} aria-label="Search spells" /></div>
      {levels.filter(l => f === 'all' || f === l).map(l => {
        const rows = spells.map((sp, i) => ({ sp, i })).filter(({ sp }) => sp.level === l && (!q.trim() || sp.name.toLowerCase().includes(q.trim().toLowerCase())))
        const max = slots[l] ?? 0, u = used[l] ?? 0
        return (
          <div key={l} className="act-group">
            <h3 className="group-h">{LEVEL_NAME[l]}
              {l > 0 && (
                <span className="slot-row">
                  {max > 0 && <span className="muted small tnum">{max - u} of {max} slots</span>}
                  <span className="pips" role="group" aria-label={`${LEVEL_NAME[l]} slots`}>
                    {Array.from({ length: max }, (_, k) => (
                      <button key={k} className={`pip sq ${k < u ? 'used' : ''}`} aria-label={k < u ? 'Restore a slot' : 'Spend a slot'} onClick={() => setUsed(l, k < u ? k : k + 1)} />
                    ))}
                  </span>
                  <span className="slot-edit">
                    <button className="btn ghost sm" aria-label={`Fewer ${LEVEL_NAME[l]} slots`} onClick={() => { const s2 = [...slots]; while (s2.length < 10) s2.push(0); s2[l] = Math.max(0, max - 1); save({ slots: s2 }) }}>−</button>
                    <button className="btn ghost sm" aria-label={`More ${LEVEL_NAME[l]} slots`} onClick={() => { const s2 = [...slots]; while (s2.length < 10) s2.push(0); s2[l] = Math.min(9, max + 1); save({ slots: s2 }) }}>+</button>
                  </span>
                </span>
              )}
              {l === 0 && <span className="muted small">at will</span>}
            </h3>
            {rows.length === 0 ? <p className="muted small">No {l === 0 ? 'cantrips' : `${LEVEL_NAME[l]} spells`}{q ? ' match' : ' yet'}. <button className="linklike" onClick={() => add(l)}>Add one</button></p> : (
              <div className="table-wrap"><table className="t spells">
                <thead><tr>{l > 0 && <th aria-label="Prepared">Prep</th>}<th>Name</th><th>Time</th><th className="hide-s">Range</th><th className="hide-m">Hit / DC</th><th className="hide-m">Duration</th></tr></thead>
                <tbody>
                  {rows.map(({ sp, i }) => (
                    <tr key={i} className={sp.prepared || l === 0 ? '' : 'unprepared'}>
                      {l > 0 && <td><input type="checkbox" checked={sp.prepared} aria-label={`${sp.name} prepared`}
                        onChange={e => save({ spells: spells.map((x, j) => j === i ? { ...x, prepared: e.target.checked } : x) })} /></td>}
                      <td><button className="row-name" onClick={() => open(i)}>{sp.name}</button>
                        {sp.concentration && <span className="tag-c" title="Concentration">C</span>}{sp.ritual && <span className="tag-c" title="Ritual">R</span>}
                        {sp.source && <small className="muted block">{sp.source}</small>}</td>
                      <td className="small">{sp.time || '—'}</td>
                      <td className="small hide-s">{sp.range || '—'}</td>
                      <td className="hide-m">{sp.hit ? <button className="rollbtn" onClick={() => /^[+-]?\d+$/.test(sp.hit!) ? check(`${sp.name} attack`, parseInt(sp.hit!), c.name) : rollDamage(sp.name, sp.hit!, c.name)}>{sp.hit}</button> : <span className="muted">—</span>}</td>
                      <td className="small hide-m">{sp.duration || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        )
      })}
      <div className="actions-row" style={{ marginTop: 10 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(l => !levels.includes(l)).slice(0, 3).map(l => (
          <button key={l} className="btn ghost sm" onClick={() => add(l)}><Plus size={14} /> {l === 0 ? 'Cantrip' : `${LEVEL_NAME[l]} spell`}</button>
        ))}
      </div>
    </>
  )
}

function Inventory({ c, save, open }: { c: Character; save: Save; open: (i: number) => void }) {
  const [q, setQ] = useState('')
  const [f, setF] = useState<'all' | 'equipped' | 'pack'>('all')
  const total = c.inventory.reduce((s, i) => s + i.qty * i.weight, 0)
  const cap = c.abilities.str * 15
  const rows = c.inventory.map((it, i) => ({ it, i }))
    .filter(({ it }) => f === 'all' || (f === 'equipped' ? it.equipped : !it.equipped))
    .filter(({ it }) => !q.trim() || `${it.name} ${it.notes ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  const setItem = (i: number, patch: Partial<Item>) => save({ inventory: c.inventory.map((x, j) => j === i ? { ...x, ...patch } : x) })
  const gpTotal = c.coins.pp * 10 + c.coins.gp + c.coins.ep / 2 + c.coins.sp / 10 + c.coins.cp / 100
  return (
    <>
      <div className="inv-head">
        <div><b className="tnum">Weight carried: {Math.round(total * 10) / 10} lb.</b><small className="muted block">{total > cap ? 'Over capacity' : `Capacity ${cap} lb.`}</small></div>
        <div className="coin-total tnum" title="Total wealth in gold">{Math.round(gpTotal * 100) / 100} gp</div>
      </div>
      <div className="coins">
        {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map(k => (
          <label key={k} className="coin"><span>{k}</span>
            <NumberInput className="field tnum" value={c.coins[k]} min={0}
              onNumber={n => save({ coins: { ...c.coins, [k]: n } })} /></label>
        ))}
      </div>
      <div className="search-row">
        <Search size={16} aria-hidden="true" />
        <input className="field" type="search" placeholder="Search items" value={q} onChange={e => setQ(e.target.value)} aria-label="Search items" />
      </div>
      <div className="tab-tools">
        <Chips value={f} set={setF} options={[['all', 'All'], ['equipped', 'Equipped'], ['pack', 'Backpack']]} />
        <button className="btn sm" onClick={() => { save({ inventory: [...c.inventory, { name: 'New item', qty: 1, weight: 0, equipped: false }] }); open(c.inventory.length) }}><Plus size={14} /> Add item</button>
      </div>
      <div className="table-wrap"><table className="t inv">
        <thead><tr><th>Active</th><th>Name</th><th className="r">Weight</th><th className="r">Qty</th><th className="hide-m">Notes</th></tr></thead>
        <tbody>
          {rows.map(({ it, i }) => (
            <tr key={i}>
              <td><input type="checkbox" aria-label={`Equip ${it.name}`} checked={it.equipped} onChange={e => setItem(i, { equipped: e.target.checked })} /></td>
              <td><button className="row-name" onClick={() => open(i)}>{it.name}</button></td>
              <td className="r tnum muted">{it.weight ? `${it.weight} lb.` : '—'}</td>
              <td className="r tnum">{it.qty}</td>
              <td className="hide-m muted small">{it.notes}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="muted">{c.inventory.length ? 'No items match.' : 'Nothing carried yet.'}</td></tr>}
        </tbody>
      </table></div>
    </>
  )
}

/** Split DDB-style feature text ("=== HEADING ===", "* Feature") into sections. */
function parseFeatures(text: string) {
  const sections: { title: string; items: { name: string; body: string }[] }[] = []
  let cur = { title: 'Features', items: [] as { name: string; body: string }[] }
  let item: { name: string; body: string } | null = null
  const flush = () => { if (item) cur.items.push(item); item = null }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const h = line.match(/^===\s*(.+?)\s*===$/)
    if (h) { flush(); if (cur.items.length) sections.push(cur); cur = { title: h[1].toLowerCase().replace(/\b\w/g, x => x.toUpperCase()), items: [] }; continue }
    const it = line.match(/^\*\s+(.+)$/)
    if (it) { flush(); item = { name: it[1].replace(/\s*•.*$/, ''), body: '' }; continue }
    if (!item) { if (line) item = { name: '', body: line }; continue }
    item.body += (item.body ? '\n' : '') + line
  }
  flush(); if (cur.items.length) sections.push(cur)
  return sections
}

function Features({ c, save }: { c: Character; save: Save }) {
  const [edit, setEdit] = useState(false)
  const sections = useMemo(() => parseFeatures(c.features), [c.features])
  const [f, setF] = useState('all')
  return (
    <>
      <div className="tab-tools">
        {sections.length > 1 ? <Chips value={f} set={setF} options={[['all', 'All'], ...sections.map(s => [s.title, s.title] as [string, string])]} /> : <span />}
        <button className="btn sm" onClick={() => setEdit(!edit)}>{edit ? 'Done' : <><Pencil size={14} /> Edit</>}</button>
      </div>
      {edit ? (
        <>
          <DraftTextarea className="field area mono" rows={16} value={c.features} aria-label="Features and traits"
            onValue={v => save({ features: v })} />
          <p className="muted small">Use <code>=== Heading ===</code> for groups and <code>* Name</code> to start each feature.</p>
        </>
      ) : sections.length === 0 ? <p className="muted">No features yet. Use Edit to add class features, species traits and feats.</p> : (
        sections.filter(s => f === 'all' || s.title === f).map(s => (
          <div key={s.title} className="feat-section">
            <h3 className="group-h">{s.title}</h3>
            {s.items.map((it, i) => (
              <div key={i} className="feat">
                {it.name && <h4>{it.name}</h4>}
                {it.body && <p>{it.body}</p>}
              </div>
            ))}
          </div>
        ))
      )}
    </>
  )
}

function CharacterNotes({ c, save }: { c: Character; save: Save }) {
  const notes = useLiveQuery(() => db.notes.where('characterId').equals(c.id).toArray(), [c.id], [] as Note[])
  const campaignId = useUI(s => s.campaignId)
  const navigate = useNavigate()
  async function newNote() {
    const cid = c.campaignId ?? campaignId
    if (!cid) return
    const now = Date.now()
    const title = `${c.name}: notes`
    const id = await db.notes.add({ campaignId: cid, characterId: c.id, title, body: `# ${title}\n\n`, kind: 'character', tags: [], createdAt: now, updatedAt: now })
    navigate(`/notes/${id}`)
  }
  const area = (k: 'traits' | 'ideals' | 'bonds' | 'flaws' | 'backstory', label: string, rows = 3) => (
    <div><label className="lab" htmlFor={`n-${k}`}>{label}</label>
      <DraftTextarea id={`n-${k}`} className="field area" rows={rows} value={c[k]} onValue={v => save({ [k]: v })} /></div>
  )
  return (
    <>
      <div className="tab-tools">
        <h3 className="group-h" style={{ margin: 0 }}>Linked notes</h3>
        <button className="btn sm primary" onClick={newNote}><Plus size={14} /> New linked note</button>
      </div>
      {notes.length === 0 ? <p className="muted">Session journals, secrets, goals. Notes made here stay linked to {c.name}.</p>
        : notes.map(n => <Link key={n.id} to={`/notes/${n.id}`} className="row link-row"><span className="grow">{n.title}</span></Link>)}
      <div className="form-grid two">
        {area('traits', 'Personality traits')}
        {area('ideals', 'Ideals')}
        {area('bonds', 'Bonds')}
        {area('flaws', 'Flaws')}
      </div>
      {area('backstory', 'Backstory', 8)}
    </>
  )
}

/* ---------------- Detail drawer ---------------- */

function DetailPanel({ c, d, save, onClose }: { c: Character; d: Detail; save: Save; onClose: () => void }) {
  const pb = profBonus(c.level)
  if (d.t === 'ability') {
    const a = d.a, m = abilityMod(c, a), prof = c.saveProf.includes(a)
    return (
      <Drawer title={<>{ABILITY_NAMES[a]} <span className="tnum">{c.abilities[a]}</span> <small className="muted">({fmt(m)})</small></>} onClose={onClose}>
        <div className="actions-row">
          <button className="btn primary" onClick={() => check(`${ABILITY_NAMES[a]} check`, m, c.name)}>Roll check {fmt(m)}</button>
          <button className="btn" onClick={() => check(`${ABILITY_NAMES[a]} save`, saveBonus(c, a), c.name)}>Roll save {fmt(saveBonus(c, a))}</button>
        </div>
        <table className="calc">
          <tbody>
            <tr><th>Score</th><td><NumberInput className="field num-in" aria-label="Score" value={c.abilities[a]} min={1} max={30}
              onNumber={n => save({ abilities: { ...c.abilities, [a]: n } })} /></td></tr>
            <tr><th>Modifier</th><td className="tnum">{fmt(m)}</td></tr>
            <tr><th>Saving throw</th><td><label className="check"><input type="checkbox" checked={prof}
              onChange={e => save({ saveProf: e.target.checked ? [...c.saveProf, a] : c.saveProf.filter(x => x !== a) })} /> Proficient {prof && `(+${pb})`}</label></td></tr>
          </tbody>
        </table>
        <h3 className="group-h">Skills using {ABILITY_NAMES[a]}</h3>
        {SKILLS.filter(s => s.ability === a).map(s => (
          <div key={s.key} className="row">
            <span className="grow">{s.name}</span>
            <button className="rollbtn tnum" onClick={() => check(s.name, skillBonus(c, s.key), c.name)}>{fmt(skillBonus(c, s.key))}</button>
          </div>
        ))}
        {SKILLS.every(s => s.ability !== a) && <p className="muted small">None. {ABILITY_NAMES[a]} is used for checks and saves.</p>}
      </Drawer>
    )
  }
  if (d.t === 'skill') {
    const s = SKILLS.find(x => x.key === d.key)!, p = c.skillProf[s.key] ?? 0
    return (
      <Drawer title={<>{s.name} <small className="muted">({ABILITY_NAMES[s.ability]})</small></>} onClose={onClose}>
        <button className="btn primary" onClick={() => check(s.name, skillBonus(c, s.key), c.name)}>Roll {fmt(skillBonus(c, s.key))}</button>
        <label className="lab">Proficiency</label>
        <div className="seg" role="group" aria-label="Proficiency">
          {(['None', 'Proficient', 'Expertise'] as const).map((l, i) => (
            <button key={l} aria-pressed={p === i} onClick={() => save({ skillProf: { ...c.skillProf, [s.key]: i as 0 | 1 | 2 } })}>{l}</button>
          ))}
        </div>
        <table className="calc">
          <tbody>
            <tr><th>{ABILITY_NAMES[s.ability]} modifier</th><td className="tnum">{fmt(abilityMod(c, s.ability))}</td></tr>
            <tr><th>Proficiency {p === 2 ? '× 2' : ''}</th><td className="tnum">{fmt(p * pb)}</td></tr>
            <tr className="total"><th>Total</th><td className="tnum">{fmt(skillBonus(c, s.key))}</td></tr>
            <tr><th>Passive</th><td className="tnum">{10 + skillBonus(c, s.key)}</td></tr>
          </tbody>
        </table>
      </Drawer>
    )
  }
  if (d.t === 'hp') return <HpDetail c={c} save={save} onClose={onClose} />
  if (d.t === 'short') return <ShortRest c={c} save={save} onClose={onClose} />
  if (d.t === 'long') return <LongRest c={c} save={save} onClose={onClose} />
  if (d.t === 'conditions') {
    const cur = c.conditions ?? []
    return (
      <Drawer title="Defenses & conditions" onClose={onClose}>
        <label className="lab">Active conditions</label>
        <div className="chips">
          {CONDITIONS.map(k => (
            <button key={k} className="chip" aria-pressed={cur.includes(k)}
              onClick={() => save({ conditions: cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k] })}>{k}</button>
          ))}
        </div>
        <label className="lab" htmlFor="def">Defenses</label>
        <DraftTextarea id="def" className="field area" rows={3} value={c.defenses ?? ''} placeholder="Resistances, immunities, save modifiers"
          onValue={v => save({ defenses: v })} />
      </Drawer>
    )
  }
  if (d.t === 'attack') {
    const a = c.attacks[d.i]
    if (!a) return null
    const set = (patch: Partial<Attack>) => save({ attacks: c.attacks.map((x, j) => j === d.i ? { ...x, ...patch } : x) })
    return (
      <Drawer title={a.name || 'Attack'} onClose={onClose}>
        <div className="actions-row">
          <button className="btn primary" onClick={() => check(`${a.name} to hit`, parseInt(a.bonus) || 0, c.name)}>To hit {a.bonus}</button>
          <button className="btn" onClick={() => rollDamage(`${a.name} damage`, a.damage, c.name)}>Damage {a.damage}</button>
        </div>
        <label className="lab" htmlFor="at-n">Name</label><DraftInput id="at-n" className="field" value={a.name} onValue={v => set({ name: v })} />
        <div className="form-grid two">
          <div><label className="lab" htmlFor="at-k">Type</label>
            <select id="at-k" className="field" value={a.kind ?? 'action'} onChange={e => set({ kind: e.target.value as ActionKind })}>
              <option value="action">Action</option><option value="bonus">Bonus action</option><option value="reaction">Reaction</option><option value="other">Other</option>
            </select></div>
          <div><label className="lab" htmlFor="at-r">Range</label><DraftInput id="at-r" className="field" placeholder="5 ft. or 30/120" value={a.range ?? ''} onValue={v => set({ range: v })} /></div>
          <div><label className="lab" htmlFor="at-b">To hit / DC</label><DraftInput id="at-b" className="field" placeholder="+5" value={a.bonus} onValue={v => set({ bonus: v })} /></div>
          <div><label className="lab" htmlFor="at-d">Damage</label><DraftInput id="at-d" className="field" placeholder="1d8+3 slashing" value={a.damage} onValue={v => set({ damage: v })} /></div>
        </div>
        <label className="lab" htmlFor="at-no">Notes</label><DraftTextarea id="at-no" className="field area" rows={3} value={a.notes} onValue={v => set({ notes: v })} />
        <div className="foot"><span /><button className="btn ghost" onClick={() => { save({ attacks: c.attacks.filter((_, j) => j !== d.i) }); onClose() }}><Trash2 size={16} /> Remove</button></div>
      </Drawer>
    )
  }
  if (d.t === 'spell') {
    const sp = (c.spells ?? [])[d.i]
    if (!sp) return null
    const set = (patch: Partial<Spell>) => save({ spells: (c.spells ?? []).map((x, j) => j === d.i ? { ...x, ...patch } : x) })
    const txt = (k: 'time' | 'range' | 'components' | 'duration' | 'hit' | 'source', label: string, ph: string) => (
      <div><label className="lab" htmlFor={`sp-${k}`}>{label}</label><DraftInput id={`sp-${k}`} className="field" placeholder={ph} value={sp[k] ?? ''} onValue={v => set({ [k]: v })} /></div>
    )
    return (
      <Drawer title={sp.name || 'Spell'} onClose={onClose}>
        <label className="lab" htmlFor="sp-n">Name</label><DraftInput id="sp-n" className="field" value={sp.name} onValue={v => set({ name: v })} />
        <div className="form-grid two">
          <div><label className="lab" htmlFor="sp-l">Level</label>
            <select id="sp-l" className="field" value={sp.level} onChange={e => set({ level: Number(e.target.value) })}>
              {LEVEL_NAME.map((n, i) => <option key={i} value={i}>{i === 0 ? 'Cantrip' : n}</option>)}
            </select></div>
          {txt('time', 'Casting time', '1 action')}
          {txt('range', 'Range', '60 ft.')}
          {txt('components', 'Components', 'V, S, M')}
          {txt('duration', 'Duration', 'Instantaneous')}
          {txt('hit', 'Hit / DC or damage', '+5 or 2d6 fire')}
        </div>
        <div className="actions-row" style={{ marginTop: 12 }}>
          {sp.level > 0 && <label className="check"><input type="checkbox" checked={sp.prepared} onChange={e => set({ prepared: e.target.checked })} /> Prepared</label>}
          <label className="check"><input type="checkbox" checked={!!sp.concentration} onChange={e => set({ concentration: e.target.checked })} /> Concentration</label>
          <label className="check"><input type="checkbox" checked={!!sp.ritual} onChange={e => set({ ritual: e.target.checked })} /> Ritual</label>
        </div>
        {txt('source', 'Source', 'Class, feat or item')}
        <label className="lab" htmlFor="sp-no">Notes</label><DraftTextarea id="sp-no" className="field area" rows={4} value={sp.notes ?? ''} onValue={v => set({ notes: v })} placeholder="Your own summary of what it does" />
        <div className="foot"><span /><button className="btn ghost" onClick={() => { save({ spells: (c.spells ?? []).filter((_, j) => j !== d.i) }); onClose() }}><Trash2 size={16} /> Remove</button></div>
      </Drawer>
    )
  }
  const it = c.inventory[d.i]
  if (!it) return null
  const set = (patch: Partial<Item>) => save({ inventory: c.inventory.map((x, j) => j === d.i ? { ...x, ...patch } : x) })
  return (
    <Drawer title={it.name || 'Item'} onClose={onClose}>
      <label className="lab" htmlFor="it-n">Name</label><DraftInput id="it-n" className="field" value={it.name} onValue={v => set({ name: v })} />
      <div className="form-grid two">
        <div><label className="lab">Quantity</label>
          <div className="stepper">
            <button className="btn sm" aria-label="One fewer" onClick={() => set({ qty: Math.max(0, it.qty - 1) })}>−</button>
            <b className="tnum">{it.qty}</b>
            <button className="btn sm" aria-label="One more" onClick={() => set({ qty: it.qty + 1 })}>+</button>
          </div></div>
        <div><label className="lab" htmlFor="it-w">Weight each (lb.)</label><NumberInput id="it-w" className="field" decimal value={it.weight} min={0}
          onNumber={n => set({ weight: n })} /></div>
      </div>
      <label className="check" style={{ marginTop: 12 }}><input type="checkbox" checked={it.equipped} onChange={e => set({ equipped: e.target.checked })} /> Equipped / in use</label>
      <label className="lab" htmlFor="it-no">Notes</label><DraftTextarea id="it-no" className="field area" rows={3} value={it.notes ?? ''} onValue={v => set({ notes: v })} />
      <div className="foot"><span /><button className="btn ghost" onClick={() => { save({ inventory: c.inventory.filter((_, j) => j !== d.i) }); onClose() }}><Trash2 size={16} /> Remove</button></div>
    </Drawer>
  )
}

function HpDetail({ c, save, onClose }: { c: Character; save: Save; onClose: () => void }) {
  const [heal, setHeal] = useState('')
  const [dmg, setDmg] = useState('')
  const [temp, setTemp] = useState('')
  const h = Math.max(0, Math.floor(Number(heal) || 0)), d = Math.max(0, Math.floor(Number(dmg) || 0))
  const fromTemp = Math.min(c.hpTemp, d)
  const newHp = Math.max(0, Math.min(c.hpMax, c.hpCurrent + h - (d - fromTemp)))
  const newTemp = c.hpTemp - fromTemp
  const changed = h > 0 || d > 0
  return (
    <Drawer title="Hit points" onClose={onClose}>
      <div className="hp-tri">
        <div><span className="k">Current</span><b className={`tnum ${c.hpCurrent <= c.hpMax / 3 ? 'low' : ''}`}>{c.hpCurrent}</b></div>
        <div><span className="k">Max</span><b className="tnum">{c.hpMax}</b></div>
        <div><span className="k">Temp</span><b className="tnum temp">{c.hpTemp || '--'}</b></div>
      </div>
      <div className="hp-apply">
        <label className="lab" htmlFor="hp-h">Healing</label>
        <div className="add-row" style={{ marginTop: 0 }}>
          <input id="hp-h" className="field" inputMode="numeric" placeholder="0" value={heal} onChange={e => setHeal(e.target.value.replace(/\D/g, ''))} />
          <button className="btn heal-solid" disabled={!h} onClick={() => { applyHeal(c, h, save); setHeal('') }}>Heal</button>
        </div>
        <label className="lab" htmlFor="hp-d">Damage</label>
        <div className="add-row" style={{ marginTop: 0 }}>
          <input id="hp-d" className="field" inputMode="numeric" placeholder="0" value={dmg} onChange={e => setDmg(e.target.value.replace(/\D/g, ''))} />
          <button className="btn primary" disabled={!d} onClick={() => { applyDamage(c, d, save); setDmg('') }}>Damage</button>
        </div>
        <div className={`hp-preview ${changed ? 'on' : ''}`} aria-live="polite">
          New HP <b className="tnum">{newHp}</b>{newTemp !== c.hpTemp && <span className="tnum"> · temp {newTemp}</span>}
          {changed && h > 0 && d > 0 && <button className="btn sm" onClick={() => { save({ hpCurrent: newHp, hpTemp: newTemp }); setHeal(''); setDmg('') }}>Apply both</button>}
        </div>
      </div>
      <label className="lab" htmlFor="hp-t">Temporary hit points</label>
      <div className="add-row" style={{ marginTop: 0 }}>
        <input id="hp-t" className="field" inputMode="numeric" placeholder={String(c.hpTemp || 0)} value={temp} onChange={e => setTemp(e.target.value.replace(/\D/g, ''))} />
        <button className="btn" disabled={temp === ''} onClick={() => { save({ hpTemp: Number(temp) || 0 }); setTemp('') }}>Set temp</button>
      </div>
      <table className="calc">
        <tbody>
          <tr><th>Max HP</th><td><NumberInput className="field num-in" aria-label="Max HP" value={c.hpMax} min={1}
            onNumber={n => save({ hpMax: n })} /></td></tr>
          <tr><th>Hit dice</th><td className="tnum">{classesOf(c).map(k => `${k.level - k.used}/${k.level} d${k.hitDie}`).join(', ')}</td></tr>
        </tbody>
      </table>
    </Drawer>
  )
}
