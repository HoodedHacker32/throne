import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, Check, Dices, RotateCcw, Sparkles } from 'lucide-react'
import { blankCharacter, db, type Item } from '../db'
import {
  ABILITIES, ABILITY_NAMES, ALIGNMENTS, CLASSES, ITEM_WEIGHT, POINT_COST, SKILLS, SPECIES, STANDARD_ARRAY, STARTING_EQUIPMENT,
  armorClass, fmt, mod, type Ability,
} from '../lib/rules'
import { roll } from '../lib/dice'
import { CASTING_ABILITY, slotsFor } from '../lib/spells'
import { useCampaignId } from '../lib/hooks'

/* One URL per step, free navigation, autosaved draft, badges for what is left.
   Modelled on D&D Beyond's flow (docs/ddb-screen-research.md), minus its pain points:
   no blocking spinner, no duplicate standard-array values, a step bar that shows done/needs-attention,
   and a create button that says exactly what is missing. */

const STEPS = [
  { key: 'class', label: 'Class' }, { key: 'background', label: 'Background' }, { key: 'species', label: 'Species' },
  { key: 'abilities', label: 'Abilities' }, { key: 'equipment', label: 'Equipment' }, { key: 'review', label: "What's next" },
] as const
type StepKey = (typeof STEPS)[number]['key']
type Method = 'standard' | 'pointbuy' | 'rolled' | 'manual'

interface Draft {
  name: string
  cls: string; level: number; hpMode: 'average' | 'manual'; hpManual: number
  bg: string; bgMode: '21' | '111'; plus2: Ability | ''; plus1: Ability | ''; plus111: Ability[]
  alignment: string; skills: string[]; traits: string; ideals: string; bonds: string; flaws: string; backstory: string
  species: string
  method: Method; assign: Partial<Record<Ability, number>>; scores: Record<Ability, number>; rolls: number[][]
  other: Partial<Record<Ability, number>>; override: Partial<Record<Ability, number>>
  kit: string; bgEquip: 'kit' | 'gold'; bgItems: string; bgGp: number; extra: string[]
}

const BASE8: Record<Ability, number> = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
const NEW: Draft = {
  name: '', cls: '', level: 1, hpMode: 'average', hpManual: 0,
  bg: '', bgMode: '21', plus2: '', plus1: '', plus111: [], alignment: '', skills: [], traits: '', ideals: '', bonds: '', flaws: '', backstory: '',
  species: '', method: 'standard', assign: {}, scores: BASE8, rolls: [], other: {}, override: {},
  kit: 'A', bgEquip: 'gold', bgItems: '', bgGp: 0, extra: [],
}
const BACKGROUNDS = ['Acolyte', 'Artisan', 'Charlatan', 'Criminal', 'Entertainer', 'Farmer', 'Guard', 'Guide', 'Hermit', 'Merchant', 'Noble', 'Sage', 'Sailor', 'Scribe', 'Soldier', 'Wayfarer']
const GEAR = ['Backpack', 'Bedroll', 'Rations (1 day)', 'Rope (50 ft.)', 'Torch', 'Waterskin', 'Tinderbox', "Healer's Kit", 'Potion of Healing', 'Crowbar', 'Lantern', 'Oil (flask)', 'Ink and Quill', 'Clothes, Traveler\'s']
const KEY = 'throne.builderDraft'

function load(): Draft {
  try { const v = localStorage.getItem(KEY); return v ? { ...NEW, ...JSON.parse(v) } : NEW } catch { return NEW }
}

/** Short pronounceable name suggestions. Pure fun, no lore. */
function suggestName() {
  const a = ['Ar', 'Bel', 'Cor', 'Dar', 'El', 'Fen', 'Gal', 'Hal', 'Ir', 'Jas', 'Kel', 'Lir', 'Mor', 'Nym', 'Or', 'Per', 'Quin', 'Ros', 'Syl', 'Tor', 'Ul', 'Vey', 'Wren', 'Yor', 'Zan']
  const b = ['a', 'e', 'i', 'o', 'ae', 'ia', 'ou', 'y']
  const c = ['n', 'th', 'ric', 'wyn', 'las', 'dor', 'mir', 'ra', 'vin', 'sha', 'tor', 'nel', 'dra', 'win']
  const pick = (x: string[]) => x[roll(x.length).total - 1]
  return `${pick(a)}${pick(b)}${pick(c)}`
}

export function BuilderPage() {
  const { step: raw } = useParams()
  const navigate = useNavigate()
  const campaignId = useCampaignId()
  const [d, setD] = useState<Draft>(load)
  const step = (STEPS.find(s => s.key === raw)?.key ?? null) as StepKey | null
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* private mode */ } }, [d])
  const set = (p: Partial<Draft>) => setD(prev => ({ ...prev, ...p }))

  const info = CLASSES.find(c => c.name === d.cls)
  const sp = SPECIES.find(s => s.name === d.species)
  const maxSkills = (info?.skillChoices ?? 2) + 2
  const pool = d.method === 'standard' ? STANDARD_ARRAY : d.method === 'rolled' ? d.rolls.map(r => sumBest3(r)) : []

  const base: Record<Ability, number> = useMemo(() => {
    if (d.method === 'standard' || d.method === 'rolled') return Object.fromEntries(ABILITIES.map(a => [a, pool[d.assign[a] ?? -1] ?? 0])) as Record<Ability, number>
    return d.scores
  }, [d.method, d.assign, d.scores, pool])
  const bgBonus = (a: Ability) => d.bgMode === '21' ? (d.plus2 === a ? 2 : 0) + (d.plus1 === a ? 1 : 0) : d.plus111.includes(a) ? 1 : 0
  const total = (a: Ability) => d.override[a] ?? Math.min(20, base[a] + bgBonus(a) + (d.other[a] ?? 0))
  const final = Object.fromEntries(ABILITIES.map(a => [a, total(a)])) as Record<Ability, number>
  const spent = ABILITIES.reduce((s, a) => s + (POINT_COST[d.scores[a]] ?? 0), 0)
  const hitDie = info?.hitDie ?? 8
  const avgHp = Math.max(1, hitDie + mod(final.con) + (d.level - 1) * (hitDie / 2 + 1 + mod(final.con)))
  const hp = d.hpMode === 'manual' && d.hpManual > 0 ? d.hpManual : avgHp

  const kits = STARTING_EQUIPMENT[d.cls] ?? []
  const kit = kits.find(k => k.label === d.kit) ?? kits[0]
  const bgItems = d.bgEquip === 'kit' ? d.bgItems.split(',').map(s => s.trim()).filter(Boolean) : []
  const items: Item[] = [
    ...(kit?.items ?? []).map(([name, qty]) => ({ name, qty, weight: ITEM_WEIGHT[name] ?? 0, equipped: name in ITEM_WEIGHT && !/Arrows|Javelin|Dagger|Handaxe/.test(name) })),
    ...bgItems.map(name => ({ name, qty: 1, weight: 0, equipped: false })),
    ...d.extra.map(name => ({ name, qty: 1, weight: 0, equipped: false })),
  ]
  const gp = (kit?.gp ?? 0) + (d.bgEquip === 'gold' ? 50 : d.bgGp)
  const ac = armorClass(items.map(i => i.name), mod(final.dex), d.cls, mod(final.con), mod(final.wis))

  // What each step still needs. "required" blocks creating the character; the rest are reminders.
  const abilitiesDone = d.method === 'pointbuy' ? spent <= 27 : d.method === 'manual' ? true : ABILITIES.every(a => d.assign[a] !== undefined)
  const bonusDone = d.bgMode === '21' ? !!d.plus2 && !!d.plus1 && d.plus2 !== d.plus1 : d.plus111.length === 3
  const todo: Record<StepKey, { required: string[]; optional: string[] }> = {
    class: { required: d.cls ? [] : ['Choose a class'], optional: [] },
    background: {
      required: [],
      optional: [
        ...(d.bg ? [] : ['Pick a background']),
        ...(bonusDone ? [] : ['Assign ability score increases']),
        ...(d.skills.length < maxSkills ? [`Choose ${maxSkills - d.skills.length} more skill${maxSkills - d.skills.length === 1 ? '' : 's'}`] : []),
      ],
    },
    species: { required: d.species ? [] : ['Choose a species'], optional: d.name.trim() ? [] : ['Name your character'] },
    abilities: { required: abilitiesDone ? [] : [d.method === 'pointbuy' ? 'Spend no more than 27 points' : d.method === 'rolled' && !d.rolls.length ? 'Roll your scores' : 'Assign every ability score'], optional: [] },
    equipment: { required: [], optional: [] },
    review: { required: [], optional: [] },
  }
  const count = (k: StepKey) => todo[k].required.length + todo[k].optional.length
  const missing = (Object.keys(todo) as StepKey[]).flatMap(k => todo[k].required)
  const short = [!d.cls && 'class', !d.species && 'species', !abilitiesDone && 'ability scores'].filter(Boolean) as string[]

  if (!step) return <Navigate to="/characters/new/class" replace />
  const idx = STEPS.findIndex(s => s.key === step)
  const go = (k: StepKey) => navigate(`/characters/new/${k}`)

  async function create() {
    const id = await db.characters.add(blankCharacter({
      mode: 'guided', campaignId, name: d.name.trim() || `${d.species} ${d.cls}`, className: d.cls, level: d.level,
      background: d.bg, alignment: d.alignment, species: d.species,
      abilities: final, saveProf: info ? [...info.saves] : [], skillProf: Object.fromEntries(d.skills.map(s => [s, 1])),
      hpMax: hp, hpCurrent: hp, hitDie, ac, speed: sp?.speed ?? 30,
      inventory: items, coins: { cp: 0, sp: 0, ep: 0, gp, pp: 0 },
      spellAbility: CASTING_ABILITY[d.cls] ?? '', slots: slotsFor(d.cls, d.level), slotsUsed: [], spells: [],
      traits: d.traits, ideals: d.ideals, bonds: d.bonds, flaws: d.flaws, backstory: d.backstory,
      features: [
        '=== CLASS ===', '', `* ${d.cls} ${d.level}`, `Hit die d${hitDie}. Saving throws: ${info?.saves.map(s => ABILITY_NAMES[s]).join(', ')}.`,
        '', '=== SPECIES ===', '', `* ${d.species}`, `${sp?.size ?? 'Medium'}, speed ${sp?.speed ?? 30} ft.`,
        '', 'Add class features, species traits and feats from your book with Edit.',
      ].join('\n'),
    }))
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
    navigate(`/characters/${id}`)
  }
  function reset() {
    if (!confirm('Start over? This clears the character you are building.')) return
    setD(NEW); go('class')
  }

  return (
    <div className="page builder">
      <Link to="/characters" className="btn ghost sm back"><ArrowLeft size={14} /> Characters</Link>
      <div className="page-head">
        <div><h1>Build a character</h1><p>Jump between steps in any order. Everything saves as you go.</p></div>
        <button className="btn ghost sm" onClick={reset}><RotateCcw size={14} /> Start over</button>
      </div>

      <nav className="steps v2" aria-label="Builder steps">
        {STEPS.map((s, i) => {
          const n = count(s.key)
          const req = todo[s.key].required.length > 0
          const state = s.key === 'review' ? '' : n === 0 ? 'done' : req ? 'req' : 'todo'
          return (
            <button key={s.key} aria-current={s.key === step ? 'step' : undefined} className={state} onClick={() => go(s.key)}
              aria-label={`${s.label}${state === 'done' ? ', done' : n ? `, ${n} left` : ''}`}>
              <span className="step-n">{state === 'done' ? <Check size={12} /> : i + 1}</span>
              <span className="step-l">{s.label}</span>
              {state !== 'done' && n > 0 && <span className="step-badge tnum">{n}</span>}
            </button>
          )
        })}
      </nav>

      <div className="builder-grid">
        <section className="panel builder-main">
          {step === 'class' && (<>
            <div className="panel-h"><h2>Choose a class</h2>{info && <span className="muted small">{d.cls} selected</span>}</div>
            <div className="pick">
              {CLASSES.map(c => (
                <button key={c.name} aria-pressed={d.cls === c.name} onClick={() => set({ cls: c.name, kit: 'A', skills: d.skills.slice(0, c.skillChoices + 2) })}>
                  <b>{c.name}</b><small>d{c.hitDie} hit die · {c.primary}</small>
                </button>
              ))}
            </div>
            {info && (
              <div className="choice-card">
                <h3 className="group-h">{d.cls}</h3>
                <dl className="facts">
                  <div><dt>Primary ability</dt><dd>{info.primary}</dd></div>
                  <div><dt>Hit die</dt><dd>d{info.hitDie}</dd></div>
                  <div><dt>Saving throws</dt><dd>{info.saves.map(s => ABILITY_NAMES[s]).join(', ')}</dd></div>
                  <div><dt>Skill choices</dt><dd>{info.skillChoices}</dd></div>
                </dl>
                <div className="inline-field">
                  <span className="lab">Level</span>
                  <div className="stepper">
                    <button className="btn sm" aria-label="Lower level" onClick={() => set({ level: Math.max(1, d.level - 1) })}>−</button>
                    <b className="tnum">{d.level}</b>
                    <button className="btn sm" aria-label="Raise level" onClick={() => set({ level: Math.min(20, d.level + 1) })}>+</button>
                  </div>
                </div>
                <label className="lab">Hit points</label>
                <div className="seg" role="group" aria-label="Hit point method">
                  <button aria-pressed={d.hpMode === 'average'} onClick={() => set({ hpMode: 'average' })}>Fixed (average)</button>
                  <button aria-pressed={d.hpMode === 'manual'} onClick={() => set({ hpMode: 'manual', hpManual: d.hpManual || avgHp })}>Rolled / manual</button>
                </div>
                {d.hpMode === 'manual'
                  ? <input className="field num-in wide" inputMode="numeric" aria-label="Max hit points" value={d.hpManual || ''} onChange={e => set({ hpManual: Number(e.target.value.replace(/\D/g, '')) || 0 })} style={{ marginTop: 8 }} />
                  : <p className="small muted tnum">{hitDie} + CON at level 1, then {hitDie / 2 + 1} + CON per level = <b>{avgHp}</b> with your current scores.</p>}
              </div>
            )}
          </>)}

          {step === 'background' && (<>
            <div className="panel-h"><h2>Background</h2></div>
            <label className="lab" htmlFor="bg">Background</label>
            <input id="bg" className="field" list="bgs" value={d.bg} placeholder="Pick from the list or type your own" onChange={e => set({ bg: e.target.value })} />
            <datalist id="bgs">{BACKGROUNDS.map(b => <option key={b} value={b} />)}</datalist>

            <Choice title="Ability score increases" done={bonusDone} note="Your background lists three abilities. Raise one by 2 and another by 1, or all three by 1.">
              <div className="seg" role="group" aria-label="Increase pattern">
                <button aria-pressed={d.bgMode === '21'} onClick={() => set({ bgMode: '21' })}>+2 and +1</button>
                <button aria-pressed={d.bgMode === '111'} onClick={() => set({ bgMode: '111' })}>+1 to three</button>
              </div>
              {d.bgMode === '21' ? (
                <div className="form-grid two">
                  <div><label className="lab" htmlFor="p2">+2 to</label>
                    <select id="p2" className="field" value={d.plus2} onChange={e => set({ plus2: e.target.value as Ability })}>
                      <option value="">Choose</option>{ABILITIES.filter(a => a !== d.plus1).map(a => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
                    </select></div>
                  <div><label className="lab" htmlFor="p1">+1 to</label>
                    <select id="p1" className="field" value={d.plus1} onChange={e => set({ plus1: e.target.value as Ability })}>
                      <option value="">Choose</option>{ABILITIES.filter(a => a !== d.plus2).map(a => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
                    </select></div>
                </div>
              ) : (
                <div className="chips" style={{ marginTop: 10 }}>
                  {ABILITIES.map(a => {
                    const on = d.plus111.includes(a)
                    return <button key={a} className="chip" aria-pressed={on} disabled={!on && d.plus111.length >= 3}
                      onClick={() => set({ plus111: on ? d.plus111.filter(x => x !== a) : [...d.plus111, a] })}>{ABILITY_NAMES[a]} +1</button>
                  })}
                </div>
              )}
            </Choice>

            <Choice title={`Skill proficiencies (${d.skills.length} of ${maxSkills})`} done={d.skills.length >= maxSkills}
              note={`${d.cls || 'Your class'} gives ${info?.skillChoices ?? 2} from its list, your background gives 2. Check your book for which are allowed.`}>
              <div className="chips">
                {SKILLS.map(s => {
                  const on = d.skills.includes(s.key)
                  return <button key={s.key} className="chip" aria-pressed={on} disabled={!on && d.skills.length >= maxSkills}
                    onClick={() => set({ skills: on ? d.skills.filter(x => x !== s.key) : [...d.skills, s.key] })}>{s.name} <small className="muted">{s.ability}</small></button>
                })}
              </div>
            </Choice>

            <details className="choice-card optional">
              <summary>Personality and details <span className="muted small">optional</span></summary>
              <label className="lab" htmlFor="al">Alignment</label>
              <select id="al" className="field" value={d.alignment} onChange={e => set({ alignment: e.target.value })}>
                <option value="">Not set</option>{ALIGNMENTS.map(a => <option key={a}>{a}</option>)}
              </select>
              <div className="form-grid two">
                {(['traits', 'ideals', 'bonds', 'flaws'] as const).map(k => (
                  <div key={k}><label className="lab" htmlFor={`d-${k}`}>{k === 'traits' ? 'Personality traits' : k[0].toUpperCase() + k.slice(1)}</label>
                    <textarea id={`d-${k}`} className="field area" rows={2} value={d[k]} onChange={e => set({ [k]: e.target.value })} /></div>
                ))}
              </div>
              <label className="lab" htmlFor="d-bs">Backstory</label>
              <textarea id="d-bs" className="field area" rows={4} value={d.backstory} onChange={e => set({ backstory: e.target.value })} />
            </details>
          </>)}

          {step === 'species' && (<>
            <div className="panel-h"><h2>Species</h2></div>
            <div className="pick">
              {SPECIES.map(s => (
                <button key={s.name} aria-pressed={d.species === s.name} onClick={() => set({ species: s.name })}>
                  <b>{s.name}</b><small>{s.size} · {s.speed} ft.</small>
                </button>
              ))}
            </div>
            <label className="lab" htmlFor="nm">Character name</label>
            <div className="add-row" style={{ marginTop: 0 }}>
              <input id="nm" className="field" value={d.name} placeholder="You can leave this for later" onChange={e => set({ name: e.target.value })} />
              <button className="btn" onClick={() => set({ name: suggestName() })}><Sparkles size={16} /> Suggest</button>
            </div>
          </>)}

          {step === 'abilities' && (<>
            <div className="panel-h"><h2>Ability scores</h2></div>
            <div className="seg" role="group" aria-label="Method">
              {([['standard', 'Standard array'], ['pointbuy', 'Point buy'], ['rolled', 'Roll 4d6'], ['manual', 'Manual']] as const).map(([m, l]) => (
                <button key={m} aria-pressed={d.method === m} onClick={() => set({
                  method: m, assign: {}, scores: m === 'manual' ? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } : BASE8,
                  rolls: m === 'rolled' && !d.rolls.length ? rollSix() : d.rolls,
                })}>{l}</button>
              ))}
            </div>
            {d.method === 'standard' && <p className="muted small">Assign 15, 14, 13, 12, 10 and 8. Each value can be used once; picking a used value swaps it.</p>}
            {d.method === 'pointbuy' && <p className={`tnum ${spent > 27 ? 'error' : 'muted'}`}><b>{27 - spent}</b> of 27 points left. Scores run 8 to 15.</p>}
            {d.method === 'rolled' && (
              <div className="roll-groups">
                {d.rolls.map((r, i) => {
                  const low = r.indexOf(Math.min(...r))
                  return (
                    <div key={i} className="roll-group">
                      <span className="rg-dice">{r.map((v, j) => <span key={j} className={j === low ? 'drop' : ''}>{v}</span>)}</span>
                      <b className="tnum">{sumBest3(r)}</b>
                    </div>
                  )
                })}
                <button className="btn sm" onClick={() => set({ rolls: rollSix(), assign: {} })}><Dices size={14} /> Reroll all</button>
              </div>
            )}
            <div className="calc-grid">
              {ABILITIES.map(a => (
                <div key={a} className="calc-card">
                  <div className="cc-head"><b>{ABILITY_NAMES[a]}</b><span className="cc-total"><b className="tnum">{final[a]}</b><small className="tnum">{fmt(mod(final[a]))}</small></span></div>
                  {(d.method === 'standard' || d.method === 'rolled') && (
                    <select className="field" aria-label={`${ABILITY_NAMES[a]} base score`} value={d.assign[a] ?? ''}
                      onChange={e => {
                        const v = e.target.value === '' ? undefined : Number(e.target.value)
                        const next = { ...d.assign }
                        const holder = ABILITIES.find(k => k !== a && next[k] === v)
                        if (holder) { if (next[a] !== undefined) next[holder] = next[a]; else delete next[holder] }
                        if (v === undefined) delete next[a]; else next[a] = v
                        set({ assign: next })
                      }}>
                      <option value="">Choose</option>
                      {pool.map((v, i) => {
                        const by = ABILITIES.find(k => d.assign[k] === i)
                        return <option key={i} value={i}>{v}{by && by !== a ? ` (swap with ${by.toUpperCase()})` : ''}</option>
                      })}
                    </select>
                  )}
                  {d.method === 'pointbuy' && (
                    <div className="stepper">
                      <button className="btn sm" aria-label={`Lower ${ABILITY_NAMES[a]}`} disabled={d.scores[a] <= 8} onClick={() => set({ scores: { ...d.scores, [a]: d.scores[a] - 1 } })}>−</button>
                      <b className="tnum">{d.scores[a]}</b>
                      <button className="btn sm" aria-label={`Raise ${ABILITY_NAMES[a]}`} disabled={d.scores[a] >= 15 || spent + (POINT_COST[d.scores[a] + 1] - POINT_COST[d.scores[a]]) > 27}
                        onClick={() => set({ scores: { ...d.scores, [a]: d.scores[a] + 1 } })}>+</button>
                      <small className="muted tnum">{POINT_COST[d.scores[a]]} pts</small>
                    </div>
                  )}
                  {d.method === 'manual' && (
                    <input className="field" inputMode="numeric" aria-label={`${ABILITY_NAMES[a]} score`} value={d.scores[a]}
                      onChange={e => set({ scores: { ...d.scores, [a]: Math.min(30, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)) } })} />
                  )}
                  <table className="cc-t"><tbody>
                    <tr><th>Base</th><td className="tnum">{base[a] || '—'}</td></tr>
                    <tr><th>Background</th><td className="tnum">{bgBonus(a) ? fmt(bgBonus(a)) : '—'}</td></tr>
                    <tr><th>Other</th><td><input className="field mini tnum" inputMode="numeric" aria-label={`${ABILITY_NAMES[a]} other modifier`} value={d.other[a] ?? ''} placeholder="0"
                      onChange={e => set({ other: { ...d.other, [a]: Number(e.target.value.replace(/[^\d-]/g, '')) || 0 } })} /></td></tr>
                    <tr><th>Override</th><td><input className="field mini tnum" inputMode="numeric" aria-label={`${ABILITY_NAMES[a]} override`} value={d.override[a] ?? ''} placeholder="—"
                      onChange={e => { const v = e.target.value.replace(/\D/g, ''); const o = { ...d.override }; if (v) o[a] = Math.min(30, Number(v)); else delete o[a]; set({ override: o }) }} /></td></tr>
                  </tbody></table>
                </div>
              ))}
            </div>
            {!bonusDone && <p className="muted small"><AlertCircle size={14} /> Background increases are not set yet. <button className="linklike" onClick={() => go('background')}>Set them on Background</button></p>}
          </>)}

          {step === 'equipment' && (<>
            <div className="panel-h"><h2>Starting equipment</h2></div>
            {!info ? <p className="muted">Pick a class first to see its starting equipment. <button className="linklike" onClick={() => go('class')}>Go to Class</button></p> : (
              <>
                <h3 className="group-h">From your class ({d.cls})</h3>
                <div className="kits" role="radiogroup" aria-label="Class equipment">
                  {kits.map(k => (
                    <button key={k.label} role="radio" aria-checked={d.kit === k.label} className="kit" onClick={() => set({ kit: k.label })}>
                      <b>Option {k.label}</b>
                      {k.items.length ? <span>{k.items.map(([n, q]) => q > 1 ? `${q} ${n}` : n).join(', ')}, {k.gp} GP</span> : <span>{k.gp} GP to buy your own gear</span>}
                    </button>
                  ))}
                </div>
                <p className="muted small">From the free 2024 rules (SRD 5.2). If your table uses different kits, adjust the inventory on the sheet.</p>
              </>
            )}
            <h3 className="group-h">From your background{d.bg ? ` (${d.bg})` : ''}</h3>
            <div className="kits" role="radiogroup" aria-label="Background equipment">
              <button role="radio" aria-checked={d.bgEquip === 'kit'} className="kit" onClick={() => set({ bgEquip: 'kit' })}><b>Option A</b><span>The kit listed in your book</span></button>
              <button role="radio" aria-checked={d.bgEquip === 'gold'} className="kit" onClick={() => set({ bgEquip: 'gold' })}><b>Option B</b><span>50 GP</span></button>
            </div>
            {d.bgEquip === 'kit' && (
              <div className="form-grid two">
                <div><label className="lab" htmlFor="bgi">Items, separated by commas</label>
                  <input id="bgi" className="field" value={d.bgItems} placeholder="e.g. Calligrapher's Supplies, Book, Parchment" onChange={e => set({ bgItems: e.target.value })} /></div>
                <div><label className="lab" htmlFor="bgg">Gold in the kit</label>
                  <input id="bgg" className="field num-in wide" inputMode="numeric" value={d.bgGp} onChange={e => set({ bgGp: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></div>
              </div>
            )}
            <h3 className="group-h">Anything else</h3>
            <div className="chips">
              {GEAR.map(g => {
                const on = d.extra.includes(g)
                return <button key={g} className="chip" aria-pressed={on} onClick={() => set({ extra: on ? d.extra.filter(x => x !== g) : [...d.extra, g] })}>{g}</button>
              })}
            </div>
          </>)}

          {step === 'review' && (<>
            <div className="panel-h"><h2>What's next</h2></div>
            {missing.length > 0 ? (
              <div className="callout req">
                <b>Before you can create this character:</b>
                <ul>{(Object.keys(todo) as StepKey[]).flatMap(k => todo[k].required.map(t => <li key={t}><button className="linklike" onClick={() => go(k)}>{t}</button></li>))}</ul>
              </div>
            ) : <div className="callout ok"><Check size={16} /> Ready. You can still change anything on the sheet afterwards.</div>}
            {(Object.keys(todo) as StepKey[]).some(k => todo[k].optional.length) && (
              <div className="callout">
                <b>Optional, but worth doing:</b>
                <ul>{(Object.keys(todo) as StepKey[]).flatMap(k => todo[k].optional.map(t => <li key={t}><button className="linklike" onClick={() => go(k)}>{t}</button></li>))}</ul>
              </div>
            )}
            <div className="foot">
              <button className="btn ghost" onClick={reset}><RotateCcw size={14} /> Start over</button>
              <button className="btn primary" disabled={missing.length > 0} onClick={create}>
                {missing.length ? `Missing: ${short.join(', ')}` : 'Create character'}
              </button>
            </div>
          </>)}

          {step !== 'review' && (
            <div className="foot">
              <button className="btn" disabled={idx === 0} onClick={() => go(STEPS[idx - 1].key)}><ArrowLeft size={16} /> {idx > 0 ? STEPS[idx - 1].label : 'Back'}</button>
              <button className="btn primary" onClick={() => go(STEPS[idx + 1].key)}>{STEPS[idx + 1].label} <ArrowRight size={16} /></button>
            </div>
          )}
        </section>

        <aside className="panel builder-summary" aria-label="Character so far">
          <h2 className="sum-name">{d.name || 'Unnamed character'}</h2>
          <p className="muted small">{[d.species || 'No species', d.cls ? `${d.cls} ${d.level}` : 'no class', d.bg].filter(Boolean).join(' · ')}</p>
          <div className="sum-abs">
            {ABILITIES.map(a => (
              <div key={a}><span className="k">{a}</span><b className="tnum">{final[a] || '—'}</b><small className="tnum">{final[a] ? fmt(mod(final[a])) : ''}</small></div>
            ))}
          </div>
          <dl className="facts compact">
            <div><dt>HP</dt><dd className="tnum">{d.cls ? hp : '—'}</dd></div>
            <div><dt>AC</dt><dd className="tnum">{ac}</dd></div>
            <div><dt>Speed</dt><dd className="tnum">{sp?.speed ?? 30} ft.</dd></div>
            <div><dt>Skills</dt><dd>{d.skills.length ? d.skills.map(k => SKILLS.find(s => s.key === k)?.name).join(', ') : '—'}</dd></div>
            <div><dt>Gear</dt><dd className="tnum">{items.length} items, {gp} GP</dd></div>
          </dl>
          <button className="btn primary full" disabled={missing.length > 0} onClick={create}>{missing.length ? `${missing.length} required left` : 'Create character'}</button>
        </aside>
      </div>
    </div>
  )
}

function Choice({ title, done, note, children }: { title: string; done: boolean; note?: string; children: ReactNode }) {
  return (
    <div className={`choice-card ${done ? 'done' : 'open'}`}>
      <h3 className="choice-h">{done ? <Check size={16} aria-label="Done" /> : <span className="choice-dot" aria-label="Needs a choice">!</span>} {title}</h3>
      {note && <p className="muted small">{note}</p>}
      {children}
    </div>
  )
}

const rollSix = () => Array.from({ length: 6 }, () => roll(6, 4).dice)
const sumBest3 = (r: number[]) => r.slice().sort((a, b) => b - a).slice(0, 3).reduce((s, v) => s + v, 0)
