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

import { useEffect, useState } from 'react'
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
