import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronsLeft, ChevronsRight, Crown, Dices, House, Map as MapIcon, Moon, NotebookPen, Search, Sun, Swords, Users } from 'lucide-react'
import { db, seedIfEmpty } from './db'
import { useUI, type Mode } from './state'
import { DieMark } from './components/DieMark'
import { RollToast } from './components/RollToast'
import { Palette } from './components/Palette'
import { DiceDock } from './components/DiceDock'
import { QuickCapture } from './components/QuickCapture'
import { Welcome } from './components/Welcome'
import { SyncButton, SyncPanel, useSyncBridge } from './components/SyncPanel'
import { Portrait } from './components/Portrait'
import { useCharacters } from './lib/hooks'

// Each screen loads the first time it is opened, so the first download stays small.
const NotesPage = lazy(() => import('./pages/NotesPage').then(m => ({ default: m.NotesPage })))
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })))
const CharactersPage = lazy(() => import('./pages/CharactersPage').then(m => ({ default: m.CharactersPage })))
const SheetPage = lazy(() => import('./pages/SheetPage').then(m => ({ default: m.SheetPage })))
const BuilderPage = lazy(() => import('./pages/BuilderPage').then(m => ({ default: m.BuilderPage })))
const ImportPage = lazy(() => import('./pages/ImportPage').then(m => ({ default: m.ImportPage })))
const DicePage = lazy(() => import('./pages/DicePage').then(m => ({ default: m.DicePage })))
const CombatPage = lazy(() => import('./pages/CombatPage').then(m => ({ default: m.CombatPage })))
const LibraryPage = lazy(() => import('./pages/LibraryPage').then(m => ({ default: m.LibraryPage })))
const MapPage = lazy(() => import('./pages/MapPage').then(m => ({ default: m.MapPage })))
const CampaignPage = lazy(() => import('./pages/CampaignPage').then(m => ({ default: m.CampaignPage })))

const NAV: Record<Mode, { to: string; label: string; icon: typeof House; end?: boolean }[]> = {
  player: [
    { to: '/', label: 'Home', icon: House, end: true },
    { to: '/characters', label: 'Characters', icon: Users },
    { to: '/notes', label: 'Notes', icon: NotebookPen },
    { to: '/dice', label: 'Dice', icon: Dices },
  ],
  dm: [
    { to: '/dm', label: 'Campaign', icon: Crown, end: true },
    { to: '/dm/combat', label: 'Combat', icon: Swords },
    { to: '/dm/library', label: 'Library', icon: MapIcon },
    { to: '/notes', label: 'Notes', icon: NotebookPen },
  ],
}

function Wordmark({ to }: { to: string }) {
  return (
    <NavLink to={to} end className="wordmark" aria-label="Throne">
      <span>Thr</span><DieMark size={26} /><span>ne</span>
    </NavLink>
  )
}

function Shell() {
  const { mode, setMode, theme, setTheme, campaignId, setCampaign, railCollapsed, setRailCollapsed, setPalette } = useUI()
  const party = useCharacters()
  useSyncBridge()
  const navigate = useNavigate()
  const campaigns = useLiveQuery(() => db.campaigns.toArray(), [], [])

  useEffect(() => {
    // Ask the database, not the (possibly stale) live list, so a just-imported campaign is not undone.
    if (!campaigns.length) return
    if (campaignId === undefined) { setCampaign(campaigns[0].id); return }
    db.campaigns.get(campaignId).then(c => { if (!c) setCampaign(campaigns[0].id) })
  }, [campaigns, campaignId, setCampaign])

  const { pathname } = useLocation()
  // The page decides the role: DM pages show the DM menu, player pages the player menu. Notes belong to both.
  useEffect(() => {
    const want = pathname.startsWith('/dm') ? 'dm' : pathname.startsWith('/notes') ? null : 'player'
    if (want && want !== useUI.getState().mode) setMode(want)
  }, [pathname, setMode])

  const items = NAV[mode]
  const switchMode = (m: Mode) => { setMode(m); navigate(m === 'dm' ? '/dm' : '/') }
  const links = (cls: string) => items.map(i => (
    <NavLink key={i.label} to={i.to} end={i.end} className={({ isActive }) => `nav-item ${cls} ${isActive ? 'active' : ''}`}>
      <i.icon size={22} aria-hidden="true" /><span>{i.label}</span>
    </NavLink>
  ))

  return (
    <div className="app">
      <header className="topbar">
        <Wordmark to={mode === 'dm' ? '/dm' : '/'} />
        <div className="modeswitch" role="group" aria-label="Role">
          <button aria-pressed={mode === 'player'} onClick={() => switchMode('player')}>Player</button>
          <button aria-pressed={mode === 'dm'} onClick={() => switchMode('dm')}>DM</button>
        </div>
        <button className="search-btn" onClick={() => setPalette(true)} aria-label="Search and jump (Ctrl K)">
          <Search size={16} aria-hidden="true" /><span>Search or jump to…</span><kbd>{/Mac|iP/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <button className="icon-btn capture-btn" onClick={() => useUI.getState().setCapture(true)} aria-label="Quick note (Ctrl Shift N)" title="Quick note">
          <NotebookPen size={18} />
        </button>
        <SyncButton />
        <div className="top-right">
          <select className="select-dark" aria-label="Campaign" value={campaignId ?? ''}
            onChange={e => setCampaign(Number(e.target.value))}>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="icon-btn" aria-label={theme === 'dark' ? 'Switch to parchment theme' : 'Switch to dark theme'}
            onClick={() => setTheme(theme === 'dark' ? 'parchment' : 'dark')}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>
      <div className={`body ${railCollapsed ? 'rail-collapsed' : ''}`}>
        <nav className={`rail ${railCollapsed ? 'collapsed' : ''}`} aria-label="Main">
          {links('')}
          <div className="rail-party">
            <h3>Party</h3>
            {party.map(c => (
              <NavLink key={c.id} to={`/characters/${c.id}`} className="party-link" title={c.name}>
                <Portrait c={c} />
                <span className="pl-text"><span className="ellipsis">{c.name.replace(/^Sample:\s*/, '')}</span>
                  <small className="tnum">{c.hpCurrent}/{c.hpMax} HP · AC {c.ac}</small></span>
              </NavLink>
            ))}
            {party.length === 0 && <small className="pl-empty">No characters yet</small>}
          </div>
          <button className="rail-toggle" onClick={() => setRailCollapsed(!railCollapsed)} aria-label={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {railCollapsed ? <ChevronsRight size={18} /> : <><ChevronsLeft size={18} /><span>Collapse</span></>}
          </button>
        </nav>
        <main className="main">
          <Suspense fallback={<div className="page-loading" aria-busy="true"><span className="spinner" aria-label="Loading" /></div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/characters" element={<CharactersPage />} />
            <Route path="/characters/new/:step?" element={<BuilderPage />} />
            <Route path="/characters/import" element={<ImportPage />} />
            <Route path="/characters/:id" element={<SheetPage />} />
            <Route path="/notes/:noteId?" element={<NotesPage campaignId={campaignId} />} />
            <Route path="/dice" element={<DicePage />} />
            <Route path="/dm" element={<CampaignPage />} />
            <Route path="/dm/combat" element={<CombatPage />} />
            <Route path="/dm/library" element={<LibraryPage />} />
            <Route path="/dm/library/:id" element={<MapPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </main>
        <nav className="tabbar" aria-label="Main">{links('')}</nav>
      </div>
      <RollToast />
      <Palette />
      <DiceDock />
      <QuickCapture />
      <Welcome />
      <SyncPanel />
    </div>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => { seedIfEmpty().then(() => setReady(true)) }, [])
  if (!ready) return null
  return <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}><Shell /></BrowserRouter>
}
