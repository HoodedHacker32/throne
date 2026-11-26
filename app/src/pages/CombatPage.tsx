import { useCallback, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookmarkPlus, ExternalLink, Plus, SkipForward, Trash2, UserPlus, X } from 'lucide-react'
import { Drawer } from '../components/Drawer'
import { db, type Character, type Combatant, type Monster } from '../db'
import { CONDITIONS } from '../lib/rules'
import { initiative } from '../lib/character'
import { roll } from '../lib/dice'
import { useCampaignId, useCharacters, useMedia, useOptimistic } from '../lib/hooks'
import { CRS, CR_XP, budgetFor, rate } from '../lib/encounter'

const order = (a: Combatant, b: Combatant) => b.initiative - a.initiative || a.name.localeCompare(b.name)

export function CombatPage() {
  const cid = useCampaignId()
  const chars = useCharacters()
  const list = useLiveQuery(() => cid ? db.combatants.where('campaignId').equals(cid).toArray() : [], [cid], [] as Combatant[]).slice().sort(order)
  const state = useLiveQuery(() => cid ? db.combat.where('campaignId').equals(cid).first() : undefined, [cid])
  const [form, setForm] = useState({ name: '', init: '', hp: '', ac: '', count: '1', cr: '' })
  const [selId, setSelId] = useState<number | null>(null)
  const saved = useLiveQuery(() => db.monsters.orderBy('name').toArray(), [], [] as Monster[])
  const wide = useMedia('(min-width: 1100px)')

  if (!cid) return <div className="page"><p className="muted">Pick a campaign first.</p></div>
  const round = state?.round ?? 1
  const turn = Math.min(state?.turn ?? 0, Math.max(0, list.length - 1))
  const active = state?.active ?? false

  async function setState(patch: { round?: number; turn?: number; active?: boolean }) {
    if (state) await db.combat.update(state.id, patch)
    else await db.combat.add({ campaignId: cid!, round: 1, turn: 0, active: false, ...patch })
  }
  /** "Goblin" x2 when "Goblin 1" is already fighting -> "Goblin 2", "Goblin 3". */
  function names(base: string, n: number) {
    const taken = list.map(c => c.name.match(new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: (\\d+))?$`, 'i'))).filter(Boolean)
    if (n === 1 && taken.length === 0) return [base]
    let next = Math.max(0, ...taken.map(m => Number(m![1] ?? 1))) + 1
    if (taken.length === 0) next = 1
    return Array.from({ length: n }, () => `${base} ${next++}`)
  }
  async function addMonster() {
    const name = form.name.trim(); if (!name) return
    const n = Math.min(12, Math.max(1, Number(form.count) || 1))
    const hp = Number(form.hp) || 1
    await db.combatants.bulkAdd(names(name, n).map(nm => ({
      campaignId: cid!, name: nm,
      initiative: form.init ? Number(form.init) : roll(20).total,
      hp, maxHp: hp, ac: Number(form.ac) || 10, conditions: [], isPlayer: false, cr: form.cr || undefined,
    })))
    setForm({ name: '', init: '', hp: '', ac: '', count: '1', cr: '' })
  }
  async function addSaved(m: Monster) {
    const n = Math.min(12, Math.max(1, Number(form.count) || 1))
    await db.combatants.bulkAdd(names(m.name, n).map(nm => ({
      campaignId: cid!, name: nm, initiative: roll(20, 1, m.initBonus).total,
      hp: m.hp, maxHp: m.hp, ac: m.ac, conditions: [], isPlayer: false, cr: m.cr, notes: m.notes,
    })))
  }
  async function addParty() {
    const have = new Set(list.map(l => l.characterId))
    await db.combatants.bulkAdd(chars.filter(c => !have.has(c.id)).map(c => ({
      campaignId: cid!, name: c.name.replace(/^Sample:\s*/, ''), initiative: roll(20, 1, initiative(c)).total,
      hp: c.hpCurrent, maxHp: c.hpMax, ac: c.ac, conditions: [], isPlayer: true, characterId: c.id,
    })))
  }
  async function next() {
    if (!list.length) return
    if (!active) return setState({ active: true, round: 1, turn: 0 })
    const t = turn + 1
    if (t >= list.length) await setState({ turn: 0, round: round + 1 })
    else await setState({ turn: t })
  }
  async function end() {
    if (!confirm('End combat and clear enemies? Party members stay.')) return
    await db.combatants.where('campaignId').equals(cid!).filter(c => !c.isPlayer).delete()
    await setState({ active: false, round: 1, turn: 0 })
  }
  const upd = (c: Combatant, patch: Partial<Combatant>) => db.combatants.update(c.id, patch)

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Combat</h1><p>{active ? <>Round <b className="tnum">{round}</b> · {list[turn]?.name ?? ''}'s turn</> : 'Add combatants, then start.'}</p></div>
        <div className="actions-row">
          {active && <button className="btn" onClick={end}>End combat</button>}
          <button className="btn primary" onClick={next} disabled={!list.length}><SkipForward size={16} /> {active ? 'Next turn' : 'Start combat'}</button>
        </div>
      </div>

      <section className="panel add-combatant" aria-label="Add combatant">
        <div className="combat-form">
          <input className="field" placeholder="Name, e.g. Goblin" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} aria-label="Name"
            onKeyDown={e => e.key === 'Enter' && addMonster()} />
          <input className="field" inputMode="numeric" placeholder="Init (auto)" value={form.init} onChange={e => setForm({ ...form, init: e.target.value })} aria-label="Initiative, blank to roll" />
          <input className="field" inputMode="numeric" placeholder="HP" value={form.hp} onChange={e => setForm({ ...form, hp: e.target.value })} aria-label="Hit points" />
          <input className="field" inputMode="numeric" placeholder="AC" value={form.ac} onChange={e => setForm({ ...form, ac: e.target.value })} aria-label="Armor class" />
          <select className="field" value={form.cr} onChange={e => setForm({ ...form, cr: e.target.value })} aria-label="Challenge rating">
            <option value="">CR</option>{CRS.map(c => <option key={c} value={c}>CR {c}</option>)}
          </select>
          <input className="field" inputMode="numeric" placeholder="How many" value={form.count} onChange={e => setForm({ ...form, count: e.target.value })} aria-label="How many" />
          <button className="btn primary" onClick={addMonster} disabled={!form.name.trim()}><Plus size={16} /> Add</button>
          <button className="btn" onClick={addParty} disabled={!chars.length}><UserPlus size={16} /> Add party</button>
        </div>
      </section>

      {saved.length > 0 && (
        <div className="saved-monsters" aria-label="Saved monsters">
          <span className="muted small">Quick add{Number(form.count) > 1 ? ` ×${form.count}` : ''}:</span>
          {saved.map(m => (
            <span key={m.id} className="sm-chip">
              <button onClick={() => addSaved(m)} title={`HP ${m.hp}, AC ${m.ac}${m.cr ? `, CR ${m.cr}` : ''}`}>{m.name}{m.cr ? <small> CR {m.cr}</small> : null}</button>
              <button className="sm-x" aria-label={`Forget ${m.name}`} onClick={() => confirm(`Remove ${m.name} from your saved monsters?`) && db.monsters.delete(m.id)}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <Difficulty list={list} party={chars} />
      {list.length === 0 && <div className="panel empty"><h2>Nobody in the fight</h2><p>Add enemies above, and pull the party in with one tap. Blank initiative rolls a d20 for you.</p></div>}
      {list.length > 0 && (() => {
        const sel = list.find(x => x.id === selId) ?? (wide ? list[turn] : undefined)
        const detail = sel && <Detail c={sel} upd={upd} />
        return (
          <div className="combat-layout">
            <ol className="ini-list">
              {list.map((c, i) => <Row key={c.id} c={c} current={active && i === turn} selected={sel?.id === c.id} onSelect={() => setSelId(c.id)} upd={upd} />)}
            </ol>
            {wide ? <aside className="panel combat-detail">{detail}</aside>
              : sel && selId !== null && <Drawer title={sel.name} onClose={() => setSelId(null)}>{detail}</Drawer>}
          </div>
        )
      })()}
    </div>
  )
}

function Row({ c: stored, current, selected, onSelect }: { c: Combatant; current: boolean; selected: boolean; onSelect: () => void; upd: (c: Combatant, p: Partial<Combatant>) => unknown }) {
  const [c, set] = useOptimistic(stored, useCallback((p: Partial<Combatant>) => db.combatants.update(stored.id, p), [stored.id]))
  const [amt, setAmt] = useState('')
  const [cond, setCond] = useState(false)
  const n = Math.max(0, Number(amt) || 0)
  const pct = c.maxHp ? (c.hp / c.maxHp) * 100 : 0
  const down = c.hp <= 0
  return (
    <li className={`ini ${current ? 'cur' : ''} ${selected ? 'sel' : ''} ${down ? 'down' : ''} ${c.isPlayer ? 'pc' : ''}`} aria-current={current ? 'step' : undefined}>
      <input className="initn tnum" inputMode="numeric" aria-label={`${c.name} initiative`} value={c.initiative}
        onChange={e => set({ initiative: Number(e.target.value) || 0 })} />
      <div className="who">
        <button className="nm row-name" onClick={onSelect}>{c.name}{c.isPlayer && <span className="kind pc-tag">PC</span>}</button>
        <div className="bar-line">
          <div className={`bar ${pct <= 33 ? 'low' : ''}`} aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
          <span className="tnum small">{c.hp}/{c.maxHp} HP · AC {c.ac}{c.cr ? ` · CR ${c.cr}` : ''}</span>
        </div>
        <div>
          {c.conditions.map(k => (
            <button key={k} className="cond" onClick={() => set({ conditions: c.conditions.filter(x => x !== k) })} aria-label={`Remove ${k}`}>{k} <X size={10} /></button>
          ))}
          <button className="cond add" onClick={() => setCond(!cond)} aria-expanded={cond}>+ condition</button>
        </div>
        {cond && (
          <div className="chips cond-pick">
            {CONDITIONS.filter(k => !c.conditions.includes(k)).map(k => (
              <button key={k} className="chip" onClick={() => { set({ conditions: [...c.conditions, k] }); setCond(false) }}>{k}</button>
            ))}
          </div>
        )}
      </div>
      <div className="extra hp-ctl">
        <button className="btn sm dmg" disabled={!n} onClick={() => { set({ hp: Math.max(0, c.hp - n) }); setAmt('') }}>Dmg</button>
        <input className="field num-in" inputMode="numeric" placeholder="0" aria-label={`Amount for ${c.name}`} value={amt} onChange={e => setAmt(e.target.value.replace(/\D/g, ''))} />
        <button className="btn sm heal" disabled={!n} onClick={() => { set({ hp: Math.min(c.maxHp, c.hp + n) }); setAmt('') }}>Heal</button>
      </div>
      <button className="btn ghost sm" aria-label={`Remove ${c.name}`} onClick={() => db.combatants.delete(c.id)}><Trash2 size={16} /></button>
    </li>
  )
}

function Detail({ c: stored }: { c: Combatant; upd: (c: Combatant, p: Partial<Combatant>) => unknown }) {
  const [c, set] = useOptimistic(stored, useCallback((p: Partial<Combatant>) => db.combatants.update(stored.id, p), [stored.id]))
  const [amt, setAmt] = useState('')
  const n = Math.max(0, Number(amt) || 0)
  const num = (label: string, v: number, set: (v: number) => void): ReactNode => (
    <label className="cd-num"><span className="k">{label}</span>
      <input className="field num-in tnum" inputMode="numeric" value={v} onChange={e => set(Number(e.target.value.replace(/[^\d-]/g, '')) || 0)} /></label>
  )
  return (
    <div className="cd">
      <div className="cd-head">
        <h2>{c.name}</h2>
        {c.characterId && <Link className="btn ghost sm" to={`/characters/${c.characterId}`}><ExternalLink size={14} /> Sheet</Link>}
      </div>
      <div className="hp-big tnum"><b className={c.hp <= c.maxHp / 3 ? 'low' : ''}>{c.hp}</b> / {c.maxHp}{c.tempHp ? <span className="temp"> +{c.tempHp} temp</span> : null}</div>
      <input className="field hp-amt" inputMode="numeric" placeholder="Amount" aria-label={`Amount for ${c.name}`} value={amt} onChange={e => setAmt(e.target.value.replace(/\D/g, ''))} />
      <div className="hp-btns">
        <button className="btn heal" disabled={!n} onClick={() => { set({ hp: Math.min(c.maxHp, c.hp + n) }); setAmt('') }}>Heal</button>
        <button className="btn dmg" disabled={!n} onClick={() => {
          const t = Math.min(c.tempHp ?? 0, n)
          set({ tempHp: (c.tempHp ?? 0) - t, hp: Math.max(0, c.hp - (n - t)) }); setAmt('')
        }}>Damage</button>
        <button className="btn" disabled={!n} onClick={() => { set({ tempHp: n }); setAmt('') }}>Set temp</button>
      </div>
      <div className="cd-nums">
        {num('Initiative', c.initiative, v => set({ initiative: v }))}
        {num('AC', c.ac, v => set({ ac: v }))}
        {num('Max HP', c.maxHp, v => set({ maxHp: Math.max(1, v) }))}
      </div>
      {!c.isPlayer && (
        <label className="lab cd-cr">Challenge rating
          <select className="field" value={c.cr ?? ''} onChange={e => set({ cr: e.target.value || undefined })}>
            <option value="">Not set</option>{CRS.map(x => <option key={x} value={x}>CR {x} · {CR_XP[x].toLocaleString()} XP</option>)}
          </select>
        </label>
      )}
      <label className="lab">Conditions</label>
      <div className="chips">
        {CONDITIONS.map(k => <button key={k} className="chip" aria-pressed={c.conditions.includes(k)}
          onClick={() => set({ conditions: c.conditions.includes(k) ? c.conditions.filter(x => x !== k) : [...c.conditions, k] })}>{k}</button>)}
      </div>
      {!c.isPlayer && <SaveMonster c={c} />}
      <label className="lab" htmlFor={`cn-${c.id}`}>Notes</label>
      <textarea id={`cn-${c.id}`} className="field area" rows={4} placeholder="Tactics, resistances, loot…" value={c.notes ?? ''} onChange={e => set({ notes: e.target.value })} />
    </div>
  )
}

const RATING_LABEL = { none: 'No enemies with a CR yet', trivial: 'Below low', low: 'Low', moderate: 'Moderate', high: 'High', over: 'Beyond high' } as const

function Difficulty({ list, party }: { list: Combatant[]; party: Character[] }) {
  const pcs = list.filter(c => c.isPlayer)
  // Party = PCs in the fight; before any are added, the campaign's characters.
  const lv = pcs.length ? pcs.map(p => party.find(c => c.id === p.characterId)?.level ?? 1) : party.map(c => c.level)
  const enemies = list.filter(c => !c.isPlayer)
  const xp = enemies.reduce((t, c) => t + (c.cr ? CR_XP[c.cr] ?? 0 : 0), 0)
  const unrated = enemies.filter(c => !c.cr).length
  if (!lv.length) return null
  const b = budgetFor(lv)
  const r = rate(xp, b)
  const max = Math.max(b.high * 1.25, xp)
  const pos = (v: number) => `${Math.min(100, (v / max) * 100)}%`
  return (
    <section className={`panel encounter r-${r}`} aria-label="Encounter difficulty">
      <div className="enc-top">
        <div><span className="k">Difficulty</span><b>{RATING_LABEL[r]}</b></div>
        <div><span className="k">Enemy XP</span><b className="tnum">{xp.toLocaleString()}</b></div>
        <div className="hide-s"><span className="k">Party</span><b className="tnum">{lv.length} × lvl {lv.length ? Math.round(lv.reduce((a, c) => a + c, 0) / lv.length) : '–'}</b></div>
      </div>
      <div className="gauge" aria-hidden="true">
        <i className="fill" style={{ width: pos(xp) }} />
        {(['low', 'moderate', 'high'] as const).map(k => <span key={k} className="tick" style={{ left: pos(b[k]) }}><small>{k} {b[k].toLocaleString()}</small></span>)}
      </div>
      <p className="muted small tnum show-s">Low {b.low.toLocaleString()} · Moderate {b.moderate.toLocaleString()} · High {b.high.toLocaleString()} XP</p>
      {unrated > 0 && <p className="muted small">{unrated} {unrated === 1 ? 'enemy has' : 'enemies have'} no CR, so {unrated === 1 ? 'it is' : 'they are'} not counted. Set CR when adding, or in the side panel.</p>}
    </section>
  )
}

function SaveMonster({ c }: { c: Combatant }) {
  const base = c.name.replace(/\s+\d+$/, '')
  const existing = useLiveQuery(() => db.monsters.where('name').equalsIgnoreCase(base).first(), [base])
  const [bonus, setBonus] = useState<string | null>(null)
  const shown = bonus ?? String(existing?.initBonus ?? 0)
  async function save() {
    const data = { name: base, hp: c.maxHp, ac: c.ac, cr: c.cr, initBonus: Number(shown) || 0, notes: c.notes, createdAt: Date.now() }
    if (existing) await db.monsters.update(existing.id, data); else await db.monsters.add(data)
  }
  return (
    <div className="save-monster">
      <label className="small muted" htmlFor={`ib-${c.id}`}>Initiative bonus</label>
      <input id={`ib-${c.id}`} className="field num-in" inputMode="numeric" value={shown} onChange={e => setBonus(e.target.value.replace(/[^\d-]/g, ''))} />
      <button className="btn sm" onClick={save}><BookmarkPlus size={14} /> {existing ? `Update saved ${base}` : `Save ${base} for later`}</button>
    </div>
  )
}
