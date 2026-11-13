import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type IconName = 'home' | 'train' | 'chart' | 'sliders' | 'check' | 'x' | 'doc' | 'back' | 'clock' | 'repeat' | 'flag' | 'note' | 'cards' | 'trash' | 'plus' | 'forward' | 'chat'

const PATHS: Record<IconName, string> = {
  home: 'M3.5 11 12 3.8 20.5 11M5.5 9.5V20h5v-5.5h3V20h5V9.5',
  train: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 12h.01',
  chart: 'M5 20V11M11 20V4M17 20v-7M3 20h18',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5',
  back: 'M15 5l-7 7 7 7',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  cards: 'M9 7.5h9a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 17V9A1.5 1.5 0 0 1 9 7.5zM4.5 15V7A1.5 1.5 0 0 1 6 5.5h8.5',
  flag: 'M7 3.5h10V20.5l-5-4-5 4z',
  note: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7M10 11v5M14 11v5',
  plus: 'M12 5v14M5 12h14',
  forward: 'M9 5l7 7-7 7',
  chat: 'M5.5 4.5h13A1.5 1.5 0 0 1 20 6v9a1.5 1.5 0 0 1-1.5 1.5H11L7 20v-3.5H5.5A1.5 1.5 0 0 1 4 15V6a1.5 1.5 0 0 1 1.5-1.5zM8 9h8M8 12h5',
  repeat: 'M17 3l3 3-3 3M20 6H8a4 4 0 0 0-4 4M7 21l-3-3 3-3M4 18h12a4 4 0 0 0 4-4',
}

export function Icon({ n, size = 22 }: { n: IconName; size?: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={PATHS[n]} /></svg>
  )
}

/** Sigla da matéria no selo quadrado (decorativo: o nome vem sempre ao lado). */
const BADGES: Record<string, string> = {
  'Vendas e Negociação': 'VN', 'Conhecimentos de Informática': 'IF', 'Língua Portuguesa': 'PT', 'Conhecimentos Bancários': 'BC',
  'Matemática Financeira': 'MF', 'Matemática': 'MT', 'Língua Inglesa': 'EN', 'Atualidades do Mercado Financeiro': 'AT',
  'Estatística': 'ES', 'Ética': 'ET', 'Legislação': 'LG', 'Conhecimentos Digitais': 'CD',
}
export const Badge = ({ m }: { m: string }) => <span className="badge" aria-hidden="true">{BADGES[m] ?? m.slice(0, 2).toUpperCase()}</span>

/** Linha fina com “+” nas pontas (marca das referências). */
export const Hr = ({ className = '' }: { className?: string }) => <i className={`hr ${className}`} aria-hidden="true" />

export function Top({ title, sub, ok }: { title: string; sub?: string; ok?: boolean }) {
  return (
    <>
      <div className="top"><h1>{title}</h1>{sub && <small className={ok ? 'ok' : undefined} role={ok ? 'status' : undefined}>{sub}</small>}</div>
      <Hr className="lg" />
    </>
  )
}

/** Janela larga o bastante para o painel lateral (mesmo limite do CSS: 1180 px). */
const WIDE = '(min-width:1180px)'
export function useWide() {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(WIDE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => window.matchMedia(WIDE).matches,
  )
}

/** Coluna da direita (altura toda) onde o painel de detalhes aparece em tela larga. */
export const SlotCtx = createContext<HTMLElement | null>(null)

/** Painel de detalhes: na coluna da direita em tela larga; no fluxo da página nas demais. */
export function Aside({ className = '', children }: { className?: string; children: ReactNode }) {
  const slot = useContext(SlotCtx)
  const wide = useWide()
  return wide && slot
    ? createPortal(<div className={`side-in ${className}`}>{children}</div>, slot)
    : <aside className={`side ${className}`}>{children}</aside>
}

/** Anel de progresso (0–100). O número no centro é HTML, não SVG, para seguir a fonte do app. */
export function Ring({ p, label }: { p: number; label: string }) {
  const r = 52, c = 2 * Math.PI * r
  return (
    <div className="ring" role="img" aria-label={`${p}% ${label}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} className="rt" />
        {p > 0 && <circle cx="60" cy="60" r={r} className="rp" strokeDasharray={`${(c * p) / 100} ${c}`} transform="rotate(-90 60 60)" />}
      </svg>
      <span><b>{p}%</b>{label}</span>
    </div>
  )
}
