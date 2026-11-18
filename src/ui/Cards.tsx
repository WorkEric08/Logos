import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { DIA, LIMITES_NOVOS, NOTAS, TAM_MAX, contar, diaDe, meiaNoite, montarFila, rotulosDasNotas, type Cartao, type Nota } from '../core/cards'
import { sequencia } from '../core/historico'
import { useCards, type Foto } from '../store/cards'
import { useAssistente } from '../store/assistente'
import { Aside, Hr, Icon, Ring, Top } from './bits'
import { useBackLayer } from './useBackLayer'
import { aoAparecer } from './revelar'

type Tela = { t: 'home' } | { t: 'baralho'; id: string } | { t: 'editor'; b: string; id?: string } | { t: 'estudo'; b?: string }
/** Foca o campo ao abrir SEM rolar a tela (o autoFocus normal rola até o campo e a tela “pula”). Função estável: roda só ao montar. */
const focarSemRolar = (el: HTMLElement | null) => el?.focus({ preventScroll: true })
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
/** Cor da etiqueta do cartão: destaque = precisa de atenção hoje (aprendendo ou revisão vencida); verde = revisão que está longe; neutro = novo. */
const classeEstado = (c: Cartao, agora: number) => (c.estado === 'novo' ? '' : c.estado === 'aprendendo' || c.due < meiaNoite(agora, 1) ? ' rev' : ' ok')
const rotuloEstado = (c: Cartao, agora: number) => {
  if (c.estado === 'novo') return 'Novo'
  if (c.estado === 'aprendendo') return 'Aprendendo'
  const d = Math.round((c.due - meiaNoite(agora)) / DIA)
  return d <= 0 ? 'Revisão · hoje' : d === 1 ? 'Revisão · amanhã' : `Revisão · em ${d} d`
}

/** Tela "Cards" (flashcards): baralhos, cartões, editor e estudo com repetição espaçada. As sub-telas entram na pilha do botão voltar
 *  e deslizam (entra pela direita, volta pela esquerda). */
export function Cartoes() {
  const pronto = useCards((s) => s.pronto)
  // o assistente pode pedir que o estudo já abra (plano de estudo); o pedido é lido aqui (sem mudar nada ao ler) e limpo logo depois
  const [pilha, setPilha] = useState<Tela[]>(() => (useCards.getState().pedidoEstudo ? [{ t: 'home' }, { t: 'estudo' }] : [{ t: 'home' }]))
  useEffect(() => { if (useCards.getState().pedidoEstudo) useCards.getState().pedirEstudo(false) }, [])
  const [nav, setNav] = useState<{ n: number; dir: 'avanca' | 'recua' | null }>({ n: 0, dir: null }) // dir null = 1ª pintura, sem animar
  const tela = pilha[pilha.length - 1]
  // a rolagem é de cada tela: ao abrir uma sub-tela ela começa no topo; ao voltar, a anterior reaparece onde estava
  const posicoes = useRef<number[]>([]), voltarPara = useRef(0)
  const rolo = () => document.querySelector<HTMLElement>('.scroll-y')
  const abrir = (t: Tela) => { posicoes.current.push(rolo()?.scrollTop ?? 0); setPilha((p) => [...p, t]); setNav((x) => ({ n: x.n + 1, dir: 'avanca' })) }
  const voltar = () => { voltarPara.current = posicoes.current.pop() ?? 0; setPilha((p) => (p.length > 1 ? p.slice(0, -1) : p)); setNav((x) => ({ n: x.n + 1, dir: 'recua' })) }
  useLayoutEffect(() => { if (nav.dir) rolo()?.scrollTo(0, nav.dir === 'recua' ? voltarPara.current : 0) }, [nav])
  useBackLayer(pilha.length > 1, voltar)
  if (!pronto) return <div aria-busy="true" />
  const conteudo = (() => {
    switch (tela.t) {
      case 'baralho': return <TelaBaralho id={tela.id} voltar={voltar} abrir={abrir} />
      case 'editor': return <Editor b={tela.b} id={tela.id} voltar={voltar} />
      case 'estudo': return <Estudo b={tela.b} voltar={voltar} />
      default: return <Home abrir={abrir} />
    }
  })()
  return <div key={nav.n} className={`fc-tela${nav.dir ? ` ${nav.dir}` : ''}`}>{conteudo}</div>
}

// ───────────────────────── Início: baralhos e resumo do dia ─────────────────────────
function Home({ abrir }: { abrir: (t: Tela) => void }) {
  const baralhos = useCards((s) => s.baralhos), cartoes = useCards((s) => s.cartoes), ajustes = useCards((s) => s.ajustes), hist = useCards((s) => s.hist)
  const { novoBaralho, setLimite } = useCards.getState()
  const [criando, setCriando] = useState(false), [nome, setNome] = useState('')
  const agora = Date.now()
  const C = contar(cartoes, ajustes, agora)
  const respHoje = hist.dias[diaDe(agora)] ?? { n: 0, c: 0 }
  const seq = sequencia(hist, agora)
  const resumo: [string, string][] = [
    ['Para revisar', String(C.revisar)], ['Aprendendo', String(C.aprender)], ['Novos de hoje', String(C.novos)],
    ['Respondidos hoje', String(respHoje.n)], ['Sequência', plural(seq, 'dia', 'dias')],
    ['Aprendidos', `${C.aprendidos} de ${C.total}`], ['Maduros (≥ 21 d)', String(C.maduros)],
  ]
  const criar = (e: React.FormEvent) => { e.preventDefault(); const id = novoBaralho(nome); if (id) { setNome(''); setCriando(false); abrir({ t: 'baralho', id }) } }
  return (
    <div className="split edge tr">
      <div className="col">
        <Top title="Cards" sub={`${plural(C.total, 'cartão', 'cartões')} em ${plural(baralhos.length, 'baralho', 'baralhos')}`} />
        <div className="stats narrow-only fc-stats">
          <div className="stat"><b>{C.hoje}</b><span>para hoje</span></div>
          <div className="stat"><b>{C.revisar + C.aprender}</b><span>para revisar</span></div>
          <div className="stat"><b>{C.novos}</b><span>novos hoje</span></div>
        </div>
        <div className="sec first">Baralhos
          {!criando && <button className="btn small-btn secbtn" onClick={() => setCriando(true)}><Icon n="plus" size={16} />Novo baralho</button>}
        </div>
        {criando && (
          <form className="card fcnovo fc-entra" onSubmit={criar} autoComplete="off">
            <label htmlFor="nb">Nome do baralho</label>
            <input id="nb" className="campo" value={nome} maxLength={60} ref={focarSemRolar} placeholder="Ex.: Siglas do Sistema Financeiro" onChange={(e) => setNome(e.target.value)} autoComplete="off" enterKeyHint="done" />
            <div className="row"><button className="btn pri" type="submit">Criar baralho</button><button className="btn" type="button" onClick={() => { setCriando(false); setNome('') }}>Cancelar</button></div>
          </form>
        )}
        {baralhos.length === 0 && !criando ? (
          <div className="card fcvazio fc-entra">
            <span className="fcvazio-ic" aria-hidden="true"><Icon n="cards" size={26} /></span>
            <h3>Nenhum baralho ainda</h3>
            <p className="note">Crie um baralho e adicione cartões com frente e verso, ou crie cartões a partir das questões que você errou. Eles voltam na hora certa para fixar o que você esquece.</p>
            <div className="row"><button className="btn pri" onClick={() => setCriando(true)}>Criar o primeiro baralho</button></div>
          </div>
        ) : (
          <div className="decks">
            {baralhos.map((b, i) => {
              const seus = cartoes.filter((c) => c.b === b.id), k = contar(seus, ajustes, agora)
              const p = seus.length ? Math.round((100 * k.aprendidos) / seus.length) : 0
              return (
                <article key={b.id} className="card deck fc-entra" style={{ '--i': Math.min(i, 8) } as CSSProperties}>
                  <h3><button className="deck-abrir" onClick={() => abrir({ t: 'baralho', id: b.id })} aria-label={`Abrir o baralho ${b.nome}`}>{b.nome}</button></h3>
                  <p className="deckmeta">{seus.length === 0 ? 'Sem cartões' : <>{plural(seus.length, 'cartão', 'cartões')}<span aria-hidden="true"> · </span><span className="deckpc">{p}% aprendidos</span></>}</p>
                  <span className="bar" aria-hidden="true"><i style={{ width: `${p}%` }} /></span>
                  <div className="deckfim">
                    <span className="fctags">
                      {seus.length === 0 ? <span className="fctag">Vazio</span>
                        : k.hoje === 0 ? <span className="fctag ok"><Icon n="check" size={13} />Em dia</span>
                        : <>
                          {k.revisar + k.aprender > 0 && <span className="fctag rev">{k.revisar + k.aprender} revisar</span>}
                          {k.novos > 0 && <span className="fctag">{k.novos} {k.novos === 1 ? 'novo' : 'novos'}</span>}
                        </>}
                    </span>
                    <button className="btn pri deck-estudar" disabled={!k.hoje} onClick={() => abrir({ t: 'estudo', b: b.id })}>Estudar{k.hoje ? ` · ${k.hoje}` : ''}</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
        <div className="sec">Novos por dia</div>
        <div className="card">
          <div className="chips" role="group" aria-label="Quantos cartões novos por dia">
            {LIMITES_NOVOS.map((n) => <button key={n} className="chip" aria-pressed={ajustes.limite === n} onClick={() => setLimite(n)}>{n === 0 ? 'Sem limite' : n}</button>)}
          </div>
          <p className="note">Limita quantos cartões que você nunca viu entram por dia. As revisões dos que já aprendeu não têm limite.</p>
        </div>
      </div>
      <Aside className="go panel tr">
        <div className="side-h wide-only"><Icon n="cards" size={18} />Hoje</div>
        <Hr className="wide-only" />
        <div className="wide-only">
          <div className="preview"><Ring p={C.total ? Math.round((100 * C.aprendidos) / C.total) : 0} label="aprendidos" /></div>
          <Hr />
          <p className="count"><b>{C.hoje}</b>{C.hoje === 1 ? 'cartão' : 'cartões'} para hoje</p>
          <dl className="sum">{resumo.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          <Hr />
        </div>
        <button className="btn pri" disabled={!C.hoje} onClick={() => abrir({ t: 'estudo' })}>{C.hoje ? `Estudar agora · ${C.hoje}` : 'Nada para estudar hoje'}</button>
      </Aside>
    </div>
  )
}

// ───────────────────────── Um baralho: lista de cartões ─────────────────────────
function TelaBaralho({ id, voltar, abrir }: { id: string; voltar: () => void; abrir: (t: Tela) => void }) {
  const baralho = useCards((s) => s.baralhos.find((b) => b.id === id)), todos = useCards((s) => s.cartoes), ajustes = useCards((s) => s.ajustes)
  const { renomear, excluirBaralho, excluirCartao } = useCards.getState()
  const [busca, setBusca] = useState(''), [renomeando, setRenomeando] = useState(false), [nome, setNome] = useState(''), [ask, setAsk] = useState(false), [limite, setLimite] = useState(100)
  const [saindo, setSaindo] = useState<string | null>(null) // cartão que está sumindo (a animação termina e só então é excluído)
  const [entrada, setEntrada] = useState(true) // as linhas entram em cascata só quando a tela abre, não a cada letra da busca
  useEffect(() => { const t = setTimeout(() => setEntrada(false), 900); return () => clearTimeout(t) }, [])
  const agora = Date.now()
  const seus = useMemo(() => todos.filter((c) => c.b === id), [todos, id])
  const lista = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR')
    return (q ? seus.filter((c) => c.f.toLocaleLowerCase('pt-BR').includes(q) || c.v.toLocaleLowerCase('pt-BR').includes(q)) : seus).slice().sort((a, b) => b.criado - a.criado)
  }, [seus, busca])
  const fim = useRef<string | null>(null)
  const concluirSaida = (cid: string) => { if (fim.current !== cid) return; fim.current = null; setSaindo(null); excluirCartao(cid) }
  const excluir = (c: Cartao, altura: number, el: HTMLElement) => {
    if (fim.current) return
    fim.current = c.id; el.style.setProperty('--h', `${altura}px`); setSaindo(c.id)
    setTimeout(() => concluirSaida(c.id), 450) // rede de segurança se a animação não rodar
  }
  if (!baralho) return <div className="card fcvazio"><h3>Este baralho não existe mais</h3><div className="row"><button className="btn" onClick={voltar}>Voltar aos baralhos</button></div></div>
  const k = contar(seus, ajustes, agora)
  return (
    <div className="split edge tr">
      <div className="col">
        <div className="qbar"><button className="btn small-btn" onClick={voltar}><Icon n="back" size={18} />Baralhos</button></div>
        <Top title={baralho.nome} sub={`${plural(seus.length, 'cartão', 'cartões')} · ${k.hoje} para hoje`} />
        {renomeando ? (
          <form className="card fcnovo fc-entra" autoComplete="off" onSubmit={(e) => { e.preventDefault(); if (renomear(id, nome)) setRenomeando(false) }}>
            <label htmlFor="rn">Novo nome</label>
            <input id="rn" className="campo" value={nome} maxLength={60} ref={focarSemRolar} onChange={(e) => setNome(e.target.value)} autoComplete="off" enterKeyHint="done" />
            <div className="row"><button className="btn pri" type="submit">Salvar nome</button><button className="btn" type="button" onClick={() => setRenomeando(false)}>Cancelar</button></div>
          </form>
        ) : (
          <div className="fcacoes">
            <button className="btn pri" disabled={!k.hoje} onClick={() => abrir({ t: 'estudo', b: id })}>Estudar{k.hoje ? ` · ${k.hoje}` : ''}</button>
            <button className="btn" onClick={() => abrir({ t: 'editor', b: id })}>Novo cartão</button>
            <button className="btn" onClick={() => { setNome(baralho.nome); setRenomeando(true) }}>Renomear</button>
          </div>
        )}
        {seus.length > 0 && (
          <div className="fcbusca">
            <label className="sr-only" htmlFor="bq">Buscar nos cartões</label>
            <input id="bq" className="campo" type="search" value={busca} placeholder="Buscar nos cartões" onChange={(e) => { setBusca(e.target.value); setLimite(100) }} autoComplete="off" enterKeyHint="search" />
          </div>
        )}
        {seus.length === 0 ? (
          <div className="card fcvazio fc-entra">
            <span className="fcvazio-ic" aria-hidden="true"><Icon n="note" size={26} /></span>
            <h3>Nenhum cartão ainda</h3>
            <p className="note">Toque em “Novo cartão” para escrever o primeiro: a pergunta na frente e a resposta no verso.</p>
          </div>
        ) : lista.length === 0 ? <p className="note" role="status">Nenhum cartão com “{busca}”.</p> : (
          <ul className={`fclista${entrada ? ' entrada' : ''}`}>
            {lista.slice(0, limite).map((c, i) => (
              <li key={c.id} className={`card fcrow${saindo === c.id ? ' saindo' : ''}`} style={{ '--i': Math.min(i, 9) } as CSSProperties}
                onAnimationEnd={(e) => { if (e.animationName === 'fc-sai') concluirSaida(c.id) }}>
                <button className="fcedit" onClick={() => abrir({ t: 'editor', b: id, id: c.id })} aria-label={`Editar o cartão: ${c.f.slice(0, 40)}`}>
                  <span className="fctxt"><b>{c.f}</b><span>{c.v}</span></span>
                  <span className={`fctag${classeEstado(c, agora)}`}>{rotuloEstado(c, agora)}</span>
                </button>
                <button className="fcdel" onClick={(e) => { const li = e.currentTarget.closest('li') as HTMLElement; excluir(c, li.offsetHeight, li) }} aria-label={`Excluir o cartão: ${c.f.slice(0, 40)}`}><Icon n="trash" size={20} /></button>
              </li>
            ))}
          </ul>
        )}
        {lista.length > limite && <div className="row"><button className="btn" onClick={() => setLimite((n) => n + 100)}>Mostrar mais ({lista.length - limite})</button></div>}
        <div className="sec">Excluir baralho</div>
        <div className="card">
          {!ask ? <div className="row"><button className="btn warn" onClick={() => setAsk(true)}>Excluir este baralho</button></div> : (
            <div className="fc-entra" ref={aoAparecer}>
              <p className="note" role="alert">Apaga o baralho e {plural(seus.length, 'cartão', 'cartões')}. Dá para desfazer por alguns segundos.</p>
              <div className="row"><button className="btn warn" onClick={() => { excluirBaralho(id); voltar() }}>Sim, excluir</button><button className="btn" onClick={() => setAsk(false)}>Cancelar</button></div>
            </div>
          )}
        </div>
      </div>
      <Aside className="panel tr wide-only">
        <div className="side-h"><Icon n="cards" size={18} />Neste baralho</div>
        <Hr />
        <dl className="sum">
          {([['Cartões', seus.length], ['Para hoje', k.hoje], ['Novos', seus.filter((c) => c.estado === 'novo').length], ['Aprendendo', k.aprender], ['Aprendidos', k.aprendidos], ['Maduros (≥ 21 d)', k.maduros]] as [string, number][]).map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}
        </dl>
      </Aside>
    </div>
  )
}

// ───────────────────────── Editor de cartão ─────────────────────────
/** Campo de texto que cresce com o que se digita (até 42% da altura da tela; depois rola por dentro). */
function useAutoAltura(valor: string) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => { const el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px` }, [valor])
  return ref
}

function Editor({ b, id, voltar }: { b: string; id?: string; voltar: () => void }) {
  const existente = useCards((s) => (id ? s.cartoes.find((c) => c.id === id) : undefined))
  const { adicionar, editar } = useCards.getState()
  const bid = existente?.b ?? b // o cartão é do baralho em que a pessoa está: não se escolhe outro aqui
  const [f, setF] = useState(existente?.f ?? ''), [v, setV] = useState(existente?.v ?? ''), [inverso, setInverso] = useState(false), [feitos, setFeitos] = useState(0)
  const [salvo, setSalvo] = useState(false) // “Cartão salvo” fica no subtítulo por 1,5 s (sem criar nem tirar nenhuma linha: nada na tela se desloca)
  useEffect(() => { if (!feitos) return; setSalvo(true); const t = setTimeout(() => setSalvo(false), 1500); return () => clearTimeout(t) }, [feitos])
  const frente = useAutoAltura(f), verso = useAutoAltura(v)
  const salvar = (outro: boolean) => {
    if (id) { if (editar(id, { b: bid, f, v })) voltar(); return }
    if (!adicionar(bid, f, v, inverso).length) return
    if (outro) { setF(''); setV(''); setFeitos((n) => n + 1); frente.current?.focus() } else voltar()
  }
  useEffect(() => { if (!id) frente.current?.focus({ preventScroll: true }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const perto = (t: string) => t.length > TAM_MAX * 0.8
  return (
    <div className="split edge tr fced">
      <div className="col">
        <div className="qbar"><button className="btn small-btn" onClick={voltar}><Icon n="back" size={18} />Voltar</button></div>
        <Top title={id ? 'Editar cartão' : 'Novo cartão'} sub={id ? undefined : salvo ? 'Cartão salvo. Escreva o próximo.' : feitos ? `${plural(feitos, 'cartão criado', 'cartões criados')} nesta sessão` : 'Frente e verso do cartão.'} ok={salvo} />
        <form className="card fcform" autoComplete="off" onSubmit={(e) => { e.preventDefault(); salvar(false) }}>
          <div className="field"><label htmlFor="cf">Frente (a pergunta)</label>
            <textarea id="cf" ref={frente} className="campo auto" value={f} maxLength={TAM_MAX} onChange={(e) => setF(e.target.value)} placeholder="O que você quer lembrar? Ex.: O que é a Selic?" autoComplete="off" />
            {perto(f) && <small className="fccount" aria-live="polite">{f.length}/{TAM_MAX}</small>}
          </div>
          <div className="field"><label htmlFor="cv">Verso (a resposta)</label>
            <textarea id="cv" ref={verso} className="campo auto" value={v} maxLength={TAM_MAX} onChange={(e) => setV(e.target.value)} placeholder="A resposta, como você quer ver ao virar o cartão" autoComplete="off" />
            {perto(v) && <small className="fccount" aria-live="polite">{v.length}/{TAM_MAX}</small>}
          </div>
          {!id && (
            <button type="button" className="fcswitch" role="switch" aria-checked={inverso} onClick={() => setInverso((x) => !x)}>
              <span className="fctrilho" aria-hidden="true"><i /></span>
              <span className="fcswitch-tx">Criar também o cartão inverso<small>verso → frente</small></span>
            </button>
          )}
        </form>
        <div className="foot sticky">
          {!id && <button className="btn" onClick={() => salvar(true)}>Salvar e criar outro</button>}
          <button className="btn pri" onClick={() => salvar(false)}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Estudo ─────────────────────────
/** Tamanho do texto do cartão: o maior que deixa o cartão INTEIRO (frente, verso e a linha de onde a questão veio) na tela, sem rolagem vertical.
 *  Parte do tamanho de leitura (24 px em tela larga, 22 px no celular) e encolhe até 13 px; se nem assim couber (texto enorme), a página rola.
 *  O verso fica sempre reservado no layout (invisível antes de virar), então o tamanho é o mesmo antes e depois de mostrar a resposta: nada muda ao virar. */
const FS_MIN = 13
function useTextoQueCabe(raiz: RefObject<HTMLElement | null>, dependencias: unknown[]) {
  const ajustar = useRef(() => {})
  ajustar.current = () => {
    const el = raiz.current, rolo = el?.closest<HTMLElement>('.scroll-y')
    if (!el || !rolo) return
    const max = window.innerWidth >= 600 ? 24 : 22
    // No celular a tela de estudo tem altura mínima (o cartão estica até os botões de nota): para medir o que o CONTEÚDO precisa, ela sai durante a medida.
    const cabe = (px: number) => { el.style.setProperty('--fc-fs', `${px}px`); return rolo.scrollHeight <= rolo.clientHeight + 1 }
    el.style.minHeight = '0px'
    try {
      if (cabe(max)) return
      if (!cabe(FS_MIN)) { // não cabe nem no mínimo: a página rola (último recurso). Só vale encolher se isso poupar rolagem de verdade (um cartão curto numa tela baixa não ganha nada: fica no tamanho de leitura)
        const sobraMin = rolo.scrollHeight - rolo.clientHeight
        cabe(max); const sobraMax = rolo.scrollHeight - rolo.clientHeight
        el.style.setProperty('--fc-fs', `${sobraMax - sobraMin > 16 ? FS_MIN : max}px`)
        return
      }
      let lo = FS_MIN, hi = max // maior tamanho que cabe, por bisseção (cada passo é uma medida do layout)
      while (hi - lo > 0.5) { const meio = (lo + hi) / 2; if (cabe(meio)) lo = meio; else hi = meio }
      el.style.setProperty('--fc-fs', `${lo.toFixed(1)}px`)
    } finally { el.style.minHeight = '' }
  }
  useLayoutEffect(() => { ajustar.current() }, dependencias) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // janela redimensionada, celular girado, fontes que terminaram de carregar
    const rolo = raiz.current?.closest<HTMLElement>('.scroll-y')
    let q = 0
    const de = () => { cancelAnimationFrame(q); q = requestAnimationFrame(() => ajustar.current()) }
    const ro = new ResizeObserver(de); if (rolo) ro.observe(rolo)
    window.addEventListener('resize', de); void document.fonts?.ready.then(de)
    return () => { cancelAnimationFrame(q); ro.disconnect(); window.removeEventListener('resize', de) }
  }, [raiz])
}
interface Passo { foto: Foto; fila: string[]; feitos: number; lembrados: number }
const ESTADO_ROTULO = { novo: 'Novo', aprendendo: 'Aprendendo', revisao: 'Revisão' } as const

function Estudo({ b, voltar }: { b?: string; voltar: () => void }) {
  const cartoes = useCards((s) => s.cartoes)
  const { avaliar, desfazerAvaliacao } = useCards.getState()
  const [fila, setFila] = useState<string[]>(() => { const s = useCards.getState(); return montarFila(b ? s.cartoes.filter((c) => c.b === b) : s.cartoes, s.ajustes, Date.now()) })
  const [mostrar, setMostrar] = useState(false), [feitos, setFeitos] = useState(0), [lembrados, setLembrados] = useState(0), [passos, setPassos] = useState<Passo[]>([])
  const porId = useMemo(() => new Map(cartoes.map((c) => [c.id, c])), [cartoes])
  const atual = fila.length ? porId.get(fila[0]) : undefined
  const agora = Date.now()
  const rotulos = atual ? rotulosDasNotas(atual, agora) : []
  const ultimaNota = useRef(0) // um toque duplo logo depois de avaliar não pode virar o próximo cartão sem querer
  const raiz = useRef<HTMLDivElement>(null)
  useTextoQueCabe(raiz, [atual?.id, feitos, fila.length])
  // plano de estudo: quando os cartões do plano acabam (os que ele pediu foram feitos, ou nada mais vence), a pessoa segue direto para as questões do plano
  useEffect(() => {
    const a = useAssistente.getState()
    if (!a.planoEmCurso) return
    const s = a.statusPlano()
    if (s && s.cartoesFaltam === 0) a.concluirCartoesDoPlano()
  }, [feitos])

  const nota = (n: Nota) => {
    if (!atual) return
    const foto = avaliar(atual.id, n)
    if (!foto) return
    ultimaNota.current = performance.now()
    setPassos((p) => [...p, { foto, fila, feitos, lembrados }])
    setFila((f) => (n === 0 ? [...f.slice(1), f[0]] : f.slice(1))) // "Errei" volta ao fim da fila desta sessão
    setFeitos((x) => x + 1); if (n > 0) setLembrados((x) => x + 1)
    setMostrar(false)
  }
  const revelar = () => { if (performance.now() - ultimaNota.current < 280) return; setMostrar(true) } // toque na tela
  const desfazer = () => {
    const ult = passos[passos.length - 1]
    if (!ult) return
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur() // o foco não pode ficar no botão: o espaço vira o cartão, não desfaz de novo
    desfazerAvaliacao(ult.foto); setFila(ult.fila); setFeitos(ult.feitos); setLembrados(ult.lembrados); setPassos((p) => p.slice(0, -1)); setMostrar(false)
  }
  // teclado (computador): espaço/Enter vira o cartão (e, com o verso aberto, dá "Bom"); 1–4 avaliam
  const refs = useRef({ nota, mostrar, atual }); refs.current = { nota, mostrar, atual }
  useEffect(() => {
    const aoTecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.matches('input, textarea, select, [contenteditable]') || (t.closest('button') && e.key !== '1' && e.key !== '2' && e.key !== '3' && e.key !== '4'))) return
      const { nota: avalia, mostrar: aberto, atual: c } = refs.current
      if (!c || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (aberto) avalia(2); else setMostrar(true) }
      else if (aberto && '1234'.includes(e.key) && e.key.length === 1) { e.preventDefault(); avalia((Number(e.key) - 1) as Nota) }
    }
    window.addEventListener('keydown', aoTecla)
    return () => window.removeEventListener('keydown', aoTecla)
  }, [])

  const restam = { novo: 0, aprendendo: 0, revisao: 0 }
  for (const id of fila) { const c = porId.get(id); if (c) restam[c.estado]++ }
  const total = feitos + fila.length
  if (!atual) {
    const futuros = cartoes.filter((c) => (!b || c.b === b) && c.estado === 'revisao').map((c) => c.due).sort((x, y) => x - y)
    const dias = futuros.length ? Math.round((futuros[0] - meiaNoite(agora)) / DIA) : null
    const pc = feitos ? Math.round((100 * lembrados) / feitos) : 0
    return (
      <div className="split edge tr fcfim2">
        <div className="col">
          <Top title={feitos ? 'Sessão concluída' : 'Nada para estudar agora'} sub={feitos ? `${plural(feitos, 'resposta', 'respostas')} · ${pc}% lembrados` : undefined} />
          <div className="card fcvazio fcfinal fc-pop">
            {feitos > 0 ? <Ring p={pc} label="lembrados" /> : <span className="fcvazio-ic" aria-hidden="true"><Icon n="check" size={26} /></span>}
            <h3>{feitos ? 'Bom trabalho!' : 'Está tudo em dia.'}</h3>
            <p className="note">{dias == null ? 'Quando você aprender cartões, eles voltam aqui na hora certa.' : dias <= 0 ? 'Ainda há cartões para hoje: volte ao início para estudá-los.' : `Os próximos cartões voltam ${dias === 1 ? 'amanhã' : `em ${dias} dias`}.`}</p>
            <div className="row">{passos.length > 0 && <button className="btn" onClick={desfazer}>Desfazer a última resposta</button>}<button className="btn pri" onClick={voltar}>Voltar</button></div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="fcstudy" ref={raiz}>
      <div className="qbar">
        <button className="btn small-btn" onClick={voltar}><Icon n="back" size={18} />Sair</button>
        <span className="bar" role="progressbar" aria-label="Andamento do estudo" aria-valuemin={0} aria-valuemax={total} aria-valuenow={feitos}><i style={{ width: `${Math.round((100 * feitos) / total)}%` }} /></span>
        <span className="cnt">{feitos}/{total}</span>
        <button className="btn small-btn" onClick={desfazer} disabled={!passos.length} aria-label="Desfazer a última resposta">Desfazer</button>
      </div>
      <p className="fccont" aria-label="Cartões que faltam">
        <span className={atual.estado === 'novo' ? 'on' : ''}>Novos {restam.novo}</span><span className={atual.estado === 'aprendendo' ? 'on' : ''}>Aprendendo {restam.aprendendo}</span><span className={atual.estado === 'revisao' ? 'on' : ''}>Revisar {restam.revisao}</span>
      </p>
      <div key={`${atual.id}-${feitos}`} className="card fcface fc-carta" aria-live="polite" onClick={() => { if (!mostrar) revelar() }}>
        <div className="fcface-top"><span className="lb">Frente</span><span className={`fctag${classeEstado(atual, agora)}`}>{ESTADO_ROTULO[atual.estado]}</span></div>
        <p className="fctexto">{atual.f}</p>
        <div className={`fcverso${mostrar ? ' aberto' : ''}`} aria-hidden={!mostrar}><hr className="fcdiv" /><span className="lb">Verso</span><p className="fctexto">{atual.v}</p></div>
        {!mostrar && <span className="fcdica" aria-hidden="true">Toque para ver a resposta</span>}
      </div>
      <div className="foot sticky fcnotas">
        {!mostrar ? <button className="btn pri" onClick={revelar}>Mostrar resposta<kbd className="wide-only">espaço</kbd></button> : (
          <div className="fcbotoes" role="group" aria-label="Como foi lembrar?">
            {NOTAS.map(({ n, rotulo }) => (
              <button key={n} className={`btn fcn fcn${n}`} onClick={() => nota(n)}><b>{rotulo}</b><small>{rotulos[n]}</small><kbd className="wide-only">{n + 1}</kbd></button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
