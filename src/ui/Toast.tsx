import { useEffect } from 'react'
import { useApp } from '../store/app'

export function Toast() {
  const t = useApp((s) => s.toast)
  const clear = useApp((s) => s.clearToast)
  useEffect(() => {
    if (!t) return
    const h = setTimeout(clear, t.action ? 8000 : t.longo ? 6000 : 3200)
    return () => clearTimeout(h)
  }, [t, clear])
  if (!t) return null
  return (
    <div className={`toast${t.longo ? ' longo' : ''}`} role="status" aria-live="polite" key={t.id}>
      <span>{t.text}</span>
      {t.action && <button onClick={() => { t.action!.run(); clear() }}>{t.action.label}</button>}
    </div>
  )
}
