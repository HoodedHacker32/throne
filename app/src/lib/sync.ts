/** Cloud sync with Supabase. Local-first: IndexedDB stays the source of truth on each device and sync copies whole
 *  campaign snapshots up and down.
 *
 *  Per campaign, compared with the last state both sides agreed on (syncedVersion / syncedHash):
 *  - unchanged here, newer in the cloud  -> pull and replace the local copy
 *  - changed here, cloud unchanged       -> push (version + 1, only if nobody pushed meanwhile)
 *  - changed on both                      -> keep both: the cloud version becomes a separate local copy
 *                                            "(from another device)", then ours is pushed. Nothing is lost.
 *  Library files go to a private bucket once, named by their sha-256. Saved monsters and random tables merge by name.
 *  This module is loaded on demand (it pulls in supabase-js), so people who never sign in never download it. */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { db, type Campaign, type Character, type Combatant, type LibraryItem, type Monster, type Note, type RandomTable } from '../db'
import { FILES_BUCKET, SUPABASE_KEY, SUPABASE_URL } from './supabaseConfig'

export type SyncState = 'off' | 'syncing' | 'synced' | 'error' | 'offline'
export interface SyncStatus { state: SyncState; message?: string; at?: number; user?: string; conflicts?: string[] }

let client: SupabaseClient | null = null
export function supabase(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'throne.auth' } })
  return client
}

/* ---------------- status (a tiny event emitter so the UI can follow along) ---------------- */
let status: SyncStatus = { state: 'off' }
const listeners = new Set<(s: SyncStatus) => void>()
export const getStatus = () => status
export function onStatus(fn: (s: SyncStatus) => void) { listeners.add(fn); fn(status); return () => { listeners.delete(fn) } }
function setStatus(patch: Partial<SyncStatus>) { status = { ...status, ...patch }; listeners.forEach(f => f(status)) }

/* ---------------- account ---------------- */
export async function currentUser(): Promise<User | null> {
  const { data } = await supabase().auth.getSession()
  return data.session?.user ?? null
}
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase().auth.signUp({ email, password, options: { emailRedirectTo: location.origin + import.meta.env.BASE_URL } })
  if (error) throw error
  return { needsConfirmation: !data.session }
}
export async function signIn(email: string, password: string) {
  const { error } = await supabase().auth.signInWithPassword({ email, password })
  if (error) throw error
  try { localStorage.setItem('throne.syncOn', '1') } catch { /* ignore */ }
  startAutoSync()
  return syncNow()
}
export async function signOut() {
  stopAutoSync()
  await supabase().auth.signOut()
  try { localStorage.removeItem('throne.syncOn') } catch { /* ignore */ }
  // Forget the link to cloud rows so a different account on this device starts clean. Local data stays.
  await db.campaigns.toCollection().modify(c => { delete c.syncId; delete c.syncedVersion; delete c.syncedHash })
  setStatus({ state: 'off', user: undefined, message: undefined, conflicts: undefined })
}

/* ---------------- snapshots ---------------- */
interface Snapshot {
  v: 1
  campaign: { name: string; createdAt: number }
  notes: Omit<Note, 'campaignId'>[]
  characters: Omit<Character, 'campaignId'>[]
  combatants: Omit<Combatant, 'campaignId'>[]
  library: (Omit<LibraryItem, 'campaignId' | 'blob'> & { hash: string })[]
}

async function sha256(data: ArrayBuffer | string): Promise<string> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const h = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('')
}
const byId = <T extends { id: number }>(a: T, b: T) => a.id - b.id
const strip = <T extends { campaignId?: number }>(x: T) => { const { campaignId: _c, ...rest } = x; void _c; return rest }

async function fileHash(item: LibraryItem): Promise<string> {
  if (item.hash) return item.hash
  const hash = await sha256(await item.blob.arrayBuffer())
  await db.library.update(item.id, { hash })
  return hash
}

async function buildSnapshot(cid: number): Promise<{ snap: Snapshot; hash: string; blobs: Map<string, Blob> }> {
  const c = (await db.campaigns.get(cid))!
  const notes = (await db.notes.where('campaignId').equals(cid).toArray()).sort(byId)
  const characters = (await db.characters.toArray()).filter(x => x.campaignId === cid).sort(byId)
  const combatants = (await db.combatants.where('campaignId').equals(cid).toArray()).sort(byId)
  const items = (await db.library.where('campaignId').equals(cid).toArray()).sort(byId)
  const blobs = new Map<string, Blob>()
  const library = []
  for (const it of items) {
    const hash = await fileHash(it)
    blobs.set(hash, it.blob)
    const { blob: _b, campaignId: _c, ...meta } = it; void _b; void _c
    library.push({ ...meta, hash })
  }
  const snap: Snapshot = {
    v: 1, campaign: { name: c.name, createdAt: c.createdAt },
    notes: notes.map(strip), characters: characters.map(strip), combatants: combatants.map(strip), library,
  }
  return { snap, hash: await sha256(JSON.stringify(snap)), blobs }
}

/** Replace a local campaign's contents with a snapshot, remapping ids (ids are per device). */
async function applySnapshot(cid: number, snap: Snapshot, userId: string) {
  // Fetch any files we do not already have, before touching the database.
  const local = await db.library.toArray()
  const have = new Map(local.filter(l => l.hash).map(l => [l.hash!, l.blob]))
  const files = new Map<string, Blob>()
  for (const l of snap.library) {
    const blob = have.get(l.hash) ?? await download(userId, l.hash)
    if (blob) files.set(l.hash, blob)
  }
  await db.transaction('rw', [db.campaigns, db.notes, db.characters, db.combatants, db.library], async () => {
    await db.notes.where('campaignId').equals(cid).delete()
    await db.combatants.where('campaignId').equals(cid).delete()
    await db.library.where('campaignId').equals(cid).delete()
    await db.characters.filter(x => x.campaignId === cid).delete()
    await db.campaigns.update(cid, { name: snap.campaign.name })

    const chars = new Map<number, number>(), notes = new Map<number, number>()
    for (const ch of snap.characters) { const { id, ...rest } = ch; chars.set(id, await db.characters.add({ ...rest, campaignId: cid })) }
    for (const n of snap.notes) {
      const { id, ...rest } = n
      notes.set(id, await db.notes.add({ ...rest, campaignId: cid, characterId: rest.characterId !== undefined ? chars.get(rest.characterId) : undefined }))
    }
    for (const k of snap.combatants) {
      const { id: _id, ...rest } = k; void _id
      await db.combatants.add({ ...rest, campaignId: cid, characterId: rest.characterId !== undefined ? chars.get(rest.characterId) : undefined })
    }
    for (const l of snap.library) {
      const blob = files.get(l.hash)
      if (!blob) continue
      const { id: _id, ...rest } = l; void _id
      await db.library.add({ ...rest, campaignId: cid, blob, mime: blob.type || rest.mime, pins: rest.pins?.map(p => ({ ...p, noteId: p.noteId !== undefined ? notes.get(p.noteId) : undefined })) })
    }
  })
}

/* ---------------- files ---------------- */
const uploadedKey = (uid: string) => `throne.uploaded.${uid}`
function uploadedSet(uid: string): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(uploadedKey(uid)) ?? '[]')) } catch { return new Set() } }
function rememberUploaded(uid: string, s: Set<string>) { try { localStorage.setItem(uploadedKey(uid), JSON.stringify([...s])) } catch { /* ignore */ } }

/** Free-plan friendly: images over ~1 MB are re-encoded for the cloud copy (max 4096 px, WebP or JPEG).
 *  The original stays on the device it came from; other devices get the smaller copy. */
async function forCloud(blob: Blob): Promise<Blob> {
  if (!blob.type.startsWith('image/') || blob.type === 'image/gif' || blob.type === 'image/svg+xml' || blob.size < 1_000_000) return blob
  try {
    const bmp = await createImageBitmap(blob)
    const scale = Math.min(1, 4096 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const encode = (type: string, q: number) => new Promise<Blob | null>(res => canvas.toBlob(res, type, q))
    // WebP where the browser can encode it (Safari falls back to PNG, so check the result type), else JPEG.
    let out = await encode('image/webp', 0.82)
    if (!out || out.type !== 'image/webp') out = await encode('image/jpeg', 0.85)
    return out && out.size < blob.size ? out : blob
  } catch { return blob }
}

async function upload(uid: string, blobs: Map<string, Blob>) {
  const done = uploadedSet(uid)
  for (const [hash, blob] of blobs) {
    if (done.has(hash)) continue
    const small = await forCloud(blob)
    const { error } = await supabase().storage.from(FILES_BUCKET).upload(`${uid}/${hash}`, small, { upsert: false, contentType: small.type || 'application/octet-stream' })
    if (error && !/exists|duplicate/i.test(error.message)) throw error
    done.add(hash)
  }
  rememberUploaded(uid, done)
}

/** All of this user's files with sizes (the bucket is flat: <uid>/<hash>). */
async function listFiles(uid: string) {
  const out: { name: string; size: number; created: number }[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase().storage.from(FILES_BUCKET).list(uid, { limit: 1000, offset })
    if (error) throw error
    for (const f of data ?? []) out.push({ name: f.name, size: Number(f.metadata?.size ?? 0), created: Date.parse(f.created_at ?? '') || 0 })
    if (!data || data.length < 1000) break
  }
  return out
}

/** Once a day: delete cloud files no synced campaign uses any more. Files younger than a day are left alone,
 *  so another device that has uploaded but not yet saved its snapshot is never caught out. */
async function collectGarbage(uid: string) {
  const key = `throne.gc.${uid}`
  try { if (Date.now() - Number(localStorage.getItem(key) ?? 0) < 86_400_000) return } catch { /* ignore */ }
  const used = new Set((await db.library.toArray()).map(l => l.hash).filter(Boolean) as string[])
  const dayAgo = Date.now() - 86_400_000
  const stale = (await listFiles(uid)).filter(f => !used.has(f.name) && f.created && f.created < dayAgo)
  if (stale.length) {
    const { error } = await supabase().storage.from(FILES_BUCKET).remove(stale.map(f => `${uid}/${f.name}`))
    if (error) throw error
    const done = uploadedSet(uid); stale.forEach(f => done.delete(f.name)); rememberUploaded(uid, done)
  }
  try { localStorage.setItem(key, String(Date.now())) } catch { /* ignore */ }
}

/** Cloud usage for the sync panel. Free plan: 1 GB of files, 500 MB of database. */
export async function usage(): Promise<{ files: number; bytes: number; campaigns: number; snapshotBytes: number } | null> {
  const user = await currentUser()
  if (!user) return null
  const files = await listFiles(user.id)
  const { data } = await supabase().from('sync_campaigns').select('snapshot')
  const snapshotBytes = (data ?? []).reduce((t, r) => t + JSON.stringify(r.snapshot).length, 0)
  return { files: files.length, bytes: files.reduce((t, f) => t + f.size, 0), campaigns: data?.length ?? 0, snapshotBytes }
}

async function download(uid: string, hash: string): Promise<Blob | null> {
  const { data, error } = await supabase().storage.from(FILES_BUCKET).download(`${uid}/${hash}`)
  return error ? null : data
}

/* ---------------- campaigns ---------------- */
interface Row { id: string; name: string; version: number; updated_at: string; snapshot?: Snapshot }
const device = () => /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone/iPad' : /Android/.test(navigator.userAgent) ? 'Android' : /Mac/.test(navigator.userAgent) ? 'Mac' : /Windows/.test(navigator.userAgent) ? 'Windows' : 'Browser'

async function fetchSnapshot(id: string): Promise<Row> {
  const { data, error } = await supabase().from('sync_campaigns').select('id,name,version,updated_at,snapshot').eq('id', id).single()
  if (error) throw error
  return data as Row
}

async function push(c: Campaign, uid: string, expected: number | undefined): Promise<'ok' | 'conflict'> {
  const { snap, hash, blobs } = await buildSnapshot(c.id)
  await upload(uid, blobs)
  const syncId = c.syncId ?? crypto.randomUUID()
  if (expected === undefined) {
    const { error } = await supabase().from('sync_campaigns').insert({ id: syncId, name: snap.campaign.name, version: 1, snapshot: snap, device: device() })
    if (error) throw error
    await db.campaigns.update(c.id, { syncId, syncedVersion: 1, syncedHash: hash })
    return 'ok'
  }
  // Only succeeds if nobody pushed since we last agreed (compare-and-set on version).
  const { data, error } = await supabase().from('sync_campaigns')
    .update({ name: snap.campaign.name, version: expected + 1, snapshot: snap, device: device(), updated_at: new Date().toISOString() })
    .eq('id', syncId).eq('version', expected).select('id')
  if (error) throw error
  if (!data?.length) return 'conflict'
  await db.campaigns.update(c.id, { syncId, syncedVersion: expected + 1, syncedHash: hash })
  return 'ok'
}

async function pullInto(cid: number, row: Row, uid: string) {
  const full = row.snapshot ? row : await fetchSnapshot(row.id)
  await applySnapshot(cid, full.snapshot!, uid)
  const { hash } = await buildSnapshot(cid)
  await db.campaigns.update(cid, { syncId: row.id, syncedVersion: full.version, syncedHash: hash })
}

/** Keep a cloud version that clashes with local edits as its own, unsynced local campaign. */
async function keepCopy(row: Row, uid: string): Promise<string> {
  const full = await fetchSnapshot(row.id)
  const name = `${full.snapshot!.campaign.name} (from another device)`
  const cid = await db.campaigns.add({ name, createdAt: Date.now() })
  await applySnapshot(cid, { ...full.snapshot!, campaign: { ...full.snapshot!.campaign, name } }, uid)
  return name
}

/* ---------------- monsters and random tables ---------------- */
interface GlobalData { monsters: Omit<Monster, 'id'>[]; tables: Omit<RandomTable, 'id'>[] }
async function syncGlobal() {
  const { data: row, error } = await supabase().from('sync_global').select('data').maybeSingle()
  if (error) throw error
  const remote = (row?.data as GlobalData | undefined) ?? { monsters: [], tables: [] }
  const key = (s: string) => s.trim().toLowerCase()
  // Monsters: union by name, local wins on a clash (they are templates, not campaign state).
  const localM = await db.monsters.toArray()
  const haveM = new Set(localM.map(m => key(m.name)))
  const addM = remote.monsters.filter(m => !haveM.has(key(m.name)))
  if (addM.length) await db.monsters.bulkAdd(addM)
  // Tables: union by name, newest edit wins.
  const localT = await db.randomTables.toArray()
  for (const t of remote.tables) {
    const mine = localT.find(x => key(x.name) === key(t.name))
    if (!mine) await db.randomTables.add(t)
    else if (t.updatedAt > mine.updatedAt) await db.randomTables.update(mine.id, { rows: t.rows, updatedAt: t.updatedAt })
  }
  const merged: GlobalData = {
    monsters: (await db.monsters.toArray()).map(({ id: _id, ...m }) => { void _id; return m }),
    tables: (await db.randomTables.toArray()).map(({ id: _id, ...t }) => { void _id; return t }),
  }
  if (JSON.stringify(merged) !== JSON.stringify(remote)) {
    const { error: e2 } = await supabase().from('sync_global').upsert({ data: merged, updated_at: new Date().toISOString() })
    if (e2) throw e2
  }
}

async function isPristineSample(cid: number) {
  const notes = await db.notes.where('campaignId').equals(cid).toArray()
  const chars = (await db.characters.toArray()).filter(c => c.campaignId === cid)
  const files = await db.library.where('campaignId').equals(cid).count()
  return files === 0 && notes.length > 0 && notes.every(n => n.tags.includes('sample') && n.updatedAt === n.createdAt) &&
    chars.every(c => c.name.startsWith('Sample:') && c.updatedAt === c.createdAt)
}
async function removeLocalCampaign(cid: number) {
  await db.transaction('rw', [db.campaigns, db.notes, db.characters, db.combatants, db.library], async () => {
    await db.notes.where('campaignId').equals(cid).delete()
    await db.combatants.where('campaignId').equals(cid).delete()
    await db.library.where('campaignId').equals(cid).delete()
    await db.characters.filter(x => x.campaignId === cid).delete()
    await db.campaigns.delete(cid)
  })
}

/* ---------------- the sync pass ---------------- */
let running: Promise<void> | null = null
export function syncNow(): Promise<void> {
  if (!running) running = pass().finally(() => { running = null })
  return running
}

async function pass() {
  const user = await currentUser()
  if (!user) { setStatus({ state: 'off', user: undefined }); return }
  if (!navigator.onLine) { setStatus({ state: 'offline', user: user.email ?? undefined }); return }
  setStatus({ state: 'syncing', user: user.email ?? undefined, message: undefined })
  const conflicts: string[] = []
  try {
    const { data, error } = await supabase().from('sync_campaigns').select('id,name,version,updated_at')
    if (error) throw error
    const rows = new Map((data as Row[]).map(r => [r.id, r]))
    const locals = await db.campaigns.toArray()

    for (const c of locals) {
      // A brand-new device starts with the sample campaign: do not upload yet another copy of it.
      if (!c.syncId && rows.size > 0 && await isPristineSample(c.id)) { await removeLocalCampaign(c.id); continue }
      const r = c.syncId ? rows.get(c.syncId) : undefined
      if (c.syncId) rows.delete(c.syncId)
      if (!r) { await push(c, user.id, undefined); continue } // new here (or removed from the cloud): upload
      const changedHere = (await buildSnapshot(c.id)).hash !== c.syncedHash
      const changedThere = r.version !== c.syncedVersion
      if (changedThere && !changedHere) await pullInto(c.id, r, user.id)
      else if (changedHere && !changedThere) {
        if (await push(c, user.id, r.version) === 'conflict') {
          // Someone pushed between our read and our write: keep theirs as a copy, then push ours on top.
          const fresh = await fetchSnapshot(r.id)
          conflicts.push(await keepCopy(fresh, user.id))
          await push(c, user.id, fresh.version)
        }
      } else if (changedHere && changedThere) {
        conflicts.push(await keepCopy(r, user.id))
        await push(c, user.id, r.version)
      }
    }
    // Campaigns that exist in the cloud but not on this device yet.
    for (const r of rows.values()) {
      const cid = await db.campaigns.add({ name: r.name, createdAt: Date.now(), syncId: r.id })
      await pullInto(cid, r, user.id)
    }
    await syncGlobal()
    await collectGarbage(user.id).catch(() => undefined)
    setStatus({ state: 'synced', at: Date.now(), conflicts: conflicts.length ? conflicts : undefined })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    setStatus({ state: navigator.onLine ? 'error' : 'offline', message: msg })
  }
}

/* ---------------- automatic sync ---------------- */
let timer: number | undefined
const onHide = () => { if (document.visibilityState === 'hidden') syncNow() }
const onOnline = () => syncNow()
export function startAutoSync() {
  if (timer) return
  timer = window.setInterval(() => { if (document.visibilityState === 'visible') syncNow() }, 45_000)
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('online', onOnline)
}
export function stopAutoSync() {
  window.clearInterval(timer); timer = undefined
  document.removeEventListener('visibilitychange', onHide)
  window.removeEventListener('online', onOnline)
}

/** Called once at app start when sync was switched on before. */
export async function resume() {
  const user = await currentUser()
  if (!user) { setStatus({ state: 'off' }); return }
  setStatus({ user: user.email ?? undefined })
  startAutoSync()
  await syncNow()
}
