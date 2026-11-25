import { useState } from 'react'
import { dice3dEnabled, diceSoundOn, setDice3d, setDiceSound } from '../lib/dice3d'

/** 3D dice on/off and sound on/off. Stored per device. */
export function DiceSettings({ compact }: { compact?: boolean }) {
  const [on, setOn] = useState(dice3dEnabled)
  const [sound, setSound] = useState(diceSoundOn)
  return (
    <div className={`dice-settings ${compact ? 'compact' : ''}`} role="group" aria-label="Dice settings">
      <label className="check"><input type="checkbox" checked={on} onChange={e => { setDice3d(e.target.checked); setOn(e.target.checked) }} /> 3D dice</label>
      <label className="check"><input type="checkbox" checked={sound} disabled={!on} onChange={e => { setDiceSound(e.target.checked); setSound(e.target.checked) }} /> Sound</label>
    </div>
  )
}
