import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Character, type Note } from '../db'
import { useUI } from '../state'

export const useCampaignId = () => useUI(s => s.campaignId)

export function useCharacters(): Character[] {
  const cid = useCampaignId()
  return useLiveQuery(() => db.characters.toArray().then(cs => cs
    .filter(c => !cid || c.campaignId === undefined || c.campaignId === cid)
    .sort((a, b) => a.name.localeCompare(b.name))), [cid], [])
}

export function useNotes(): Note[] {
  const cid = useCampaignId()
  return useLiveQuery(() => cid ? db.notes.where('campaignId').equals(cid).reverse().sortBy('updatedAt') : [], [cid], [])
}

export const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return new Date(t).toLocaleDateString()
}

import { useCallback, useEffect, useMemo, useState } from 'react'
/** True while the media query matches. */
export function useMedia(query: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setM(mq.matches)
    on(); mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return m
}

/** Show edits instantly while they are written to IndexedDB in the background.
 *  Inputs bound straight to a live query lag one round trip behind the keyboard: fast typing (or iOS autocorrect)
 *  then gets overwritten by the older stored value. This keeps a local overlay of pending changes on top of the
 *  record and drops each key once the stored record has caught up. */
export function useOptimistic<T extends object>(record: T, write: (patch: Partial<T>) => unknown): [T, (patch: Partial<T>) => void] {
  const [pending, setPending] = useState<Partial<T>>({})
  useEffect(() => {
    setPending(p => {
      let changed = false
      const next = { ...p }
      for (const k of Object.keys(p) as (keyof T)[]) {
        if (JSON.stringify(record[k]) === JSON.stringify(p[k])) { delete next[k]; changed = true }
      }
      return changed ? next : p
    })
  }, [record])
  const view = useMemo(() => ({ ...record, ...pending }), [record, pending])
  const save = useCallback((patch: Partial<T>) => { setPending(p => ({ ...p, ...patch })); write(patch) }, [write])
  return [view, save]
}
