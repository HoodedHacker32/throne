import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Printer } from 'lucide-react'
import { db, type Character } from '../db'
import { ABILITIES, ABILITY_NAMES, SKILLS, fmt, mod, profBonus, type Ability } from '../lib/rules'
import { abilityMod, classLine, classesOf, initiative, initials, parseFeatures, passive, saveBonus, skillBonus } from '../lib/character'
import { LEVEL_NAME } from '../lib/spells'
import { DieMark } from '../components/DieMark'

/* Printable character sheet. Standard sheet structure (header, stat row, three columns, then features,
   gear, personality and spells on the following pages), drawn in Throne's own style. The browser's
   print engine makes the PDF, so text stays sharp and selectable at any zoom. */

type Paper = 'a4' | 'letter'
interface Opts { paper: Paper; fill: boolean; spells: boolean; story: boolean }
const OPTS_KEY = 'throne.printOpts'

export function PrintPage() {
  const id = Number(useParams().id)
  const c = useLiveQuery(() => db.characters.get(id), [id])
  const [o, setO] = useState<Opts>(() => {
    try { return { paper: 'a4', fill: false, spells: true, story: true, ...JSON.parse(localStorage.getItem(OPTS_KEY) ?? '{}') } } catch { return { paper: 'a4', fill: false, spells: true, story: true } }
  })
  useEffect(() => { try { localStorage.setItem(OPTS_KEY, JSON.stringify(o)) } catch { /* ignore */ } }, [o])
  useEffect(() => { if (c) document.title = `${c.name} - character sheet` ; return () => { document.title = 'Throne' } }, [c])
  // Page size for the print engine.
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = `@page { size: ${o.paper === 'a4' ? 'A4' : 'letter'} portrait; margin: 0; }`
    document.head.appendChild(el)
    return () => el.remove()
  }, [o.paper])

  // Fit the page preview to narrow screens (printing always uses full size).
  const [z, setZ] = useState(1)
  useEffect(() => {
    const fit = () => setZ(Math.min(1, (window.innerWidth - 16) / (o.paper === 'a4' ? 794 : 816)))
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit)
  }, [o.paper])

  if (c === undefined) return <div className="print-shell"><p style={{ padding: 24 }}>Loading…</p></div>
  if (!c) return <div className="print-shell"><p style={{ padding: 24 }}>Character not found. <Link to="/characters">Back</Link></p></div>
  const hasSpells = !!(c.spells?.length || c.slots?.some(n => n > 0) || c.spellAbility)

  return (
    <div className={`print-shell paper-${o.paper}`}>
      <div className="print-bar no-print">
        <Link to={`/characters/${c.id}`} className="btn ghost sm"><ArrowLeft size={14} /> Sheet</Link>
        <b className="pb-title">Character sheet PDF</b>
        <div className="seg" role="group" aria-label="Paper size">
          <button aria-pressed={o.paper === 'a4'} onClick={() => setO({ ...o, paper: 'a4' })}>A4</button>
          <button aria-pressed={o.paper === 'letter'} onClick={() => setO({ ...o, paper: 'letter' })}>Letter</button>
        </div>
        <label className="check"><input type="checkbox" checked={o.fill} onChange={e => setO({ ...o, fill: e.target.checked })} /> Current HP and used slots</label>
        {hasSpells && <label className="check"><input type="checkbox" checked={o.spells} onChange={e => setO({ ...o, spells: e.target.checked })} /> Spells page</label>}
        <label className="check"><input type="checkbox" checked={o.story} onChange={e => setO({ ...o, story: e.target.checked })} /> Personality and backstory</label>
        <button className="btn primary" onClick={() => window.print()}><Printer size={16} /> Save as PDF</button>
        <p className="pb-hint muted small">On a computer, pick <b>Save as PDF</b> as the printer and turn off headers and footers. On iPhone, tap the share button at the top of the print screen, then <b>Save to Files</b>.</p>
      </div>
      <div className="print-pages" style={{ ['--z' as string]: z }}>
        <PageOne c={c} fill={o.fill} />
        <PageTwo c={c} story={o.story} />
        {hasSpells && o.spells && <PageSpells c={c} fill={o.fill} />}
      </div>
    </div>
  )
}

/* ---------------- Building blocks ---------------- */

function Frame({ label, children, className = '', lines }: { label?: string; children: React.ReactNode; className?: string; lines?: boolean }) {
  return (
    <section className={`ps-frame ${className}`}>
      {children}
      {lines && <div className="ps-fill" aria-hidden="true" />}
      {label && <h3 className="ps-label">{label}</h3>}
    </section>
  )
}
const Dot = ({ on, exp }: { on?: boolean; exp?: boolean }) => <span className={`ps-dot ${on ? 'on' : ''} ${exp ? 'exp' : ''}`} />
const Boxes = ({ n, used = 0 }: { n: number; used?: number }) => <span className="ps-boxes">{Array.from({ length: n }, (_, i) => <span key={i} className={`ps-box ${i < used ? 'x' : ''}`} />)}</span>

function Footer({ c, page }: { c: Character; page: number }) {
  return (
    <footer className="ps-foot">
      <span className="ps-mark"><span>Thr</span><DieMark size={11} /><span>ne</span></span>
      <span>Unofficial D&amp;D Campaign Manager · not affiliated with Wizards of the Coast</span>
      <span>{c.name} · page {page}</span>
    </footer>
  )
}

function Head({ c }: { c: Character }) {
  const cls = classLine(c)
  return (
    <header className="ps-head">
      <div className="ps-portrait">{c.portrait ? <img src={c.portrait} alt="" /> : <span>{initials(c.name)}</span>}</div>
      <div className="ps-name">
        <h1>{c.name}</h1>
        <dl>
          <div><dt>Class &amp; level</dt><dd>{cls || '—'} {classesOf(c).length === 1 ? c.level : ''}</dd></div>
          <div><dt>Species</dt><dd>{c.species || '—'}</dd></div>
          <div><dt>Background</dt><dd>{c.background || '—'}</dd></div>
          <div><dt>Alignment</dt><dd>{c.alignment || '—'}</dd></div>
          <div><dt>Player</dt><dd>{c.player || ' '}</dd></div>
          <div><dt>Experience</dt><dd>&nbsp;</dd></div>
        </dl>
      </div>
    </header>
  )
}

/* ---------------- Page 1: the sheet ---------------- */

function PageOne({ c, fill }: { c: Character; fill: boolean }) {
  const pb = profBonus(c.level)
  const dice = classesOf(c)
  const profs = (c.proficiencies ?? '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i), l.slice(i + 1).trim()] : ['', l]
  })
  const attacks = c.attacks.slice(0, 9)
  return (
    <article className="ps-page">
      <Head c={c} />
      <div className="ps-stats">
        {ABILITIES.map(a => (
          <div key={a} className="ps-ability">
            <h4>{ABILITY_NAMES[a]}</h4>
            <b className="ps-num">{fmt(abilityMod(c, a))}</b>
            <span className="ps-score">{c.abilities[a]}</span>
          </div>
        ))}
        <div className="ps-small"><b className="ps-num">{fmt(pb)}</b><h4>Proficiency bonus</h4></div>
        <div className="ps-small"><b className="ps-num">{c.speed}<small>ft</small></b><h4>Walking speed</h4></div>
        <div className="ps-small"><span className="ps-insp">{c.inspiration ? '★' : ''}</span><h4>Heroic inspiration</h4></div>
        <div className="ps-hp">
          <div className="ps-hp-row">
            <div><h4>Current</h4><b className="ps-num">{fill ? c.hpCurrent : ''}</b></div>
            <div><h4>Max</h4><b className="ps-num">{c.hpMax}</b></div>
            <div><h4>Temp</h4><b className="ps-num">{fill && c.hpTemp ? c.hpTemp : ''}</b></div>
          </div>
          <h4 className="ps-hp-l">Hit points</h4>
        </div>
      </div>

      <div className="ps-cols">
        <div className="ps-col">
          <Frame label="Saving throws">
            <ul className="ps-list">
              {ABILITIES.map(a => <li key={a}><Dot on={c.saveProf.includes(a)} /><b>{fmt(saveBonus(c, a))}</b><span>{ABILITY_NAMES[a]}</span></li>)}
            </ul>
          </Frame>
          <Frame label="Passive senses">
            <ul className="ps-list">
              <li><b>{passive(c, 'perception')}</b><span>Perception</span></li>
              <li><b>{passive(c, 'investigation')}</b><span>Investigation</span></li>
              <li><b>{passive(c, 'insight')}</b><span>Insight</span></li>
            </ul>
            {c.senses && <p className="ps-text">{c.senses}</p>}
          </Frame>
          <Frame label="Proficiencies & training" className="grow" lines>
            {profs.map(([h, b], i) => <p key={i} className="ps-text">{h && <b>{h}: </b>}{b}</p>)}
          </Frame>
        </div>

        <div className="ps-col">
          <Frame label="Skills" className="grow" lines>
            <table className="ps-skills"><tbody>
              {SKILLS.map(s => {
                const p = c.skillProf[s.key] ?? 0
                return <tr key={s.key}><td><Dot on={p >= 1} exp={p === 2} /></td><td className="ab">{s.ability}</td><td>{s.name}</td><td className="n">{fmt(skillBonus(c, s.key))}</td></tr>
              })}
            </tbody></table>
          </Frame>
        </div>

        <div className="ps-col">
          <div className="ps-trio">
            <div className="ps-small"><b className="ps-num">{fmt(initiative(c))}</b><h4>Initiative</h4></div>
            <div className="ps-small ps-ac"><b className="ps-num">{c.ac}</b><h4>Armor class</h4></div>
            <div className="ps-small"><b className="ps-num ps-dice">{dice.map(k => `${k.level}d${k.hitDie}`).join(' ')}</b><h4>Hit dice</h4></div>
          </div>
          <div className="ps-pair">
            <Frame label="Defenses">{c.defenses ? <p className="ps-text">{c.defenses}</p> : <div className="ps-lines short" />}</Frame>
            <Frame label="Death saves">
              <div className="ps-death"><span>Successes</span><Boxes n={3} /></div>
              <div className="ps-death"><span>Failures</span><Boxes n={3} /></div>
            </Frame>
          </div>
          {fill && !!c.conditions?.length && <Frame label="Conditions"><p className="ps-text">{c.conditions.join(', ')}</p></Frame>}
          <Frame label="Actions" className="grow" lines>
            <table className="ps-table">
              <thead><tr><th>Name</th><th>Range</th><th>Hit / DC</th><th>Damage</th></tr></thead>
              <tbody>
                {attacks.map((a, i) => <tr key={i}><td><b>{a.name}</b>{a.notes && <small>{a.notes.split('\n')[0]}</small>}</td><td>{a.range ?? ''}</td><td className="n">{a.bonus}</td><td>{a.damage}</td></tr>)}
                              </tbody>
            </table>
            {c.resources.length > 0 && (<>
              <h5 className="ps-sub">Limited use</h5>
              <ul className="ps-res">
                {c.resources.map((r, i) => <li key={i}><span>{r.name} <small>({r.rest} rest)</small></span><Boxes n={r.max} used={fill ? r.used : 0} /></li>)}
              </ul>
            </>)}
          </Frame>
        </div>
      </div>
      <Footer c={c} page={1} />
    </article>
  )
}

/* ---------------- Page 2: features, gear, story ---------------- */

function PageTwo({ c, story }: { c: Character; story: boolean }) {
  const sections = useMemo(() => parseFeatures(c.features), [c.features])
  const weight = c.inventory.reduce((t, i) => t + i.weight * i.qty, 0)
  return (
    <article className="ps-page">
      <header className="ps-head slim"><h1>{c.name}</h1><span>{classLine(c)} {c.level} · Features, equipment and story</span></header>
      <div className="ps-two">
        <Frame label="Features & traits" className="grow" lines><div className="ps-feats">
          {sections.length ? sections.map(s => (
            <div key={s.title} className="ps-feat-sec">
              <h5 className="ps-sub">{s.title}</h5>
              {s.items.map((it, i) => <p key={i} className="ps-text">{it.name && <b>{it.name}. </b>}{it.body}</p>)}
            </div>
          )) : null}</div>
        </Frame>
        <div className="ps-col">
          <Frame label="Equipment" className="grow" lines>
            <table className="ps-table">
              <thead><tr><th /><th>Item</th><th>Qty</th><th>Lb.</th></tr></thead>
              <tbody>
                {c.inventory.map((it, i) => <tr key={i}><td><Dot on={it.equipped} /></td><td>{it.name}</td><td className="n">{it.qty}</td><td className="n">{it.weight ? Math.round(it.weight * it.qty * 10) / 10 : ''}</td></tr>)}
                              </tbody>
            </table>
            <p className="ps-text ps-weight">Carried {Math.round(weight * 10) / 10} lb. · capacity {c.abilities.str * 15} lb. · ● equipped</p>
          </Frame>
          <Frame label="Coins">
            <div className="ps-coins">{(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map(k => <div key={k}><b className="ps-num">{c.coins[k]}</b><span>{k}</span></div>)}</div>
          </Frame>
          {story && (
            <Frame label="Personality">
              {(['traits', 'ideals', 'bonds', 'flaws'] as const).map(k => (
                <div key={k} className="ps-pers"><h5 className="ps-sub">{k === 'traits' ? 'Traits' : k[0].toUpperCase() + k.slice(1)}</h5><p className="ps-text">{c[k] || ' '}</p></div>
              ))}
            </Frame>
          )}
        </div>
      </div>
      {story && c.backstory && <Frame label="Backstory"><p className="ps-text ps-story">{c.backstory}</p></Frame>}
      <Footer c={c} page={2} />
    </article>
  )
}

/* ---------------- Page 3: spells ---------------- */

function PageSpells({ c, fill }: { c: Character; fill: boolean }) {
  const ab = (c.spellAbility || '') as Ability | ''
  const m = ab ? mod(c.abilities[ab]) : 0
  const pb = profBonus(c.level)
  const slots = c.slots ?? []
  const used = c.slotsUsed ?? []
  const byLevel = useMemo(() => {
    const g = new Map<number, NonNullable<Character['spells']>>()
    for (const s of [...(c.spells ?? [])].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))) g.set(s.level, [...(g.get(s.level) ?? []), s])
    return [...g.entries()]
  }, [c.spells])
  return (
    <article className="ps-page">
      <header className="ps-head slim"><h1>{c.name}</h1><span>Spellcasting</span></header>
      <div className="ps-spellhead">
        <div className="ps-small"><b className="ps-num ps-word">{ab ? ABILITY_NAMES[ab] : '—'}</b><h4>Spellcasting ability</h4></div>
        <div className="ps-small"><b className="ps-num">{ab ? fmt(m) : '—'}</b><h4>Modifier</h4></div>
        <div className="ps-small"><b className="ps-num">{ab ? fmt(m + pb) : '—'}</b><h4>Spell attack</h4></div>
        <div className="ps-small"><b className="ps-num">{ab ? 8 + m + pb : '—'}</b><h4>Save DC</h4></div>
        <Frame label="Spell slots" className="ps-slots">
          {slots.some(n => n > 0) ? slots.map((n, l) => l > 0 && n > 0 && (
            <div key={l} className="ps-slot"><span>{LEVEL_NAME[l].replace(' level', '')}</span><Boxes n={n} used={fill ? used[l] ?? 0 : 0} /></div>
          )) : <p className="ps-text">None</p>}
        </Frame>
      </div>
      <Frame label="Spells" className="grow" lines>
        <table className="ps-table ps-spells">
          <thead><tr><th>Prep</th><th>Name</th><th>Time</th><th>Range</th><th>Hit / DC</th><th>Comp.</th><th>Duration</th></tr></thead>
          <tbody>
            {byLevel.map(([lvl, list]) => [
              <tr key={`h${lvl}`} className="lvl"><td colSpan={7}>{lvl === 0 ? 'Cantrips' : LEVEL_NAME[lvl]}</td></tr>,
              ...list.map((s, i) => (
                <tr key={`${lvl}-${i}`}>
                  <td>{lvl > 0 && <Dot on={s.prepared} />}</td>
                  <td><b>{s.name}</b>{(s.concentration || s.ritual) && <small> {[s.concentration && 'C', s.ritual && 'R'].filter(Boolean).join(' ')}</small>}</td>
                  <td>{s.time ?? ''}</td><td>{s.range ?? ''}</td><td>{s.hit ?? ''}</td><td>{s.components ?? ''}</td><td>{s.duration ?? ''}</td>
                </tr>
              )),
            ])}
                      </tbody>
        </table>
        <p className="ps-text ps-weight">● prepared · C concentration · R ritual</p>
      </Frame>
      <Footer c={c} page={3} />
    </article>
  )
}
