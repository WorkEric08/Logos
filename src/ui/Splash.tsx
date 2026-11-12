import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ARQUIVO, CAMINHO, CENTRO, CORES, DOBRA, DURACAO, LINHA, LINHAS, MARCADOR, POS, quadro, unidade } from '../core/splash'

const FADE_MS = 150 // saída para a tela inicial
const REDUZIDO_MS = 500 // movimento reduzido: o quadro final por meio segundo
const SEGURANCA_MS = 6000 // se o app não abrir até aqui, oferece "Tentar de novo"

const pos = (p: { x: number; y: number }, dx = 0, dy = 0) => `translate(${p.x + dx - CENTRO.x} ${p.y + dy - CENTRO.y})`

function Arquivo({ cores }: { cores: { corpo: string; dobra: string } }) {
  return <><path d={CAMINHO} fill={cores.corpo} /><path d={DOBRA} fill={cores.dobra} /></>
}

/**
 * Abertura animada de 2 s (3 arquivos em pé, fundo preto). `ready` = o app já carregou: a abertura só sai quando os 2 s acabaram E
 * `ready` é verdadeiro (se o carregamento demorar, o último quadro fica parado). `onFinish` roda depois do fade de 150 ms.
 * Os quadros são desenhados direto no DOM (sem render do React a cada quadro); só transform, opacity e visibility mudam.
 */
export function Splash({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const [tela, setTela] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [demora, setDemora] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const frente = useRef<SVGGElement>(null), meio = useRef<SVGGElement>(null), tras = useRef<SVGGElement>(null)
  const linhas = useRef<(SVGRectElement | null)[]>([])
  const tempoOk = useRef(false), pronto = useRef(ready), saindo = useRef(false), fim = useRef(onFinish)
  fim.current = onFinish

  const tentarSair = () => {
    if (saindo.current || !tempoOk.current || !pronto.current) return
    saindo.current = true
    raiz.current?.classList.add('saindo')
    setTimeout(() => fim.current(), FADE_MS)
  }

  // a abertura de verdade (preto fixo) assume do preto provisório do index.html no mesmo quadro
  useLayoutEffect(() => { document.documentElement.classList.remove('splash') }, [])

  useEffect(() => {
    const onResize = () => setTela({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => { pronto.current = ready; if (ready) tentarSair() }, [ready])

  useEffect(() => {
    const desenha = (t: number) => {
      const q = quadro(t)
      if (frente.current) {
        const cx = POS.frente.x + ARQUIVO.w / 2 - CENTRO.x, cy = POS.frente.y + ARQUIVO.h / 2 - CENTRO.y
        frente.current.setAttribute('transform', `translate(${cx} ${cy}) scale(${q.frente.escala}) translate(${-ARQUIVO.w / 2} ${-ARQUIVO.h / 2})`)
        frente.current.style.opacity = String(q.frente.opacidade)
      }
      for (const [ref, p, k] of [[meio, POS.meio, q.meio], [tras, POS.tras, q.tras]] as const) {
        if (!ref.current) continue
        ref.current.setAttribute('transform', pos(p, k.dx, k.dy))
        ref.current.style.visibility = k.visivel ? 'visible' : 'hidden'
      }
      LINHAS.forEach((l, i) => linhas.current[i]?.setAttribute('width', String(l.w * q.linhas[i])))
    }
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tFim = setTimeout(() => { tempoOk.current = true; tentarSair() }, reduzido ? REDUZIDO_MS : DURACAO * 1000)
    const tSeg = setTimeout(() => { if (!pronto.current) setDemora(true) }, SEGURANCA_MS)
    let raf = 0
    if (reduzido) desenha(DURACAO) // movimento reduzido: direto o estado final
    else {
      const ini = performance.now()
      const passo = (agora: number) => {
        const t = Math.min(DURACAO, (agora - ini) / 1000)
        desenha(t)
        if (t < DURACAO) raf = requestAnimationFrame(passo)
      }
      desenha(0); raf = requestAnimationFrame(passo)
    }
    return () => { cancelAnimationFrame(raf); clearTimeout(tFim); clearTimeout(tSeg) }
  }, [])

  const u = unidade(tela.w, tela.h)
  return (
    <div className="splash" ref={raiz} role="img" aria-label="Logos">
      <svg width={tela.w} height={tela.h} viewBox={`0 0 ${tela.w} ${tela.h}`} aria-hidden="true" focusable="false">
        <g transform={`translate(${tela.w / 2} ${tela.h / 2}) scale(${u})`}>
          <g ref={tras} style={{ visibility: 'hidden' }}><Arquivo cores={CORES.tras} /></g>
          <g ref={meio} style={{ visibility: 'hidden' }}><Arquivo cores={CORES.meio} /></g>
          <g ref={frente} style={{ opacity: 0 }}>
            <Arquivo cores={CORES.frente} />
            <path d={MARCADOR} fill={CORES.marcador} />
            {LINHAS.map((l, i) => <rect key={i} ref={(e) => { linhas.current[i] = e }} x={LINHA.x} y={l.y} width={0} height={LINHA.h} rx={LINHA.h / 2} fill={CORES.linhas} />)}
          </g>
        </g>
      </svg>
      {demora && (
        <div className="splash-aviso" role="status">
          <p>Está demorando mais que o normal para abrir.</p>
          <button className="btn small-btn" onClick={() => location.reload()}>Tentar de novo</button>
        </div>
      )}
    </div>
  )
}
