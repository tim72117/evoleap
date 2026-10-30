import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** react-router doesn't scroll to #hash targets on client-side navigation; do it here. */
export function useHashScroll() {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(decodeURIComponent(hash.slice(1)))
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])
}
