import { useEffect, useRef, useState } from 'react'
import { openLayer } from '../services/backStack'

/** Toda tela que "cobre" a anterior entra na pilha do voltar enquanto estiver ativa.
 *  O voltar TIRA a camada da pilha antes de chamá-la: se, depois de fechada, a tela continua ativa (ex.: Cards com baralho → editor →
 *  voltar → ainda dentro do baralho), ela volta para a pilha. Sem isso o 2º voltar pulava para o Início. */
export function useBackLayer(active: boolean, onClose: () => void, leve = false) {
  const ref = useRef(onClose)
  const [fechadas, setFechadas] = useState(0) // sobe a cada fechamento: refaz o registro enquanto `active` seguir verdadeiro
  useEffect(() => { ref.current = onClose })
  useEffect(() => {
    if (!active) return
    return openLayer(() => { ref.current(); setFechadas((n) => n + 1) }, leve)
  }, [active, leve, fechadas])
}
