import { useEffect, useState } from 'react'
import { Cloud, CloudOff, LogOut, RefreshCw } from 'lucide-react'
import { useUI } from '../state'
import { Drawer } from './Drawer'
import type { SyncStatus } from '../lib/sync'

type SyncModule = typeof import('../lib/sync')
let mod: Promise<SyncModule> | null = null
/** supabase-js is only downloaded once someone opens sync or has it switched on. */
export const loadSync = () => (mod ??= import('../lib/sync'))

/** Keeps the zustand store in step with the sync module's status. */
export function useSyncBridge() {
  const setSync = useUI(s => s.setSync)
  useEffect(() => {
    let off: (() => void) | undefined
    let on = false
    try { on = localStorage.getItem('throne.syncOn') === '1' } catch { /* ignore */ }
    if (on) loadSync().then(m => { off = m.onStatus(setSync); m.resume() })
    return () => off?.()
  }, [setSync])
}

export function SyncButton() {
  const { sync, setSyncOpen } = useUI()
  const Icon = sync.state === 'off' || sync.state === 'offline' ? CloudOff : sync.state === 'syncing' ? RefreshCw : Cloud
  const label = { off: 'Sync is off', syncing: 'Syncing…', synced: 'Synced', error: 'Sync problem', offline: 'Offline' }[sync.state]
  return (
    <button className={`icon-btn sync-btn s-${sync.state}`} onClick={() => setSyncOpen(true)} aria-label={`${label}. Open sync`} title={label}>
      <Icon size={18} className={sync.state === 'syncing' ? 'spin' : ''} />
      {(sync.state === 'error' || sync.conflicts?.length) && <span className="sync-dot" aria-hidden="true" />}
    </button>
  )
}

export function SyncPanel() {
  const { sync, setSync, syncOpen, setSyncOpen } = useUI()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => { if (syncOpen) loadSync().then(m => m.onStatus(setSync)) }, [syncOpen, setSync])
  if (!syncOpen) return null

  async function submit() {
    setBusy(true); setMsg(null)
    try {
      const m = await loadSync()
      m.onStatus(setSync)
      if (mode === 'up') {
        const r = await m.signUp(email.trim(), password)
        setMsg({ ok: true, text: r.needsConfirmation ? 'Check your email and tap the confirmation link, then sign in here.' : 'Account created.' })
        if (!r.needsConfirmation) await m.signIn(email.trim(), password)
        setMode('in')
      } else {
        await m.signIn(email.trim(), password)
        setPassword('')
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' })
    } finally { setBusy(false) }
  }
  const signedIn = !!sync.user

  return (
    <Drawer title="Sync" onClose={() => setSyncOpen(false)}>
      {signedIn ? (
        <>
          <p className="sync-state"><StateText s={sync} /></p>
          <p className="muted small">Signed in as <b>{sync.user}</b>. Campaigns, characters, notes, maps, saved monsters and random tables sync to your account. Each device keeps working offline.</p>
          {sync.conflicts?.length ? (
            <div className="callout">
              <b>Changed on two devices</b>
              <p className="small" style={{ margin: '4px 0 0' }}>Nothing was lost: the other device's version was kept as {sync.conflicts.map(c => `“${c}”`).join(', ')}. Copy what you need and delete the extra campaign.</p>
            </div>
          ) : null}
          {sync.state === 'error' && sync.message && <p className="callout req small">{sync.message}</p>}
          <div className="actions-row">
            <button className="btn primary" disabled={sync.state === 'syncing'} onClick={() => loadSync().then(m => m.syncNow())}><RefreshCw size={16} /> Sync now</button>
            <button className="btn ghost" onClick={() => loadSync().then(m => m.signOut())}><LogOut size={16} /> Sign out</button>
          </div>
          <Usage />
          <p className="muted small" style={{ marginTop: 14 }}>Signing out keeps everything on this device; it just stops syncing.</p>
        </>
      ) : (
        <>
          <p>Use the same account on your phone and computer to keep campaigns in step. Free, optional, and everything still works without it.</p>
          <div className="seg" role="group" aria-label="Account">
            <button aria-pressed={mode === 'in'} onClick={() => setMode('in')}>Sign in</button>
            <button aria-pressed={mode === 'up'} onClick={() => setMode('up')}>Create account</button>
          </div>
          <form className="sync-form" onSubmit={e => { e.preventDefault(); submit() }}>
            <label className="lab" htmlFor="sy-e">Email</label>
            <input id="sy-e" className="field" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
            <label className="lab" htmlFor="sy-p">Password</label>
            <input id="sy-p" className="field" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} />
            {mode === 'up' && <p className="muted small">At least 8 characters.</p>}
            {msg && <p className={`small ${msg.ok ? 'capture-ok' : 'error'}`} role="status">{msg.text}</p>}
            <button className="btn primary full" type="submit" disabled={busy}>{busy ? 'Working…' : mode === 'up' ? 'Create account' : 'Sign in and sync'}</button>
          </form>
          <p className="muted small" style={{ marginTop: 14 }}>Your data is stored in a private database only your account can read. Not affiliated with Wizards of the Coast.</p>
        </>
      )}
    </Drawer>
  )
}

function StateText({ s }: { s: SyncStatus }) {
  if (s.state === 'syncing') return <><RefreshCw size={14} className="spin" /> Syncing…</>
  if (s.state === 'offline') return <><CloudOff size={14} /> Offline. Changes will sync when you are back online.</>
  if (s.state === 'error') return <><CloudOff size={14} /> Sync failed. It will retry automatically.</>
  if (s.state === 'synced') return <><Cloud size={14} /> Synced {s.at ? new Date(s.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</>
  return <><CloudOff size={14} /> Not syncing</>
}

const mb = (b: number) => b < 1_000_000 ? `${Math.max(1, Math.round(b / 1000))} KB` : `${(b / 1_000_000).toFixed(1)} MB`

/** How much of the free plan this account uses. Big maps are compressed before upload; unused files are cleaned up daily. */
function Usage() {
  const sync = useUI(s => s.sync)
  const [u, setU] = useState<Awaited<ReturnType<typeof import('../lib/sync').usage>>>(null)
  useEffect(() => { if (sync.state === 'synced') loadSync().then(m => m.usage()).then(setU).catch(() => setU(null)) }, [sync.state, sync.at])
  if (!u) return null
  const pct = Math.min(100, (u.bytes / 1_000_000_000) * 100)
  return (
    <div className="usage">
      <div className="usage-row"><span>Maps and images</span><b className="tnum">{mb(u.bytes)} of 1 GB</b></div>
      <div className="bar" aria-hidden="true"><i style={{ width: `${Math.max(pct, u.bytes ? 1 : 0)}%` }} /></div>
      <div className="usage-row muted small"><span>{u.campaigns} campaign{u.campaigns === 1 ? '' : 's'}, {u.files} file{u.files === 1 ? '' : 's'}</span><span className="tnum">notes and sheets {mb(u.snapshotBytes)}</span></div>
    </div>
  )
}
