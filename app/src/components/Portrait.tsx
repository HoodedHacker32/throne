import type { Character } from '../db'
import { colorFor, initials } from '../lib/character'

export function Portrait({ c }: { c: Pick<Character, 'name' | 'portrait'> }) {
  return (
    <div className="portrait" style={{ ['--c' as string]: colorFor(c.name) }} aria-hidden="true">
      {c.portrait ? <img src={c.portrait} alt="" /> : initials(c.name)}
    </div>
  )
}
