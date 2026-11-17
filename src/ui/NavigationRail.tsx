import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { descreverAba, ladoDoToque, moverPorTecla, posDoToque, type Icones, type Lado } from '../core/aba'
import { alvoDoArrasto, deslocamentoDoVizinho, descreverMovimento, limitarDy } from '../core/ordemRail'
import { Icon, type IconName } from './bits'
import { useBackLayer } from './useBackLayer'
import { layerCount } from '../services/backStack'

/** Um destino da barra. `id` é a rota (aba) que o app já usa; a lógica de rotas continua no App. */
export interface ItemRail<T extends string = string> { id: T; rotulo: string; icone: IconName }

const CELULAR = '(max-width:899px)' // abaixo disso a barra é a do celular (64 px, sobreposta, com aba); acima, o trilho fixo do computador

/** Estado recolhida/aberta. No celular a barra SEMPRE começa recolhida (estado de repouso) e volta a ele ao escolher uma tela. */
export function useRailRecolhida(): [boolean, () => void, () => void] {
  const [recolhida, setRecolhida] = useState(true)
  return [recolhida, () => setRecolhida((v) => !v), () => setRecolhida(true)]
}

export const useCelular = () => useSyncExternalStore(
  (cb) => { const m = window.matchMedia(CELULAR); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
  () => window.matchMedia(CELULAR).matches,
)

const ARRASTO_MIN = 40 // px para contar como "arrastar"
const SEGURAR_MS = 380 // segurar a aba por tanto tempo (sem mexer) começa a mover a aba
const TOLERANCIA = 8 // px que o dedo pode tremer durante o "segurar" sem virar arrasto

interface Props<T extends string> {
  itens: ItemRail<T>[]
  /** Item da tela atual; `null` quando uma tela cobre as abas (ex.: uma questão aberta). */
  ativo: T | null
  /** Nome mostrado na vertical na aba (a tela atual). */
  nomeAtual: string
  recolhida: boolean
  onSelecionar: (id: T) => void
  onAlternar: () => void
  /** Onde a aba fica: lado da tela e altura (0 = alto, 1 = pé). A barra abre do mesmo lado da aba. */
  lado: Lado
  posicao: number
  /** Chamado ao soltar a aba depois de segurar e arrastar (ou ao usar Alt + setas no teclado). */
  onMover: (lado: Lado, posicao: number) => void
  /** Chamado ao soltar um ícone depois de segurar e arrastar (ou Alt + setas no ícone): `para` é o novo índice na lista. */
  onReordenar?: (id: T, para: number) => void
  /** Onde os ícones ficam dentro da barra aberta do celular: em cima (padrão), no meio ou embaixo. */
  icones?: Icones
  /** Mostrar a seta da aba? Falso só a tira da vista (a aba continua no lugar e funciona igual). */
  seta?: boolean
}

/**
 * Navigation Rail. No celular (< 900 px) ela é uma camada que se SOBREPÕE ao conteúdo: o conteúdo não se adapta nem se mexe.
 * Recolhida (repouso), só a aba aparece na borda da tela: uma seta num quadrado da cor da barra (que pode ficar por cima do conteúdo). Aberta, a barra de 64 px
 * (botões quadrados de 44 px, item ativo em amarelo/laranja) desliza por cima, do mesmo lado da aba, e o conteúdo ganha um
 * desfoque. Escolher uma tela, tocar no desfoque ou na aba, arrastar para o lado da borda, Esc ou o botão voltar do Android devolvem
 * tudo ao repouso. SEGURAR a aba (~0,4 s) e arrastar a leva para cima ou para baixo e para o outro lado da tela; ao soltar, ela fica
 * ali (Alt + setas faz o mesmo no teclado). No computador (≥ 900 px) é o trilho fixo de 96 px, sem aba nem desfoque.
 */
export function NavigationRail<T extends string>({ itens, ativo, nomeAtual, recolhida, onSelecionar, onAlternar, lado, posicao, onMover, onReordenar, icones = 'cima', seta = true }: Props<T>) {
  const celular = useCelular()
  const aberta = celular && !recolhida
  const [rascunho, setRascunho] = useState<{ lado: Lado; pos: number } | null>(null) // posição enquanto o dedo arrasta a aba
  const [aviso, setAviso] = useState('')
  const ef = rascunho ?? { lado, pos: posicao }
  const movendo = rascunho !== null
  const nav = useRef<HTMLElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  // ícone sendo arrastado dentro da barra: `dy` é quanto ele andou, `para` o lugar em que ficaria se fosse solto agora
  const [reo, setReo] = useState<{ id: string; de: number; para: number; dy: number; soltando?: boolean } | null>(null)
  const reoRef = useRef<{ id: string; de: number; passo: number; n: number; y0: number; para: number; dy: number; soltando?: boolean } | null>(null)
  const focar = useRef<string | null>(null) // depois de mover um ícone pelo teclado, devolve o foco a ele
  const gesto = useRef<{ x: number; y: number } | null>(null) // arrasto de abrir/fechar
  const segura = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null) // aguardando o "segurar"
  const mov = useRef<{ sat: number; sab: number; ult: { lado: Lado; pos: number } } | null>(null) // movendo a aba (dados do arrasto)
  const engolir = useRef(false) // o clique que vem no fim de um arrasto não vale
  const itensRef = useRef(itens); itensRef.current = itens
  const engolirAte = useRef(0) // até esta hora (ms) o clique que vem depois de um deslize na tela não vale
  const atual = useRef({ recolhida, onAlternar, lado, posicao, onMover, celular, ativo, onReordenar }); atual.current = { recolhida, onAlternar, lado, posicao, onMover, celular, ativo, onReordenar }

  useBackLayer(aberta, onAlternar) // o voltar fecha a barra aberta antes de qualquer outra coisa
  useEffect(() => {
    if (!aberta) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onAlternar() } }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aberta, onAlternar])

  // Tudo do arrasto é ouvido na JANELA: com o mouse (ou o dedo fora do elemento) o "soltar" cai em outro elemento.
  useEffect(() => {
    const cancelaSegurar = () => { if (segura.current) { clearTimeout(segura.current.timer); segura.current = null } }
    const desfazMover = () => { mov.current = null; setRascunho(null) }
    const move = (e: PointerEvent) => {
      const r = reoRef.current
      if (r && !r.soltando) { // arrastando um ícone: ele acompanha o dedo na vertical e os vizinhos abrem espaço
        r.dy = limitarDy(e.clientY - r.y0, r.de, r.passo, r.n); r.para = alvoDoArrasto(r.de, r.dy, r.passo, r.n)
        setReo({ id: r.id, de: r.de, para: r.para, dy: r.dy })
        return
      }
      if (mov.current) { // arrastando a aba: ela acompanha o dedo (altura) e gruda na metade da tela em que o dedo está (lado)
        const p = { lado: ladoDoToque(e.clientX, window.innerWidth), pos: posDoToque(e.clientY, window.innerHeight, mov.current.sat, mov.current.sab) }
        mov.current.ult = p; setRascunho(p)
      } else if (segura.current && Math.hypot(e.clientX - segura.current.x, e.clientY - segura.current.y) > TOLERANCIA) cancelaSegurar() // mexeu cedo: é arrasto de abrir/fechar, não "segurar"
    }
    const desfazReo = () => { reoRef.current = null; setReo(null) }
    const solta = (e: PointerEvent) => {
      cancelaSegurar()
      const r = reoRef.current
      if (r) { // fim do "segurar e arrastar" de um ícone: ele desliza até o lugar escolhido e a ordem passa a valer
        gesto.current = null; engolir.current = true
        if (r.soltando) return
        r.soltando = true
        const ms = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 170
        setReo({ id: r.id, de: r.de, para: r.para, dy: (r.para - r.de) * r.passo, soltando: true })
        setTimeout(() => {
          if (reoRef.current !== r) return // cancelado (Esc) enquanto deslizava
          if (r.para !== r.de) { atual.current.onReordenar?.(r.id as T, r.para); setAviso(descreverMovimento(itensRef.current.find((i) => i.id === r.id)?.rotulo ?? '', r.para, r.n)) }
          desfazReo()
        }, ms)
        return
      }
      if (mov.current) { // fim do "segurar e arrastar": a aba fica onde foi solta
        const { ult } = mov.current; desfazMover(); engolir.current = true
        atual.current.onMover(ult.lado, ult.pos)
        setAviso(`Aba movida ${descreverAba(ult)}`)
        return
      }
      const g = gesto.current; gesto.current = null
      if (!g) return
      const dx = e.clientX - g.x, dy = e.clientY - g.y
      if (Math.abs(dx) < ARRASTO_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return
      engolir.current = true
      const { recolhida: rec, onAlternar: alterna, lado: l } = atual.current
      const paraBorda = l === 'esq' ? dx < 0 : dx > 0 // arrastar em direção à borda da aba fecha; para dentro da tela abre
      if ((paraBorda && !rec) || (!paraBorda && rec)) alterna()
    }
    const cancela = () => { cancelaSegurar(); gesto.current = null; if (mov.current) desfazMover(); if (reoRef.current) desfazReo() }
    // Deslizar em QUALQUER ponto da tela, em direção ao interior a partir do lado da aba, abre a barra. Usa eventos de toque (o navegador
    // cancela os de ponteiro quando começa a rolar) e ignora campos, imagem ampliada e listas que rolam de lado.
    const rolaDeLado = (el: Element | null) => {
      for (; el && el !== document.body; el = el.parentElement) {
        const o = getComputedStyle(el).overflowX
        if ((o === 'auto' || o === 'scroll') && el.scrollWidth > el.clientWidth + 1) return true
      }
      return false
    }
    let toque: { x: number; y: number } | null = null
    const tIni = (e: TouchEvent) => {
      toque = null
      const a = atual.current, alvo = e.target instanceof Element ? e.target : null
      if (e.touches.length !== 1 || !alvo || !a.celular || !a.recolhida || mov.current || segura.current) return
      if (layerCount() > (a.ativo === null ? 1 : 0)) return // há uma folha ou camada aberta por cima
      if (alvo.closest('.nav.rail, .rail-veu, .ampliador, [role="dialog"], input, textarea, select, [data-no-swipe]') || rolaDeLado(alvo)) return
      toque = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    const tFim = (e: TouchEvent) => {
      const t = toque, c = e.changedTouches[0]; toque = null
      if (!t || !c) return
      const dx = c.clientX - t.x, dy = c.clientY - t.y
      if (Math.abs(dx) < ARRASTO_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return
      const a = atual.current
      if (!a.recolhida || (a.lado === 'esq' ? dx < 0 : dx > 0)) return // só para dentro da tela
      a.onAlternar(); engolirAte.current = Date.now() + 400 // o "soltar" do deslize não pode virar clique no que estava embaixo
    }
    const tCancela = () => { toque = null }
    const clique = (e: MouseEvent) => { if (Date.now() < engolirAte.current) { e.stopPropagation(); e.preventDefault(); engolirAte.current = 0 } }
    window.addEventListener('touchstart', tIni, { passive: true }); window.addEventListener('touchend', tFim, { passive: true })
    window.addEventListener('touchcancel', tCancela, { passive: true }); window.addEventListener('click', clique, true)
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && (mov.current || reoRef.current)) { e.stopPropagation(); if (mov.current) desfazMover(); desfazReo() } } // Esc durante o arrasto: volta para onde estava
    const tMove = (e: TouchEvent) => { if (reoRef.current && e.cancelable) e.preventDefault() } // o dedo move o ícone, não rola a lista
    window.addEventListener('touchmove', tMove, { passive: false })
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', solta); window.addEventListener('pointercancel', cancela)
    window.addEventListener('keydown', tecla, true)
    return () => {
      cancelaSegurar()
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', solta); window.removeEventListener('pointercancel', cancela)
      window.removeEventListener('keydown', tecla, true); window.removeEventListener('touchmove', tMove)
      window.removeEventListener('touchstart', tIni); window.removeEventListener('touchend', tFim)
      window.removeEventListener('touchcancel', tCancela); window.removeEventListener('click', clique, true)
    }
  }, [])

  const aoApertar = (e: React.PointerEvent) => { gesto.current = { x: e.clientX, y: e.clientY }; engolir.current = false }
  const engolirClique = (e: React.MouseEvent) => { if (engolir.current) { e.stopPropagation(); e.preventDefault(); engolir.current = false } }

  // Segurar a aba: depois de SEGURAR_MS parada, ela "levanta" e passa a seguir o dedo.
  const aoApertarAba = (e: React.PointerEvent) => {
    if (!celular || e.button > 0) return
    const x = e.clientX, y = e.clientY
    const timer = setTimeout(() => {
      segura.current = null; gesto.current = null // deixou de ser toque/arrasto de abrir e fechar
      const cs = nav.current ? getComputedStyle(nav.current) : null
      const sat = cs ? Math.max(0, parseFloat(cs.paddingTop) - 14) : 0, sab = cs ? Math.max(0, parseFloat(cs.paddingBottom) - 14) : 0 // o CSS soma 14 px de respiro às áreas seguras
      mov.current = { sat, sab, ult: { lado: atual.current.lado, pos: atual.current.posicao } }
      if (!atual.current.recolhida) atual.current.onAlternar() // mover com a barra aberta: fecha primeiro
      setRascunho(mov.current.ult)
      try { navigator.vibrate?.(12) } catch { /* sem vibração */ }
    }, SEGURAR_MS)
    segura.current = { x, y, timer }
  }

  // Segurar um ícone: depois de SEGURAR_MS parado, ele "levanta" e passa a seguir o dedo na vertical.
  const aoApertarItem = (e: React.PointerEvent, id: string, i: number) => {
    if (e.button > 0 || !onReordenar || itens.length < 2) return
    const y = e.clientY, x = e.clientX
    const timer = setTimeout(() => {
      segura.current = null; gesto.current = null // deixou de ser toque e de ser arrasto de fechar
      const els = lista.current ? [...lista.current.querySelectorAll<HTMLElement>('.rail-item')] : []
      const passo = els.length > 1 ? els[1].getBoundingClientRect().top - els[0].getBoundingClientRect().top : 0
      if (passo <= 0 || els.length !== itens.length) return
      reoRef.current = { id, de: i, passo, n: els.length, y0: y, para: i, dy: 0 }
      setReo({ id, de: i, para: i, dy: 0 })
      try { navigator.vibrate?.(12) } catch { /* sem vibração */ }
    }, SEGURAR_MS)
    segura.current = { x, y, timer }
  }
  const aoTeclarItem = (e: React.KeyboardEvent, id: T, i: number) => { // Alt + ↑/↓ no ícone: a mesma coisa que segurar e arrastar
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || !onReordenar) return
    e.preventDefault()
    const para = Math.max(0, Math.min(itens.length - 1, i + (e.key === 'ArrowUp' ? -1 : 1)))
    if (para === i) return
    focar.current = id; onReordenar(id, para); setAviso(descreverMovimento(itens[i].rotulo, para, itens.length))
  }
  useEffect(() => { // devolve o foco ao ícone movido pelo teclado (o navegador o perde quando o elemento muda de lugar)
    if (focar.current) { lista.current?.querySelector<HTMLElement>(`[data-id="${focar.current}"]`)?.focus(); focar.current = null }
  })

  const aoTeclar = (e: React.KeyboardEvent) => { // Alt + setas: a mesma coisa que segurar e arrastar, sem mouse nem dedo
    if (!e.altKey || !e.key.startsWith('Arrow')) return
    e.preventDefault()
    const novo = moverPorTecla({ lado, pos: posicao }, e.key)
    onMover(novo.lado, novo.pos); setAviso(`Aba movida ${descreverAba(novo)}`)
  }

  return (
    <>
      {/* desfoque do conteúdo (só no celular, só com a barra aberta); tocar nele fecha a barra */}
      <div className="rail-veu" aria-hidden="true" onPointerDown={aoApertar} onClickCapture={engolirClique} onClick={onAlternar} />
      {/* guias das duas bordas enquanto a aba é arrastada: a do lado em que ela vai ficar acende */}
      {movendo && <div className="rail-guias" aria-hidden="true"><i className="esq" data-ativo={ef.lado === 'esq' ? '1' : undefined} /><i className="dir" data-ativo={ef.lado === 'dir' ? '1' : undefined} /></div>}
      <nav
        ref={nav} className="nav rail" aria-label="Seções" data-recolhida={recolhida ? '1' : undefined} data-lado={ef.lado} data-icones={icones} data-movendo={movendo ? '1' : undefined}
        style={{ '--aba-pos': ef.pos } as CSSProperties} onPointerDown={aoApertar} onClickCapture={engolirClique}
      >
        {/* `inert` enquanto recolhida: os botões escondidos não recebem foco nem toque (só no celular; no computador a barra nunca recolhe) */}
        <div className="rail-itens" id="rail-itens" ref={lista} inert={recolhida && celular} data-reordenando={reo ? '1' : undefined}>
          {itens.map((i, k) => (
            <button key={i.id} type="button" className="rail-item" data-id={i.id} aria-current={ativo === i.id ? 'page' : undefined}
              data-arrastando={reo?.id === i.id ? '1' : undefined} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              style={reo ? (reo.id === i.id ? { transform: `translateY(${reo.dy}px)`, transition: reo.soltando ? 'transform 160ms var(--ease-out)' : 'none' } : { transform: `translateY(${deslocamentoDoVizinho(k, reo.de, reo.para, reoRef.current?.passo ?? 0)}px)` }) : undefined}
              onPointerDown={(e) => aoApertarItem(e, i.id, k)} onKeyDown={(e) => aoTeclarItem(e, i.id, k)} onContextMenu={(e) => e.preventDefault()}
              onClick={() => { onSelecionar(i.id); if (aberta) onAlternar() }}>
              <span className="rail-ico"><Icon n={i.icone} size={22} /></span>
              <span className="rail-lb">{i.rotulo}</span>
            </button>
          ))}
        </div>
        <button
          type="button" className="rail-alca" data-movendo={movendo ? '1' : undefined} data-sem-seta={seta ? undefined : '1'} aria-expanded={!recolhida} aria-controls="rail-itens"
          aria-label={recolhida ? 'Mostrar a barra de navegação' : 'Recolher a barra de navegação'} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight"
          aria-description="Segure e arraste para mudar de lado ou de altura. Com o teclado, Alt mais as setas." onClick={onAlternar}
          onPointerDown={aoApertarAba} onKeyDown={aoTeclar} onContextMenu={(e) => e.preventDefault()}
        >
          <span className="rail-alca-vis">
            <span className="sr-only rail-nome">Tela atual: {nomeAtual}</span>
            <span className="rail-seta" aria-hidden="true"><Icon n="back" size={18} /></span>
          </span>
        </button>
      </nav>
      <span className="sr-only" role="status" aria-live="polite">{aviso}</span>
    </>
  )
}
