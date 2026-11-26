import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, WifiOff, Wifi, X } from 'lucide-react'

/** "Update ready" toast. The new version installs in the background; Refresh switches to it and reloads. */
export function UpdateToast() {
  const { needRefresh: [need, setNeed], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return
      // Look for a new version every 20 minutes and whenever the app comes back to the front.
      const check = () => { if (navigator.onLine) reg.update().catch(() => {}) }
      window.setInterval(check, 20 * 60 * 1000)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    },
  })
  const [busy, setBusy] = useState(false)
  if (!need) return null
  const refresh = () => {
    setBusy(true)
    updateServiceWorker(true)
    // Fallback: if the new worker does not take over within a few seconds, reload anyway.
    window.setTimeout(() => window.location.reload(), 4000)
  }
  return (
    <div className="update-toast" role="status" aria-live="polite">
      <RefreshCw size={18} aria-hidden="true" />
      <div className="ut-text"><b>Update ready</b><small>A new version of Throne is installed. Your data is safe.</small></div>
      <button className="btn primary sm" onClick={refresh} disabled={busy}>{busy ? 'Updating…' : 'Refresh'}</button>
      <button className="icon-btn" aria-label="Later" onClick={() => setNeed(false)}><X size={16} /></button>
    </div>
  )
}

/** A bar under the top bar while the device is offline, and a short "back online" note when it returns. */
export function OfflineBar() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [back, setBack] = useState(false)
  useEffect(() => {
    let t: number | undefined
    const on = () => { setOnline(true); setBack(true); window.clearTimeout(t); t = window.setTimeout(() => setBack(false), 3000) }
    const off = () => { setOnline(false); setBack(false) }
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.clearTimeout(t) }
  }, [])
  if (online && !back) return null
  return (
    <div className={`net-bar ${online ? 'ok' : ''}`} role="status" aria-live="polite">
      {online ? <><Wifi size={14} aria-hidden="true" /> Back online</>
        : <><WifiOff size={14} aria-hidden="true" /> <b>Offline</b><span>· saving on this device<span className="hide-s">. Sync resumes when you are back online.</span></span></>}
    </div>
  )
}
