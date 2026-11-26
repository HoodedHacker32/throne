import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Dices, RotateCcw, Sparkles, Wand2 } from 'lucide-react'
import { blankCharacter, db, type Item } from '../db'
import {
  ABILITIES, ABILITY_NAMES, ALIGNMENTS, CLASSES, ITEM_WEIGHT, POINT_COST, SKILLS, STANDARD_ARRAY, STARTING_EQUIPMENT,
  armorClass, fmt, mod, type Ability,
} from '../lib/rules'
import { BACKGROUNDS, CLASS_DETAIL, SPECIES_2024 } from '../lib/origins'
import { roll } from '../lib/dice'
import { CASTING_ABILITY, slotsFor } from '../lib/spells'
import { useCampaignId } from '../lib/hooks'
import { DraftInput, DraftTextarea, NumberInput } from '../components/DraftInput'

/* Character builder (2024 rules, SRD 5.2 data). One URL per step, free navigation, autosaved draft.
   Each step follows the same pattern: pick from tiles, then the choice collapses into a card with
   "Change" and the follow-up choices that belong to it (class skills, background increases...). */

const STEPS = [
  { key: 'class', label: 'Class' }, { key: 'background', label: 'Background' }, { key: 'species', label: 'Species' },
  { key: 'abilities', label: 'Abilities' }, { key: 'equipment', label: 'Equipment' }, { key: 'finish', label: 'Finish' },
] as const
type StepKey = (typeof STEPS)[number]['key']
type Method = 'standard' | 'pointbuy' | 'rolled' | 'manual'
const CUSTOM = 'Custom'

interface Draft {
  v: 3
  name: string; alignment: string; traits: string; ideals: string; bonds: string; flaws: string; backstory: string
  cls: string; level: number; hpMode: 'average' | 'manual'; hpManual: number; clsSkills: string[]
  bg: string; bgName: string; bgAbilities: Ability[]; bgSkills: string[]; bgMode: '21' | '111'; plus2: Ability | ''; plus1: Ability | ''; plus111: Ability[]
  species: string; extraSkill: string
  method: Method; assign: Partial<Record<Ability, number>>; scores: Record<Ability, number>; rolls: number[][]
  other: Partial<Record<Ability, number>>; override: Partial<Record<Ability, number>>
  kit: string; bgEquip: 'kit' | 'gold'; bgItems: string; extra: string[]
}

const BASE8: Record<Ability, number> = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
const NEW: Draft = {
  v: 3, name: '', alignment: '', traits: '', ideals: '', bonds: '', flaws: '', backstory: '',
  cls: '', level: 1, hpMode: 'average', hpManual: 0, clsSkills: [],
  bg: '', bgName: '', bgAbilities: [], bgSkills: [], bgMode: '21', plus2: '', plus1: '', plus111: [],
  species: '', extraSkill: '',
  method: 'standard', assign: {}, scores: BASE8, rolls: [], other: {}, override: {},
  kit: 'A', bgEquip: 'kit', bgItems: '', extra: [],
}
const GEAR = ['Backpack', 'Bedroll', 'Rations (1 day)', 'Rope (50 ft.)', 'Torch', 'Waterskin', 'Tinderbox', "Healer's Kit", 'Potion of Healing', 'Crowbar', 'Lantern', 'Oil (flask)', 'Ink and Quill', "Traveler's Clothes"]
const KEY = 'throne.builderDraft'
const skillName = (k: string) => SKILLS.find(s => s.key === k)?.name ?? k

function load(): Draft {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return v?.v === 3 ? { ...NEW, ...v } : NEW } catch { return NEW }
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
  const [changing, setChanging] = useState<'' | 'class' | 'background' | 'species'>('')
  const step = (STEPS.find(s => s.key === raw)?.key ?? null) as StepKey | null
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* private mode */ } }, [d])
  useEffect(() => { setChanging(''); document.querySelector('.main')?.scrollTo(0, 0) }, [step])
  const set = (p: Partial<Draft>) => setD(prev => ({ ...prev, ...p }))

  /* ---------- Derived ---------- */
  const info = CLASSES.find(c => c.name === d.cls)
  const cd = CLASS_DETAIL[d.cls]
  const sp = SPECIES_2024.find(s => s.name === d.species)
  const bgData = BACKGROUNDS.find(b => b.name === d.bg)
  const bgAbilities: Ability[] = bgData ? bgData.abilities : d.bg === CUSTOM ? [...ABILITIES] : []
  const bgSkills = bgData ? [...bgData.skills] : d.bg === CUSTOM ? d.bgSkills : []
  const clsChoices = info?.skillChoices ?? 0
  const clsSkills = d.clsSkills.filter(k => !bgSkills.includes(k))
  const skills = [...new Set([...bgSkills, ...clsSkills, ...(sp?.extraSkill && d.extraSkill ? [d.extraSkill] : [])])]

  const pool = d.method === 'standard' ? STANDARD_ARRAY : d.method === 'rolled' ? d.rolls.map(sumBest3) : []
  const base: Record<Ability, number> = useMemo(() => {
    if (d.method === 'standard' || d.method === 'rolled') return Object.fromEntries(ABILITIES.map(a => [a, pool[d.assign[a] ?? -1] ?? 0])) as Record<Ability, number>
    return d.scores
  }, [d.method, d.assign, d.scores, pool])
  const bgBonus = (a: Ability) => !bgAbilities.includes(a) ? 0 : d.bgMode === '21' ? (d.plus2 === a ? 2 : 0) + (d.plus1 === a ? 1 : 0) : d.plus111.includes(a) ? 1 : 0
  const total = (a: Ability) => d.override[a] ?? (base[a] ? Math.min(20, base[a] + bgBonus(a) + (d.other[a] ?? 0)) : 0)
  const final = Object.fromEntries(ABILITIES.map(a => [a, total(a)])) as Record<Ability, number>
  const spent = ABILITIES.reduce((s, a) => s + (POINT_COST[d.scores[a]] ?? 0), 0)
  const abilitiesDone = d.method === 'pointbuy' ? spent <= 27 : d.method === 'manual' ? true : d.method === 'rolled' && !d.rolls.length ? false : ABILITIES.every(a => d.assign[a] !== undefined)
  const hitDie = info?.hitDie ?? 8
  const conMod = mod(final.con || 10)
  const avgHp = Math.max(1, hitDie + conMod + (d.level - 1) * (hitDie / 2 + 1 + conMod) + (sp?.hpPerLevel ?? 0) * d.level)
  const hp = d.hpMode === 'manual' && d.hpManual > 0 ? d.hpManual : avgHp

  const kits = STARTING_EQUIPMENT[d.cls] ?? []
  const kit = kits.find(k => k.label === d.kit) ?? kits[0]
  const bgKitItems: [string, number][] = d.bgEquip !== 'kit' ? [] : bgData ? bgData.items
    : d.bgItems.split(',').map(s => s.trim()).filter(Boolean).map(n => [n, 1])
  const items: Item[] = [
    ...(kit?.items ?? []).map(([name, qty]) => ({ name, qty, weight: ITEM_WEIGHT[name] ?? 0, equipped: name in ITEM_WEIGHT && !/Arrows|Javelin|Dagger|Handaxe/.test(name) })),
    ...bgKitItems.map(([name, qty]) => ({ name, qty, weight: ITEM_WEIGHT[name] ?? 0, equipped: false })),
    ...d.extra.map(name => ({ name, qty: 1, weight: 0, equipped: false })),
  ]
  const gp = (kit?.gp ?? 0) + (d.bgEquip === 'gold' ? 50 : bgData?.gp ?? 0)
  const ac = armorClass(items.map(i => i.name), mod(final.dex || 10), d.cls, conMod, mod(final.wis || 10))

  /* ---------- What is left per step ---------- */
  const bonusDone = d.bgMode === '21' ? !!d.plus2 && !!d.plus1 && d.plus2 !== d.plus1 && bgAbilities.includes(d.plus2) && bgAbilities.includes(d.plus1)
    : d.plus111.filter(a => bgAbilities.includes(a)).length === 3
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
  const todo: Record<StepKey, { required: string[]; optional: string[] }> = {
    class: { required: d.cls ? [] : ['Choose a class'], optional: d.cls && clsSkills.length < clsChoices ? [`Choose ${plural(clsChoices - clsSkills.length, 'class skill')}`] : [] },
    background: {
      required: d.bg ? [] : ['Choose a background'],
      optional: !d.bg ? [] : [
        ...(bonusDone ? [] : ['Set ability score increases']),
        ...(d.bg === CUSTOM && d.bgSkills.length < 2 ? [`Choose ${plural(2 - d.bgSkills.length, 'background skill')}`] : []),
      ],
    },
    species: { required: d.species ? [] : ['Choose a species'], optional: sp?.extraSkill && !d.extraSkill ? ['Choose your extra skill'] : [] },
    abilities: { required: abilitiesDone ? [] : [d.method === 'pointbuy' ? 'Spend no more than 27 points' : d.method === 'rolled' && !d.rolls.length ? 'Roll your scores' : 'Assign every ability score'], optional: [] },
    equipment: { required: [], optional: [] },
    finish: { required: [], optional: d.name.trim() ? [] : ['Name your character'] },
  }
  const count = (k: StepKey) => todo[k].required.length + todo[k].optional.length
  const missing = (Object.keys(todo) as StepKey[]).filter(k => todo[k].required.length)

  if (!step) return <Navigate to="/characters/new/class" replace />
  const idx = STEPS.findIndex(s => s.key === step)
  const go = (k: StepKey) => navigate(`/characters/new/${k}`)

  /* ---------- Actions ---------- */
  function pickClass(name: string) {
    set({ cls: name, kit: 'A', clsSkills: d.cls === name ? d.clsSkills : [] })
    setChanging('')
  }
  function pickBackground(name: string) {
    const b = BACKGROUNDS.find(x => x.name === name)
    const keep = (a: Ability | '') => (a && (!b || b.abilities.includes(a)) ? a : '')
    set({
      bg: name, plus2: keep(d.plus2), plus1: keep(d.plus1), plus111: d.plus111.filter(a => !b || b.abilities.includes(a)),
      bgEquip: b ? 'kit' : 'gold', clsSkills: b ? d.clsSkills.filter(k => !b.skills.includes(k)) : d.clsSkills,
    })
    setChanging('')
  }
  function suggestScores() {
    const pri = cd?.priority ?? [...ABILITIES]
    if (d.method === 'standard') set({ assign: Object.fromEntries(pri.map((a, i) => [a, i])) })
    else if (d.method === 'rolled') {
      const order = d.rolls.map((r, i) => [sumBest3(r), i]).sort((x, y) => y[0] - x[0]).map(x => x[1])
      set({ assign: Object.fromEntries(pri.map((a, i) => [a, order[i]])) })
    } else if (d.method === 'pointbuy') set({ scores: Object.fromEntries(pri.map((a, i) => [a, [15, 15, 15, 8, 8, 8][i]])) as Record<Ability, number> })
    if (bgAbilities.length && !bonusDone) {
      const inBg = pri.filter(a => bgAbilities.includes(a))
      set({ bgMode: '21', plus2: inBg[0], plus1: inBg[1] })
    }
  }
  async function create() {
    const bgLabel = d.bg === CUSTOM ? (d.bgName.trim() || 'Custom') : d.bg
    const prof = [
      cd && `Armor: ${cd.armor}`, cd && `Weapons: ${cd.weapons}`,
      [cd?.tools, bgData?.tool].filter(Boolean).length ? `Tools: ${[cd?.tools, bgData?.tool].filter(Boolean).join(', ')}` : '',
      'Languages: Common, plus two of your choice',
    ].filter(Boolean).join('\n')
    const id = await db.characters.add(blankCharacter({
      mode: 'guided', campaignId, name: d.name.trim() || `${d.species} ${d.cls}`, className: d.cls, level: d.level,
      background: bgLabel, alignment: d.alignment, species: d.species,
      abilities: final, saveProf: info ? [...info.saves] : [], skillProf: Object.fromEntries(skills.map(s => [s, 1])),
      hpMax: hp, hpCurrent: hp, hitDie, ac, speed: sp?.speed ?? 30,
      proficiencies: prof, senses: sp?.darkvision ? `Darkvision ${sp.darkvision} ft.` : '',
      inventory: items, coins: { cp: 0, sp: 0, ep: 0, gp, pp: 0 },
      spellAbility: CASTING_ABILITY[d.cls] ?? '', slots: slotsFor(d.cls, d.level), slotsUsed: [], spells: [],
      traits: d.traits, ideals: d.ideals, bonds: d.bonds, flaws: d.flaws, backstory: d.backstory,
      features: [
        '=== CLASS ===', '', `* ${d.cls} ${d.level}`, `Hit die d${hitDie}. Saving throws: ${info?.saves.map(s => ABILITY_NAMES[s]).join(', ')}.`,
        '', '=== SPECIES ===', '', `* ${d.species}`, `${sp?.size ?? 'Medium'}, speed ${sp?.speed ?? 30} ft.`, ...(sp?.traits ?? []).map(t => `* ${t}`),
        '', '=== FEATS ===', '', ...(bgData ? [`* ${bgData.feat}`, `Origin feat from the ${bgData.name} background.`] : ['* Origin feat from your background']),
        '', 'Add the full text of features, traits and feats from your book with Edit.',
      ].join('\n'),
    }))
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
    navigate(`/characters/${id}`)
  }
  function reset() {
    if (!confirm('Start over? This clears the character you are building.')) return
    setD(NEW); go('class')
  }

  const next = STEPS[idx + 1]
  return (
    <div className="page builder b3">
      <div className="b3-head">
        <Link to="/characters" className="btn ghost sm" aria-label="Back to characters"><ArrowLeft size={14} /><span className="hide-s"> Characters</span></Link>
        <h1>New character</h1>
        <button className="btn ghost sm" onClick={reset} aria-label="Start over"><RotateCcw size={14} /><span className="hide-s"> Start over</span></button>
      </div>

      <nav className="steps v2" aria-label="Builder steps">
        {STEPS.map((s, i) => {
          const n = count(s.key)
          const req = todo[s.key].required.length > 0
          const state = n === 0 ? (s.key === 'finish' || s.key === 'equipment' ? (i < idx ? 'done' : '') : 'done') : req ? 'req' : 'todo'
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
          {/* ---------------- Class ---------------- */}
          {step === 'class' && (info && changing !== 'class' ? (<>
            <Chosen title={d.cls} sub={`d${info.hitDie} hit die · ${info.primary}`} onChange={() => setChanging('class')} />
            <dl className="facts">
              <div><dt>Saving throws</dt><dd>{info.saves.map(s => ABILITY_NAMES[s]).join(', ')}</dd></div>
              <div><dt>Armor training</dt><dd>{cd?.armor}</dd></div>
              <div><dt>Weapons</dt><dd>{cd?.weapons}</dd></div>
              {cd?.tools && <div><dt>Tools</dt><dd>{cd.tools}</dd></div>}
            </dl>
            <div className="b3-row">
              <span className="lab">Level</span>
              <div className="stepper">
                <button className="btn sm" aria-label="Lower level" disabled={d.level <= 1} onClick={() => set({ level: d.level - 1 })}>−</button>
                <b className="tnum">{d.level}</b>
                <button className="btn sm" aria-label="Raise level" disabled={d.level >= 20} onClick={() => set({ level: d.level + 1 })}>+</button>
              </div>
            </div>
            <div className="b3-row">
              <span className="lab">Hit points</span>
              <div className="seg" role="group" aria-label="Hit point method">
                <button aria-pressed={d.hpMode === 'average'} onClick={() => set({ hpMode: 'average' })}>Fixed</button>
                <button aria-pressed={d.hpMode === 'manual'} onClick={() => set({ hpMode: 'manual', hpManual: d.hpManual || avgHp })}>Rolled</button>
              </div>
              {d.hpMode === 'manual'
                ? <NumberInput className="field num-in" aria-label="Max hit points" value={d.hpManual} min={1} onNumber={n => set({ hpManual: n })} />
                : <span className="muted small tnum">{avgHp} HP{abilitiesDone ? '' : ' (before Constitution)'}</span>}
            </div>
            <Choice title={`Class skills: choose ${clsChoices}`} done={clsSkills.length >= clsChoices}
              note={bgSkills.length ? `Skills from your background (${bgSkills.map(skillName).join(', ')}) are already yours.` : undefined}>
              <SkillChips options={cd?.skills === 'any' ? SKILLS.map(s => s.key) : cd?.skills ?? []} chosen={clsSkills} max={clsChoices}
                locked={bgSkills} onChange={v => set({ clsSkills: v })} />
            </Choice>
          </>) : (<>
            <div className="panel-h"><h2>Choose a class</h2>{d.cls && <button className="btn ghost sm" onClick={() => setChanging('')}>Keep {d.cls}</button>}</div>
            <div className="pick tiles">
              {CLASSES.map(c => (
                <button key={c.name} aria-pressed={d.cls === c.name} onClick={() => pickClass(c.name)}>
                  <b>{c.name}</b><small>d{c.hitDie} · {c.primary}</small>
                </button>
              ))}
            </div>
          </>))}

          {/* ---------------- Background ---------------- */}
          {step === 'background' && (d.bg && changing !== 'background' ? (<>
            <Chosen title={d.bg === CUSTOM ? (d.bgName || 'Custom background') : d.bg} sub={bgData ? `Origin feat: ${bgData.feat}` : 'Your own background'} onChange={() => setChanging('background')} />
            {bgData ? (
              <dl className="facts">
                <div><dt>Skills</dt><dd>{bgData.skills.map(skillName).join(', ')}</dd></div>
                <div><dt>Tool</dt><dd>{bgData.tool}</dd></div>
                <div><dt>Abilities</dt><dd>{bgData.abilities.map(a => ABILITY_NAMES[a]).join(', ')}</dd></div>
              </dl>
            ) : (<>
              <label className="lab" htmlFor="bgn">Background name</label>
              <DraftInput id="bgn" className="field" value={d.bgName} placeholder="e.g. Guide, Noble, Sailor" onValue={v => set({ bgName: v })} />
              <Choice title="Background skills: choose 2" done={d.bgSkills.length >= 2}>
                <SkillChips options={SKILLS.map(s => s.key)} chosen={d.bgSkills} max={2} locked={[]} onChange={v => set({ bgSkills: v, clsSkills: d.clsSkills.filter(k => !v.includes(k)) })} />
              </Choice>
            </>)}
            <Choice title="Ability score increases" done={bonusDone}
              note={bgData ? `Raise one of ${bgData.abilities.map(a => ABILITY_NAMES[a]).join(', ')} by 2 and another by 1, or all three by 1.` : 'Raise one score by 2 and another by 1, or three scores by 1.'}>
              <div className="seg" role="group" aria-label="Increase pattern">
                <button aria-pressed={d.bgMode === '21'} onClick={() => set({ bgMode: '21' })}>+2 and +1</button>
                <button aria-pressed={d.bgMode === '111'} onClick={() => set({ bgMode: '111' })}>+1 to three</button>
              </div>
              <div className="inc-rows">
                {bgAbilities.map(a => (
                  <div key={a} className="inc-row">
                    <span className="grow">{ABILITY_NAMES[a]}</span>
                    {d.bgMode === '21' ? (<>
                      <button className="chip" aria-pressed={d.plus2 === a} onClick={() => set({ plus2: d.plus2 === a ? '' : a, plus1: d.plus1 === a ? '' : d.plus1 })}>+2</button>
                      <button className="chip" aria-pressed={d.plus1 === a} onClick={() => set({ plus1: d.plus1 === a ? '' : a, plus2: d.plus2 === a ? '' : d.plus2 })}>+1</button>
                    </>) : (
                      <button className="chip" aria-pressed={d.plus111.includes(a)} disabled={!d.plus111.includes(a) && d.plus111.length >= 3}
                        onClick={() => set({ plus111: d.plus111.includes(a) ? d.plus111.filter(x => x !== a) : [...d.plus111, a] })}>+1</button>
                    )}
                  </div>
                ))}
              </div>
            </Choice>
          </>) : (<>
            <div className="panel-h"><h2>Choose a background</h2>{d.bg && <button className="btn ghost sm" onClick={() => setChanging('')}>Keep {d.bg}</button>}</div>
            <div className="pick tiles">
              {BACKGROUNDS.map(b => (
                <button key={b.name} aria-pressed={d.bg === b.name} onClick={() => pickBackground(b.name)}>
                  <b>{b.name}</b><small>{b.skills.map(skillName).join(', ')} · {b.feat}</small>
                </button>
              ))}
              <button aria-pressed={d.bg === CUSTOM} onClick={() => pickBackground(CUSTOM)}>
                <b>Custom</b><small>Any other background: set its skills and increases yourself</small>
              </button>
            </div>
            <p className="muted small">These four come with the free rules. For a background from your book, choose Custom.</p>
          </>))}

          {/* ---------------- Species ---------------- */}
          {step === 'species' && (sp && changing !== 'species' ? (<>
            <Chosen title={sp.name} sub={`${sp.size} · speed ${sp.speed} ft.${sp.darkvision ? ` · darkvision ${sp.darkvision} ft.` : ''}`} onChange={() => setChanging('species')} />
            <h3 className="group-h">Traits</h3>
            <ul className="trait-list">{sp.traits.map(t => <li key={t}>{t}</li>)}</ul>
            <p className="muted small">Trait names only. The rules text is in your book or the free SRD.</p>
            {sp.extraSkill && (
              <Choice title="Skillful: choose 1 extra skill" done={!!d.extraSkill}>
                <SkillChips options={SKILLS.map(s => s.key)} chosen={d.extraSkill ? [d.extraSkill] : []} max={1}
                  locked={[...bgSkills, ...clsSkills]} onChange={v => set({ extraSkill: v[v.length - 1] ?? '' })} />
              </Choice>
            )}
          </>) : (<>
            <div className="panel-h"><h2>Choose a species</h2>{d.species && <button className="btn ghost sm" onClick={() => setChanging('')}>Keep {d.species}</button>}</div>
            <div className="pick tiles">
              {SPECIES_2024.map(s => (
                <button key={s.name} aria-pressed={d.species === s.name} onClick={() => { set({ species: s.name, extraSkill: '' }); setChanging('') }}>
                  <b>{s.name}</b><small>{s.size} · {s.speed} ft.{s.darkvision ? ` · darkvision ${s.darkvision}` : ''}</small>
                </button>
              ))}
            </div>
          </>))}

          {/* ---------------- Abilities ---------------- */}
          {step === 'abilities' && (<>
            <div className="panel-h"><h2>Ability scores</h2></div>
            <div className="seg wrap" role="group" aria-label="Method">
              {([['standard', 'Standard array'], ['pointbuy', 'Point buy'], ['rolled', 'Roll 4d6'], ['manual', 'Manual']] as const).map(([m, l]) => (
                <button key={m} aria-pressed={d.method === m} onClick={() => d.method !== m && set({
                  method: m, assign: {}, scores: m === 'manual' ? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } : BASE8,
                  rolls: m === 'rolled' && !d.rolls.length ? rollSix() : d.rolls,
                })}>{l}</button>
              ))}
            </div>
            <div className="b3-help">
              {d.method === 'standard' && <p className="muted small">Give each ability one of 15, 14, 13, 12, 10, 8. Picking a value that is taken swaps the two.</p>}
              {d.method === 'pointbuy' && <p className={`tnum ${spent > 27 ? 'error' : ''}`}><b>{27 - spent}</b> of 27 points left <span className="muted small">· scores 8 to 15</span></p>}
              {d.method === 'manual' && <p className="muted small">Type the scores your table agreed on.</p>}
              {d.method !== 'manual' && d.cls && <button className="btn sm" onClick={suggestScores}><Wand2 size={14} /> Suggest for a {d.cls}</button>}
            </div>
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
                <button className="btn sm" onClick={() => set({ rolls: rollSix(), assign: {} })}><Dices size={14} /> Reroll</button>
              </div>
            )}
            <div className="calc-grid">
              {ABILITIES.map(a => (
                <div key={a} className={`calc-card ${final[a] ? '' : 'empty'}`}>
                  <div className="cc-head"><b>{ABILITY_NAMES[a]}</b>
                    <span className="cc-total"><b className="tnum">{final[a] || '—'}</b><small className="tnum">{final[a] ? fmt(mod(final[a])) : ''}</small></span></div>
                  {(d.method === 'standard' || d.method === 'rolled') && (
                    <select className="field" aria-label={`${ABILITY_NAMES[a]} base score`} value={d.assign[a] ?? ''}
                      onChange={e => {
                        const v = e.target.value === '' ? undefined : Number(e.target.value)
                        const nx = { ...d.assign }
                        const holder = ABILITIES.find(k => k !== a && nx[k] === v)
                        if (holder) { if (nx[a] !== undefined) nx[holder] = nx[a]; else delete nx[holder] }
                        if (v === undefined) delete nx[a]; else nx[a] = v
                        set({ assign: nx })
                      }}>
                      <option value="">Choose</option>
                      {pool.map((v, i) => {
                        const by = ABILITIES.find(k => d.assign[k] === i)
                        return <option key={i} value={i}>{v}{by && by !== a ? ` (from ${by.toUpperCase()})` : ''}</option>
                      })}
                    </select>
                  )}
                  {d.method === 'pointbuy' && (
                    <div className="stepper">
                      <button className="btn sm" aria-label={`Lower ${ABILITY_NAMES[a]}`} disabled={d.scores[a] <= 8} onClick={() => set({ scores: { ...d.scores, [a]: d.scores[a] - 1 } })}>−</button>
                      <b className="tnum">{d.scores[a]}</b>
                      <button className="btn sm" aria-label={`Raise ${ABILITY_NAMES[a]}`} disabled={d.scores[a] >= 15 || spent + (POINT_COST[d.scores[a] + 1] - POINT_COST[d.scores[a]]) > 27}
                        onClick={() => set({ scores: { ...d.scores, [a]: d.scores[a] + 1 } })}>+</button>
                    </div>
                  )}
                  {d.method === 'manual' && (
                    <NumberInput className="field" aria-label={`${ABILITY_NAMES[a]} score`} value={d.scores[a]} min={1} max={30}
                      onNumber={n => set({ scores: { ...d.scores, [a]: n } })} />
                  )}
                  <small className="cc-why tnum">{breakdown(base[a], bgBonus(a), d.other[a] ?? 0, d.override[a])}</small>
                </div>
              ))}
            </div>
            {!bonusDone && d.bg && <p className="muted small">Background increases are not set yet. <button className="linklike" onClick={() => go('background')}>Set them on Background</button></p>}
            <details className="choice-card optional">
              <summary>Other bonuses and overrides <span className="muted small">optional</span></summary>
              <p className="muted small">For feats, magic items or house rules. An override replaces the total.</p>
              <table className="t adjust-t"><thead><tr><th>Ability</th><th>Other bonus</th><th>Override</th></tr></thead><tbody>
                {ABILITIES.map(a => (
                  <tr key={a}><td>{ABILITY_NAMES[a]}</td>
                    <td><NumberInput className="field mini tnum" aria-label={`${ABILITY_NAMES[a]} other bonus`} value={d.other[a] ?? 0} min={-10} max={10}
                      onNumber={n => set({ other: { ...d.other, [a]: n } })} /></td>
                    <td><DraftInput className="field mini tnum" inputMode="numeric" aria-label={`${ABILITY_NAMES[a]} override`} placeholder="—" value={d.override[a] ? String(d.override[a]) : ''}
                      onValue={v => { const n = parseInt(v, 10); const o = { ...d.override }; if (n > 0) o[a] = Math.min(30, n); else delete o[a]; set({ override: o }) }} /></td></tr>
                ))}
              </tbody></table>
            </details>
          </>)}

          {/* ---------------- Equipment ---------------- */}
          {step === 'equipment' && (<>
            <div className="panel-h"><h2>Starting equipment</h2></div>
            {!info ? <p className="muted">Choose a class first to see its equipment. <button className="linklike" onClick={() => go('class')}>Go to Class</button></p> : (<>
              <h3 className="group-h">{d.cls}</h3>
              <div className="kits" role="radiogroup" aria-label="Class equipment">
                {kits.map(k => (
                  <button key={k.label} role="radio" aria-checked={d.kit === k.label} className="kit" onClick={() => set({ kit: k.label })}>
                    <b>Option {k.label}</b>
                    {k.items.length ? <span>{k.items.map(([n, q]) => q > 1 ? `${q} ${n}` : n).join(', ')}, {k.gp} GP</span> : <span>{k.gp} GP to buy your own gear</span>}
                  </button>
                ))}
              </div>
            </>)}
            <h3 className="group-h">{d.bg === CUSTOM ? (d.bgName || 'Background') : d.bg || 'Background'}</h3>
            <div className="kits" role="radiogroup" aria-label="Background equipment">
              <button role="radio" aria-checked={d.bgEquip === 'kit'} className="kit" onClick={() => set({ bgEquip: 'kit' })}>
                <b>Option A</b><span>{bgData ? `${bgData.items.map(([n, q]) => q > 1 ? `${q} ${n}` : n).join(', ')}, ${bgData.gp} GP` : 'The items listed in your book'}</span></button>
              <button role="radio" aria-checked={d.bgEquip === 'gold'} className="kit" onClick={() => set({ bgEquip: 'gold' })}><b>Option B</b><span>50 GP</span></button>
            </div>
            {d.bgEquip === 'kit' && !bgData && (<>
              <label className="lab" htmlFor="bgi">Items, separated by commas</label>
              <DraftInput id="bgi" className="field" value={d.bgItems} placeholder="e.g. Book, Parchment, Robe" onValue={v => set({ bgItems: v })} />
            </>)}
            <details className="choice-card optional">
              <summary>Extra gear <span className="muted small">{d.extra.length ? `${d.extra.length} added` : 'optional'}</span></summary>
              <div className="chips">
                {GEAR.map(g => {
                  const on = d.extra.includes(g)
                  return <button key={g} className="chip" aria-pressed={on} onClick={() => set({ extra: on ? d.extra.filter(x => x !== g) : [...d.extra, g] })}>{g}</button>
                })}
              </div>
            </details>
            <p className="muted small">Items and gold from the free 2024 rules. You can change the inventory on the sheet at any time.</p>
          </>)}

          {/* ---------------- Finish ---------------- */}
          {step === 'finish' && (<>
            <div className="panel-h"><h2>Name and finish</h2></div>
            <label className="lab" htmlFor="nm">Character name</label>
            <div className="add-row" style={{ marginTop: 0 }}>
              <DraftInput id="nm" className="field" value={d.name} placeholder="Name" autoComplete="off" onValue={v => set({ name: v })} />
              <button className="btn" onClick={() => set({ name: suggestName() })}><Sparkles size={16} /> Suggest</button>
            </div>
            <label className="lab" htmlFor="al">Alignment</label>
            <select id="al" className="field" value={d.alignment} onChange={e => set({ alignment: e.target.value })}>
              <option value="">Not set</option>{ALIGNMENTS.map(a => <option key={a}>{a}</option>)}
            </select>
            <details className="choice-card optional">
              <summary>Personality and backstory <span className="muted small">optional, can be done later</span></summary>
              <div className="form-grid two">
                {(['traits', 'ideals', 'bonds', 'flaws'] as const).map(k => (
                  <div key={k}><label className="lab" htmlFor={`d-${k}`}>{k === 'traits' ? 'Personality traits' : k[0].toUpperCase() + k.slice(1)}</label>
                    <DraftTextarea id={`d-${k}`} className="field area" rows={2} value={d[k]} onValue={v => set({ [k]: v })} /></div>
                ))}
              </div>
              <label className="lab" htmlFor="d-bs">Backstory</label>
              <DraftTextarea id="d-bs" className="field area" rows={4} value={d.backstory} onValue={v => set({ backstory: v })} />
            </details>
            <div className="b3-review">
              <Summary d={d} final={final} hp={hp} ac={ac} skills={skills} items={items.length} gp={gp} ready={!!d.cls && abilitiesDone} speed={sp?.speed ?? 30} bg={d.bg === CUSTOM ? d.bgName || 'Custom' : d.bg} />
            </div>
            {missing.length > 0 ? (
              <div className="callout req">
                <b>Still needed:</b>
                <ul>{missing.flatMap(k => todo[k].required.map(t => <li key={t}><button className="linklike" onClick={() => go(k)}>{t}</button></li>))}</ul>
              </div>
            ) : (STEPS.some(s => todo[s.key].optional.length) && (
              <div className="callout">
                <b>Optional, worth a look:</b>
                <ul>{STEPS.flatMap(s => todo[s.key].optional.map(t => <li key={t}><button className="linklike" onClick={() => go(s.key)}>{t}</button></li>))}</ul>
              </div>
            ))}
          </>)}

          <div className="b3-foot">
            <button className="btn" disabled={idx === 0} onClick={() => go(STEPS[idx - 1].key)}><ArrowLeft size={16} /> <span className="hide-s">{idx > 0 ? STEPS[idx - 1].label : 'Back'}</span><span className="show-s-i">Back</span></button>
            {next
              ? <button className="btn primary" onClick={() => go(next.key)}>{next.label} <ArrowRight size={16} /></button>
              : <button className="btn primary" disabled={missing.length > 0} onClick={create}><Check size={16} /> Create character</button>}
          </div>
        </section>

        <aside className="panel builder-summary hide-s" aria-label="Character so far">
          <Summary d={d} final={final} hp={hp} ac={ac} skills={skills} items={items.length} gp={gp} ready={!!d.cls && abilitiesDone} speed={sp?.speed ?? 30} bg={d.bg === CUSTOM ? d.bgName || 'Custom' : d.bg} />
          <button className="btn primary full" disabled={missing.length > 0} onClick={create}>
            {missing.length ? `Needs ${missing.map(k => STEPS.find(s => s.key === k)!.label.toLowerCase()).join(', ')}` : 'Create character'}</button>
        </aside>
      </div>
    </div>
  )
}

function breakdown(base: number, bg: number, other: number, override?: number) {
  if (override) return `override ${override}`
  if (!base) return 'not set'
  return [`${base} base`, bg ? `${fmt(bg)} background` : '', other ? `${fmt(other)} other` : ''].filter(Boolean).join(' ')
}

function Summary({ d, final, hp, ac, skills, items, gp, ready, speed, bg }: {
  d: Draft; final: Record<Ability, number>; hp: number; ac: number; skills: string[]; items: number; gp: number; ready: boolean; speed: number; bg: string
}) {
  return (
    <>
      <h2 className="sum-name">{d.name || 'Unnamed character'}</h2>
      <p className="muted small">{[d.species || 'No species', d.cls ? `${d.cls} ${d.level}` : 'no class', bg].filter(Boolean).join(' · ')}</p>
      <div className="sum-abs">
        {ABILITIES.map(a => (
          <div key={a}><span className="k">{a}</span><b className="tnum">{final[a] || '—'}</b><small className="tnum">{final[a] ? fmt(mod(final[a])) : ''}</small></div>
        ))}
      </div>
      <dl className="facts compact">
        <div><dt>HP</dt><dd className="tnum">{ready ? hp : '—'}</dd></div>
        <div><dt>AC</dt><dd className="tnum">{ready ? ac : '—'}</dd></div>
        <div><dt>Speed</dt><dd className="tnum">{speed} ft.</dd></div>
        <div><dt>Skills</dt><dd>{skills.length ? skills.map(skillName).join(', ') : '—'}</dd></div>
        <div><dt>Gear</dt><dd className="tnum">{items} items, {gp} GP</dd></div>
      </dl>
    </>
  )
}

function Chosen({ title, sub, onChange }: { title: string; sub: string; onChange: () => void }) {
  return (
    <div className="chosen">
      <div><h2>{title}</h2><small className="muted">{sub}</small></div>
      <button className="btn sm" onClick={onChange}>Change</button>
    </div>
  )
}

function SkillChips({ options, chosen, max, locked, onChange }: { options: string[]; chosen: string[]; max: number; locked: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="chips">
      {options.map(k => {
        const on = chosen.includes(k), lock = locked.includes(k)
        return <button key={k} className={`chip ${lock ? 'locked' : ''}`} aria-pressed={on || lock} disabled={lock || (!on && chosen.length >= max && max > 1)}
          title={lock ? 'Already proficient' : undefined}
          onClick={() => onChange(on ? chosen.filter(x => x !== k) : max === 1 ? [k] : [...chosen, k])}>{lock && <Check size={13} aria-hidden="true" />}{skillName(k)}</button>
      })}
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
