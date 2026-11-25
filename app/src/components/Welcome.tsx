import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown, Download, NotebookPen, Search, Share, Swords, UserRound } from 'lucide-react'
import { useUI } from '../state'
import { DieMark } from './DieMark'

const KEY = 'throne.welcomed'
const seen = () => { try { return localStorage.getItem(KEY) === '1' } catch { return true } }
const markSeen = () => { try { localStorage.setItem(KEY, '1') } catch { /* private mode */ } }

/** iPhone/iPad Safari that is not yet running as an installed app. */
const iosBrowser = () => /iP(hone|ad|od)/.test(navigator.userAgent) &&
  !(window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone)

/** First-run guide: pick a role, three tips. Shown once; reopen from the quick switcher. */
export function Welcome() {
  const { welcomeOpen, setWelcome, setMode } = useUI()
  const [ios] = useState(iosBrowser)
  const navigate = useNavigate()
  useEffect(() => { if (!seen()) setWelcome(true) }, [setWelcome])
  useEffect(() => {
    if (!welcomeOpen) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  if (!welcomeOpen) return null
  function close() { markSeen(); setWelcome(false) }
  function go(mode: 'player' | 'dm', path: string) { setMode(mode); close(); navigate(path) }

  return (
    <div className="modal-scrim welcome-scrim">
      <div className="modal welcome" role="dialog" aria-modal="true" aria-labelledby="w-h">
        <div className="welcome-brand"><DieMark size={44} /><div><h2 id="w-h">Welcome to Throne</h2><p>Unofficial D&amp;D Campaign Manager</p></div></div>
        <p className="welcome-lead">Who are you at the table today? You can switch any time with Player / DM at the top.</p>
        <div className="welcome-roles">
          <button className="role-card" onClick={() => go('player', '/characters')}>
            <UserRound size={26} /><b>I'm playing</b><span>Build a character, import one from a D&amp;D Beyond PDF, roll and keep notes.</span>
          </button>
          <button className="role-card" onClick={() => go('dm', '/dm')}>
            <Crown size={26} /><b>I'm running the game</b><span>Campaign notes, maps with pins, random tables and a combat tracker.</span>
          </button>
        </div>
        <ul className="welcome-tips">
          <li><Download size={16} /><span>Everything is saved on this device. Export a campaign from the DM Campaign page to back it up.</span></li>
          <li><NotebookPen size={16} /><span>Tap the note icon at the top to jot something into today's session log.</span></li>
          {ios
            ? <li><Share size={16} /><span>Add Throne to your Home Screen: tap Share, then “Add to Home Screen”. It then opens full screen and works offline.</span></li>
            : <li><Search size={16} /><span>On a keyboard, press <kbd>Ctrl K</kbd> (or <kbd>⌘K</kbd>) to jump anywhere or roll a table.</span></li>}
          <li><Swords size={16} /><span>The sample campaign and its sample character are examples. Edit or delete them whenever you like.</span></li>
        </ul>
        <div className="foot"><span className="muted small">Not affiliated with Wizards of the Coast.</span><button className="btn" onClick={close}>Just look around</button></div>
      </div>
    </div>
  )
}
