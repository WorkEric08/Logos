import { useEffect, useRef, type ReactNode } from 'react'

/** Quanto o botão apertado espera antes de começar a repetir, e o intervalo entre um passo e o seguinte. */
const ESPERA_REPETIR_MS = 420
const INTERVALO_MS = 90

interface Props {
  rotulo: string
  /** Um passo (um toque, ou cada repetição enquanto aperta). */
  aoPasso: () => void
  /** O aperto terminou (soltou ou saiu da tela). Só roda se houve passo. */
  aoSoltar: () => void
  /** Pelo teclado (Enter/espaço) vale o clique normal: um passo e já termina. */
  aoTeclado: () => void
  children: ReactNode
}

/**
 * Botão de "−" / "+" que anda um passo ao toque e, apertado e SEGURADO, repete o passo até soltar (o seletor do horário do lembrete e o do tempo do plano de estudo).
 * Durante o aperto quem usa só mexe na tela; o que é caro (guardar, reagendar) fica em `aoSoltar`, que roda uma vez.
 */
export function BotaoRepete({ rotulo, aoPasso, aoSoltar, aoTeclado, children }: Props) {
  const t = useRef<{ espera?: number; repete?: number; apertado: boolean }>({ apertado: false })
  const funcoes = useRef({ aoPasso, aoSoltar }); funcoes.current = { aoPasso, aoSoltar }
  const soltar = () => {
    const e = t.current
    clearTimeout(e.espera); clearInterval(e.repete)
    if (e.apertado) { e.apertado = false; funcoes.current.aoSoltar() }
  }
  useEffect(() => soltar, []) // eslint-disable-line react-hooks/exhaustive-deps -- ao sair da tela com o botão apertado, termina o aperto
  const apertar = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || t.current.apertado) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* sem captura: o soltar do dedo ainda chega */ }
    t.current.apertado = true
    funcoes.current.aoPasso()
    t.current.espera = window.setTimeout(() => { t.current.repete = window.setInterval(() => funcoes.current.aoPasso(), INTERVALO_MS) }, ESPERA_REPETIR_MS)
  }
  return (
    <button type="button" className="btn lemb-passo" aria-label={rotulo}
      onPointerDown={apertar} onPointerUp={soltar} onPointerCancel={soltar} onLostPointerCapture={soltar} onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => { if (e.detail === 0) aoTeclado() }}>{children}</button>
  )
}
