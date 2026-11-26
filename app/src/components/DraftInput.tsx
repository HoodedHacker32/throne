import { useEffect, useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

/** A text box that owns its text while focused and saves in the background. While you type, the stored value
 *  never overwrites what is on screen; when you are not typing it follows the stored value (e.g. after a sync). */
function useDraft(value: string, onValue: (v: string) => void) {
  const [v, setV] = useState(value)
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setV(value) }, [value])
  return {
    value: v,
    onFocus: () => { focused.current = true },
    onBlur: () => { focused.current = false },
    onChange: (e: { target: { value: string } }) => { setV(e.target.value); onValue(e.target.value) },
  }
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onValue: (v: string) => void }
export function DraftInput({ value, onValue, ...rest }: InputProps) {
  const d = useDraft(value, onValue)
  return <input {...rest} {...d} onFocus={e => { d.onFocus(); rest.onFocus?.(e) }} onBlur={e => { d.onBlur(); rest.onBlur?.(e) }} />
}

type AreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & { value: string; onValue: (v: string) => void }
export function DraftTextarea({ value, onValue, ...rest }: AreaProps) {
  const d = useDraft(value, onValue)
  return <textarea {...rest} {...d} onFocus={e => { d.onFocus(); rest.onFocus?.(e) }} onBlur={e => { d.onBlur(); rest.onBlur?.(e) }} />
}
