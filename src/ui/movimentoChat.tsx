// Movimento do chat do assistente: o assistente "digita" antes de cada fala, números sobem contando, painéis e pílulas SAEM com animação antes de a tela mudar.
// Tudo respeita "reduzir movimento" do aparelho: sem animação, sem espera, tudo aparece de uma vez (e o app segue igual). Durações em core/ritmo.ts.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { DURACAO_SAIDA, PAUSA_ENTRE_FALAS, atrasoDeFala, valorContagem } from '../core/ritmo'
import { disposicaoPilulas } from '../core/pilulas'
import type { Msg } from '../store/assistente'

const consulta = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null)
export const reduzMovimento = (): boolean => { try { return !!consulta()?.matches } catch { return false } }

export function useReduzMovimento(): boolean {
  const [r, setR] = useState(reduzMovimento)
  useEffect(() => {
    const mq = consulta()
    if (!mq) return
    const f = () => setR(mq.matches)
    mq.addEventListener?.('change', f)
    return () => mq.removeEventListener?.('change', f)
  }, [])
  return r
}

/**
 * Mostra as mensagens uma a uma: as da pessoa entram na hora; as do assistente depois de um "digitando…" (tempo proporcional ao texto).
 * `vistasIniciais` = quantas já foram mostradas antes (quem volta à aba vê tudo de uma vez, sem refazer a conversa). Devolve quantas estão visíveis,
 * se ainda há fala a caminho (`falando`) e se a próxima é do assistente (para mostrar os pontinhos).
 */
export function useFalas(mensagens: readonly Msg[], vistasIniciais: number, aoMostrar: (n: number) => void) {
  const reduz = useReduzMovimento()
  const total = mensagens.length
  const [n, setN] = useState(() => Math.min(vistasIniciais, total))
  const aoMostrarRef = useRef(aoMostrar)
  useEffect(() => { aoMostrarRef.current = aoMostrar })
  useEffect(() => { aoMostrarRef.current(n) }, [n])
  useEffect(() => {
    if (n >= total) return
    if (reduz) { setN(total); return }
    const proxima = mensagens[n]
    const espera = proxima.de === 'v' ? 0 : n === 0 ? atrasoDeFala(proxima.texto) : atrasoDeFala(proxima.texto) + PAUSA_ENTRE_FALAS
    const t = setTimeout(() => setN((x) => Math.min(total, x + 1)), espera)
    return () => clearTimeout(t)
  }, [n, total, reduz, mensagens])
  const falando = n < total
  return { visiveis: n, falando, digitando: falando && mensagens[n]?.de === 'a' && !reduz }
}

/** Um número que sobe de 0 até `alvo` (e fica nele). Com "reduzir movimento", já começa no alvo. */
export function useContagem(alvo: number, duracaoMs = 700): number {
  const reduz = useReduzMovimento()
  const [v, setV] = useState(reduz ? alvo : 0)
  useEffect(() => {
    if (reduz) { setV(alvo); return }
    let raf = 0
    const t0 = performance.now()
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - t0) / duracaoMs)
      setV(valorContagem(t, alvo))
      if (t < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [alvo, duracaoMs, reduz])
  return v
}

// ---- saída: o painel (ou as pílulas) some com animação e só então a tela muda ----
type Fechar = (depois: () => void) => void
const FecharCtx = createContext<Fechar>((depois) => depois())
export const useFechar = (): Fechar => useContext(FecharCtx)

/** Um painel da conversa. Entra com `as-abre` (CSS) e, quando alguém chama `fechar(cb)`, sai com `as-fecha` e só depois roda `cb`. */
export function Cena({ chave, children }: { chave: string; children: ReactNode }) {
  const reduz = useReduzMovimento()
  const [saindo, setSaindo] = useState(false)
  const vivo = useRef(true)
  useEffect(() => { vivo.current = true; return () => { vivo.current = false } }, [])
  useEffect(() => { setSaindo(false) }, [chave])
  const fechar = useCallback<Fechar>((depois) => {
    if (reduz) { depois(); return }
    setSaindo(true)
    setTimeout(() => { depois() }, DURACAO_SAIDA)
  }, [reduz])
  return (
    <FecharCtx value={fechar}>
      <div key={chave} className={`as-cena${saindo ? ' saindo' : ''}`} data-cena={chave}>{children}</div>
    </FecharCtx>
  )
}

/** Pílulas de sugestão: entram em cascata; ao tocar numa, ela "voa" e as outras recolhem, e só então a ação roda. */
export interface ItemPilula { id: string; rotulo: string; run: () => void; pri?: boolean; acao?: string }
export function Pilulas({ itens, rotuloGrupo = 'Sugestões' }: { itens: readonly ItemPilula[]; rotuloGrupo?: string }) {
  const reduz = useReduzMovimento()
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const toque = (it: ItemPilula) => {
    if (escolhida) return
    if (reduz) { it.run(); return }
    setEscolhida(it.id)
    setTimeout(() => { it.run(); setEscolhida(null) }, DURACAO_SAIDA)
  }
  const largura = disposicaoPilulas(itens.map((it) => it.rotulo)) // no celular: as curtas em duplas, as longas na linha toda
  return (
    <div className={`as-sug-lista${escolhida ? ' saindo' : ''}`} role="group" aria-label={rotuloGrupo}>
      {itens.map((it, i) => (
        <button key={it.id} className={`as-pilula ${largura[i]}${it.pri ? ' pri' : ''}${escolhida === it.id ? ' escolhida' : ''}`} style={{ '--i': i } as React.CSSProperties} data-acao={it.acao} data-sug={it.acao ? undefined : it.id} onClick={() => toque(it)}>{it.rotulo}</button>
      ))}
    </div>
  )
}
