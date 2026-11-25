import { create } from 'zustand'
import type { RollResult } from './lib/dice'
import type { SyncStatus } from './lib/sync'

export type Mode = 'player' | 'dm'
export type Theme = 'parchment' | 'dark'
export type RollMode = RollResult['mode']

interface UI {
  mode: Mode
  theme: Theme
  campaignId?: number
  rollMode: RollMode
  railCollapsed: boolean
  paletteOpen: boolean
  dockOpen: boolean
  captureOpen: boolean
  welcomeOpen: boolean
  sync: SyncStatus
  syncOpen: boolean
  setSync: (s: SyncStatus) => void
  setSyncOpen: (v: boolean) => void
  setWelcome: (v: boolean) => void
  setCapture: (v: boolean) => void
  logOpen: boolean
  setDock: (v: boolean) => void
  setLog: (v: boolean) => void
  setRailCollapsed: (v: boolean) => void
  setPalette: (v: boolean) => void
  lastRoll?: { key: number; result: RollResult }
  setMode: (m: Mode) => void
  setTheme: (t: Theme) => void
  setCampaign: (id: number) => void
  setRollMode: (m: RollMode) => void
  showRoll: (r: RollResult) => void
  clearRoll: () => void
}

const read = <T,>(k: string, fallback: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }

export const useUI = create<UI>((set) => ({
  mode: read<Mode>('throne.mode', 'player'),
  theme: read<Theme>('throne.theme', 'parchment'),
  campaignId: read<number | undefined>('throne.campaign', undefined),
  rollMode: 'normal',
  railCollapsed: read<boolean>('throne.rail', false),
  paletteOpen: false,
  dockOpen: false,
  captureOpen: false,
  welcomeOpen: false,
  sync: { state: 'off' },
  syncOpen: false,
  setSync: (sync) => set({ sync: { ...sync } }),
  setSyncOpen: (syncOpen) => set({ syncOpen, paletteOpen: false }),
  setWelcome: (welcomeOpen) => set({ welcomeOpen, paletteOpen: false }),
  setCapture: (captureOpen) => set({ captureOpen, paletteOpen: false }),
  logOpen: false,
  setDock: (dockOpen) => set({ dockOpen }),
  setLog: (logOpen) => set({ logOpen, dockOpen: false }),
  setRailCollapsed: (railCollapsed) => { write('throne.rail', railCollapsed); set({ railCollapsed }) },
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setMode: (mode) => { write('throne.mode', mode); set({ mode }) },
  setTheme: (theme) => { write('throne.theme', theme); set({ theme }) },
  setCampaign: (campaignId) => { write('throne.campaign', campaignId); set({ campaignId }) },
  setRollMode: (rollMode) => set({ rollMode }),
  showRoll: (result) => set({ lastRoll: { key: Date.now() + Math.random(), result } }),
  clearRoll: () => set({ lastRoll: undefined }),
}))
