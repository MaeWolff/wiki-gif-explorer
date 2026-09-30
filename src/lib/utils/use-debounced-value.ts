import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseDebouncedValueOptions {
  leading?: boolean
}

export interface UseDebouncedValueHandlers {
  cancel: () => void
  flush: () => void
}

export type UseDebouncedValueReturnValue<T> = [
  T,
  () => void,
  UseDebouncedValueHandlers,
]

export function useDebouncedValue<T>(
  value: T,
  wait: number,
  options: UseDebouncedValueOptions = { leading: false },
): UseDebouncedValueReturnValue<T> {
  const [debounced, setDebounced] = useState(value)
  const mountedRef = useRef(false)
  const timeoutRef = useRef<number | null>(null)
  const cooldownRef = useRef(false)
  const latestValueRef = useRef(value)

  useEffect(() => {
    latestValueRef.current = value
  }, [value])

  const cancel = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    cooldownRef.current = false
  }, [])

  const flush = useCallback(() => {
    if (timeoutRef.current === null) return
    cancel()
    setDebounced(latestValueRef.current)
  }, [cancel])

  useEffect(() => {
    if (!mountedRef.current) return

    if (!cooldownRef.current && options.leading) {
      cooldownRef.current = true
      setDebounced(value)
      timeoutRef.current = window.setTimeout(() => {
        cooldownRef.current = false
        timeoutRef.current = null
      }, wait)
      return
    }

    cancel()
    timeoutRef.current = window.setTimeout(() => {
      cooldownRef.current = false
      timeoutRef.current = null
      setDebounced(value)
    }, wait)
  }, [value, options.leading, wait, cancel])

  useEffect(() => {
    mountedRef.current = true
    return cancel
  }, [cancel])

  return [debounced, cancel, { cancel, flush }]
}
