import { useCallback, useEffect, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

/**
 * Text boxes that never fight the keyboard.
 *
 * The box is uncontrolled: the browser owns the text, so typing causes no React render at all (no dropped
 * letters, no cursor jumps, no fights with iOS autocorrect or predictive text). Changes are saved after a short
 * pause and always on blur, when the page is hidden, and on unmount. The stored value only replaces what is on
 * screen while the box is not focused and has nothing unsaved (e.g. after a sync or an undo elsewhere).
 */
function useUncontrolled<E extends HTMLInputElement | HTMLTextAreaElement>(
  value: string, onValue: (v: string) => void, delay: number, format?: (raw: string) => string,
) {
  const ref = useRef<E>(null)
  const [initial] = useState(value)
  const cb = useRef(onValue); cb.current = onValue
  const fmt = useRef(format); fmt.current = format
  const pending = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    if (pending.current === null) return
    const v = pending.current
    pending.current = null
    cb.current(v)
  }, [])

  // Follow the stored value when the user is not editing.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || pending.current !== null || document.activeElement === el) return
    if (el.value !== value) el.value = value
  }, [value])

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onHide); flush() }
  }, [flush])

  return {
    ref,
    defaultValue: initial,
    onInput: (e: { currentTarget: E }) => {
      pending.current = e.currentTarget.value
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, delay)
    },
    onBlur: (e: { currentTarget: E }) => {
      const el = e.currentTarget
      if (fmt.current) {
        const clean = fmt.current(el.value)
        if (clean !== el.value) { el.value = clean; pending.current = clean }
      }
      flush()
    },
  }
}

type Extra = { value: string; onValue: (v: string) => void; delay?: number; format?: (raw: string) => string }
type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue'> & Extra
type AreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'defaultValue'> & Extra

export function DraftInput({ value, onValue, delay = 400, format, onBlur, onInput, ...rest }: InputProps) {
  const d = useUncontrolled<HTMLInputElement>(value, onValue, delay, format)
  return <input {...rest} ref={d.ref} defaultValue={d.defaultValue}
    onInput={e => { d.onInput(e); onInput?.(e) }} onBlur={e => { d.onBlur(e); onBlur?.(e) }} />
}

export function DraftTextarea({ value, onValue, delay = 500, format, onBlur, onInput, ...rest }: AreaProps) {
  const d = useUncontrolled<HTMLTextAreaElement>(value, onValue, delay, format)
  return <textarea {...rest} ref={d.ref} defaultValue={d.defaultValue}
    onInput={e => { d.onInput(e); onInput?.(e) }} onBlur={e => { d.onBlur(e); onBlur?.(e) }} />
}

type NumProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue' | 'min' | 'max'> & {
  value: number; onNumber: (n: number) => void; min?: number; max?: number; decimal?: boolean
}
/** A number box you can clear and retype freely. It saves the parsed number as you type and tidies the text
 *  on blur (empty becomes the minimum or 0, values are clamped). */
export function NumberInput({ value, onNumber, min, max, decimal, ...rest }: NumProps) {
  const parse = (raw: string) => {
    let n = decimal ? parseFloat(raw.replace(',', '.')) : parseInt(raw.replace(/[^\d-]/g, ''), 10)
    if (!Number.isFinite(n)) n = min ?? 0
    if (min !== undefined) n = Math.max(min, n)
    if (max !== undefined) n = Math.min(max, n)
    return n
  }
  return <DraftInput inputMode={decimal ? 'decimal' : 'numeric'} {...rest} value={String(value)} delay={300}
    onValue={raw => { if (raw.trim() === '' || raw === '-') return; const n = parse(raw); if (n !== value) onNumber(n) }}
    format={raw => String(parse(raw))}
    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); rest.onKeyDown?.(e) }} />
}
