import { useEffect, useRef } from 'react'

export function usePolling(fn: () => void, intervalMs: number, active = true) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!active) return
    fnRef.current()
    const id = setInterval(() => fnRef.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, active])
}
