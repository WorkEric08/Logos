import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useBackLayer } from './useBackLayer'

interface Props {
  titulo: string
  texto: string
  /** Rótulo do botão que faz a ação (em vermelho). */
  confirmar: string
  onConfirmar: () => void
  onCancelar: () => void
  /** Rótulo do botão seguro (o que recebe o foco). Padrão "Cancelar". */
  cancelar?: string
}

/**
 * "Tem certeza?" no meio da tela, com o fundo em desfoque (2026-11-17), para apagar algo (espaço, material…). Não é o confirm() do navegador: é uma camada do app,
 * com foco, Esc e o botão voltar do celular (que fecha só o aviso). O botão seguro ("Cancelar") recebe o foco, para um toque sem querer não apagar.
 * Mesmo desenho do aviso de encerrar o simulado (ConfirmarSaida): `.dialogo-veu` + `.dialogo`.
 */
export function ConfirmarAcao({ titulo, texto, confirmar, onConfirmar, onCancelar, cancelar: rotuloCancelar = 'Cancelar' }: Props) {
  const seguro = useRef<HTMLButtonElement>(null)
  const cancelar = useRef(onCancelar); cancelar.current = onCancelar
  useBackLayer(true, onCancelar)
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null
    seguro.current?.focus({ preventScroll: true })
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); cancelar.current() } }
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('keydown', esc); antes?.focus?.({ preventScroll: true }) }
  }, [])
  return createPortal(
    <div className="dialogo-veu" data-confirmar-acao="" onClick={(e) => { if (e.target === e.currentTarget) onCancelar() }}>
      <div className="dialogo card" role="alertdialog" aria-modal="true" aria-labelledby="ca-t" aria-describedby="ca-d">
        <h2 id="ca-t">{titulo}</h2>
        <p id="ca-d">{texto}</p>
        <div className="row">
          <button ref={seguro} type="button" className="btn pri" onClick={onCancelar}>{rotuloCancelar}</button>
          <button type="button" className="btn warn" onClick={onConfirmar}>{confirmar}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
