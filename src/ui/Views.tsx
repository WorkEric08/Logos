import { useEffect, useState, type CSSProperties } from 'react'
import { ALL_SUBJECTS, SOURCE_KEYS, SUBJECT, shortSource } from '../core/subjects'
import { REGRAS, SIMULADO_PLAN } from '../core/scoring'
import { baseDaProva, filterPool, opcoesQtd, qtdEfetiva, totals } from '../core/filters'
import { contar as contarCards } from '../core/cards'
import { formatarDuracao } from '../core/cronometro'
import { diaDe, diasDoMes, sequencia } from '../core/historico'
import { useCards } from '../store/cards'
import { useAba } from '../store/aba'
import { useOrdemRail } from '../store/ordemRail'
import { useConta } from '../services/sync/conta'
import { ICONES, descreverAba, type Icones } from '../core/aba'

import { BANK, TF, useApp } from '../store/app'
import { Aside, Badge, Hr, Icon, Ring, Top } from './bits'
import { Provas } from './Provas'
import type { ProgressMap, Subject } from '../core/types'

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0)
const accTxt = (a: number | null) => (a == null ? '–' : `${a}%`)
const pts = (n: number) => String(n).replace('.', ',')
const f1 = (n: number) => n.toFixed(1).replace('.', ',')

/** Cartão de matéria (Início no monitor, Desempenho no celular): % de acerto, vistas e para rever, e o peso na prova. Tocar abre o Treinar já filtrado por ela. */
function CartaoMateria({ m, prog }: { m: Subject; prog: ProgressMap }) {
  const { setMatFilter, setTab } = useApp.getState()
  const l = BANK.filter((q) => q.m === m.n), t = totals(l, prog)
  return (
    <button className="folder" onClick={() => { setMatFilter(m.n); setTab('treinar') }}>
      <span className="ftop"><Badge m={m.n} /><span className="fpc">{accTxt(t.acc)}<small>acerto</small></span></span>
      <span className="fnm">{m.s}</span>
      <span className="fsub">
        <span>{t.seen}/{l.length} vistas{t.wrong ? ` · ${t.wrong} para rever` : ''}</span>
        <span>{m.ed === false ? 'Fora do edital do BB' : `Na prova: ${m.q} questões · ${pts(m.q * m.pt)} pts`}</span>
      </span>
      <span className="bar" aria-hidden="true"><i className={t.acc != null && t.acc >= 70 ? 'ok' : ''} style={{ width: `${t.acc ?? 0}%` }} /></span>
    </button>
  )
}

export function Inicio() {
  const prog = useApp((s) => s.prog)
  const { startByWeight, startSimulado, startErrors, setMatFilter, setFilter, setTab } = useApp.getState()
  const T = totals(BANK, prog)
  const cartoes = useCards((s) => s.cartoes), ajustesCards = useCards((s) => s.ajustes)
  const CC = contarCards(cartoes, ajustesCards, Date.now())
  const abrirProva = (s: string) => { setMatFilter(''); setFilter('status', ''); setFilter('ano', s); setTab('treinar') } // abre a prova inteira: sem matéria nem situação sobrando de antes
  return (
    <>
      <div className="split ini">
        <div className="col">
          <Top title="Início" />
          <div className="tiles late narrow-only">
            <button className="tile" onClick={startByWeight}><Icon n="train" /><b>Treino rápido</b><span>10 questões, mais das matérias que mais caem</span></button>
            <button className="tile" onClick={() => setTab('cartoes')}><Icon n="cards" /><b>Cards de hoje</b><span>{CC.total === 0 ? 'Crie seu primeiro baralho' : CC.hoje ? `${CC.hoje} para estudar` : 'Tudo em dia hoje'}</span></button>
            <button className="tile" onClick={startSimulado}><Icon n="clock" /><b>Simulado de {SIMULADO_PLAN.reduce((a, [, n]) => a + n, 0)}</b><span>{REGRAS ? 'Prova completa, com nota e regras do edital' : 'Questões de todas as matérias, na proporção do espaço'}</span></button>
            <button className="tile" onClick={startErrors} disabled={!T.wrong}><Icon n="repeat" /><b>Rever erros ({T.wrong})</b><span>{T.wrong ? 'Só o que você errou por último' : 'Nenhum erro ainda'}</span></button>
          </div>
          <Provas aoAbrir={abrirProva} />
          <div className="late wide-only">{/* monitor: as matérias moram aqui, abaixo das pastas dos bancos; no celular continuam no Desempenho */}
            <div className="sec">Por matéria</div>
            <div className="folders">
              {ALL_SUBJECTS.map((m) => <CartaoMateria key={m.n} m={m} prog={prog} />)}
            </div>
          </div>
        </div>
        <Aside className="panel first">
          <div className="side-h wide-only"><Icon n="chart" size={18} />Seu progresso</div>
          <Hr className="wide-only" />
          <div className="stats narrow-only">
            <div className="stat"><b>{T.seen}</b><span>de {BANK.length} questões vistas</span></div>
            <div className="stat"><b>{accTxt(T.acc)}</b><span>de acerto</span></div>
            <div className="stat"><b>{T.wrong}</b><span>para rever</span></div>
          </div>
          <div className="wide-only prog">
            <div className="preview"><Ring p={pct(T.seen, BANK.length)} label="vistas" /></div>
            <Hr />
            <h3 className="ptitle">{T.seen} de {BANK.length} questões vistas</h3>
            <p className="pmeta">Acerto {accTxt(T.acc)} · {T.wrong} para rever</p>
            <div className="plabel">Acerto por matéria</div>
            <ul className="plist">
              {ALL_SUBJECTS.map((m) => <li key={m.n}><Badge m={m.n} /><span>{m.s}</span><span className="num">{accTxt(totals(BANK.filter((q) => q.m === m.n), prog).acc)}</span></li>)}
            </ul>
            <Hr />
            <div className="acts">
              <button className="act" onClick={startByWeight}><span className="actic"><Icon n="train" size={18} /></span>Treino</button>
              <button className="act" onClick={startSimulado}><span className="actic"><Icon n="clock" size={18} /></span>Simulado</button>
              <button className="act" onClick={startErrors} disabled={!T.wrong}><span className="actic"><Icon n="repeat" size={18} /></span>Erros</button>
              <button className="act" onClick={() => setTab('cartoes')}><span className="actic"><Icon n="cards" size={18} /></span>Cards</button>
            </div>
            <Hr />
          </div>
        </Aside>
      </div>
    </>
  )
}

const STATUS: Record<string, string> = { '': 'Todas', novas: 'Ainda não vistas', erros: 'Errei por último', marcadas: 'Marcadas' }
const ORDEM: Record<string, string> = { peso: 'Por peso', aleatoria: 'Aleatória', prova: 'Ordem da prova' }

export function Treinar() {
  const prog = useApp((s) => s.prog)
  const f = useApp((s) => s.filters)
  const marks = useApp((s) => s.marks)
  const { setFilter, setMatFilter, startFromFilters } = useApp.getState()
  const pool = filterPool(BANK, f, prog, marks)
  // Os filtros se adaptam à prova escolhida: matérias, temas, contagens e quantidades vêm só das questões dela (sem prova: do banco todo).
  const base = baseDaProva(BANK, f.ano)
  const semSituacao = filterPool(BANK, { ...f, status: '' }, prog, marks)
  const nNovas = semSituacao.filter((q) => !prog[q.id]?.n).length, nErros = semSituacao.filter((q) => prog[q.id]?.ok === false).length, nMarc = semSituacao.filter((q) => marks[q.id]?.r).length
  const materias = ALL_SUBJECTS.map((m) => ({ m, c: base.filter((q) => q.m === m.n).length })).filter((x) => x.c > 0)
  const opQtd = opcoesQtd(pool.length), qtdSel = qtdEfetiva(f.qtd, pool.length)
  const n = qtdSel === 0 ? pool.length : qtdSel
  const temas: Record<string, number> = {}
  base.filter((q) => !f.mat || q.m === f.mat).forEach((q) => { temas[q.t] = (temas[q.t] ?? 0) + 1 })
  const Chip = ({ on, label, extra, run }: { on: boolean; label: string; extra?: number; run: () => void }) => (
    <button className="chip" aria-pressed={on} onClick={run}>{label}{extra != null && <small>{extra}</small>}</button>
  )
  const resumo: [string, string][] = [
    ['Matéria', f.mat ? SUBJECT[f.mat].s : 'Todas'], ['Tema', f.tema || 'Todos'],
    ['Prova', f.ano ? shortSource(f.ano) : 'Todas'], ['Situação', STATUS[f.status]],
    ['Quantidade', qtdSel ? String(qtdSel) : `Todas (${pool.length})`], ['Ordem', ORDEM[f.ordem]],
  ]
  return (
    <>
      <div className="split edge tr">
        <div className="col">
          <Top title="Treinar" sub={`${pool.length} questões nos filtros`} />
          <div className="card filters">
            <div className="field"><span className="lb">Matéria</span><div className="chips">
              <Chip on={!f.mat} label="Todas" run={() => setMatFilter('')} />
              {materias.map(({ m, c }) => <Chip key={m.n} on={f.mat === m.n} label={m.s} extra={c} run={() => setMatFilter(m.n)} />)}
            </div></div>
            <Hr />
            <div className="field"><span className="lb">Tema</span>{!f.mat && <p className="note nohint">Escolha uma matéria acima para filtrar também por tema.</p>}<div className="chips">
              {f.mat && <Chip on={!f.tema} label="Todos" run={() => setFilter('tema', '')} />}
              {f.mat && Object.entries(temas).sort((a, b) => (TF[`${f.mat}|${b[0]}`] ?? 0) - (TF[`${f.mat}|${a[0]}`] ?? 0))
                .map(([t, c]) => <Chip key={t} on={f.tema === t} label={t} extra={c} run={() => setFilter('tema', t)} />)}
            </div></div>
            <Hr />
            <div className="fbottom">
              <div className="field"><span className="lb">Prova</span><div className="chips">
                <Chip on={!f.ano} label="Todas" run={() => setFilter('ano', '')} />
                {SOURCE_KEYS.map((s) => <Chip key={s} on={f.ano === s} label={shortSource(s)} extra={BANK.filter((q) => q.s === s).length} run={() => setFilter('ano', s)} />)}
              </div></div>
              <div className="fctl">
                <div className="field"><span className="lb">Situação</span><div className="chips">
                  <Chip on={!f.status} label="Todas" run={() => setFilter('status', '')} />
                  <Chip on={f.status === 'novas'} label="Ainda não vistas" extra={nNovas} run={() => setFilter('status', 'novas')} />
                  <Chip on={f.status === 'erros'} label="Errei por último" extra={nErros} run={() => setFilter('status', 'erros')} />
                  <Chip on={f.status === 'marcadas'} label="Marcadas" extra={nMarc} run={() => setFilter('status', 'marcadas')} />
                </div></div>
                <div className="field"><span className="lb">Quantidade</span><div className="chips c4 qtd" style={{ '--cols-larga': opQtd.length > 1 ? `repeat(${opQtd.length - 1}, minmax(0, 1fr)) minmax(0, 1.5fr)` : 'minmax(0, 1fr)', '--cols-estreita': `repeat(${opQtd.length <= 4 ? opQtd.length : 3}, minmax(0, 1fr))` } as CSSProperties}>
                  {opQtd.map((v) => <Chip key={v} on={qtdSel === v} label={v ? String(v) : 'Todas'} extra={v ? undefined : pool.length} run={() => setFilter('qtd', v)} />)}
                </div></div>
                <div className="field"><span className="lb">Ordem</span><div className="chips c3">
                  <Chip on={f.ordem === 'peso'} label="Por peso" run={() => setFilter('ordem', 'peso')} />
                  <Chip on={f.ordem === 'aleatoria'} label="Aleatória" run={() => setFilter('ordem', 'aleatoria')} />
                  <Chip on={f.ordem === 'prova'} label="Ordem da prova" run={() => setFilter('ordem', 'prova')} />
                </div></div>
              </div>
            </div>
          </div>
        </div>
        <Aside className="go panel tr">
          <div className="side-h wide-only"><Icon n="doc" size={18} />Resumo do treino</div>
          <Hr className="wide-only" />
          <dl className="sum wide-only">{resumo.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          <Hr className="wide-only" />
          <p className="count wide-only"><b>{n}</b>{n === 1 ? 'questão' : 'questões'} neste treino</p>
          <button className="btn pri" onClick={startFromFilters} disabled={!n}>Começar · {n} questões</button>
        </Aside>
      </div>
    </>
  )
}

const ddmm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`

export function Desempenho() {
  const prog = useApp((s) => s.prog)
  const hist = useApp((s) => s.hist)
  const [sel, setSel] = useState<number | null>(null) // barra tocada/sob o mouse: o texto do dia aparece acima do gráfico
  const { startErrors } = useApp.getState()
  const T = totals(BANK, prog)
  const grupos: Record<string, typeof BANK> = {}
  BANK.forEach((q) => { (grupos[`${q.m}|${q.t}`] ??= []).push(q) })
  const top = Object.entries(grupos).sort((a, b) => (TF[b[0]] ?? 0) - (TF[a[0]] ?? 0)).slice(0, 16)
  const porMat = ALL_SUBJECTS.map((m) => ({ m, t: totals(BANK.filter((q) => q.m === m.n), prog) })).filter((x) => x.t.acc != null)
    .sort((a, b) => (b.t.acc ?? 0) - (a.t.acc ?? 0))
  const agora = Date.now()
  const dias = diasDoMes(hist, agora), diaHoje = diaDe(agora), hoje = dias.find((d) => d.dia === diaHoje) ?? dias[0], seq = sequencia(hist, agora) // o gráfico cobre o mês atual inteiro (dia 1 ao último)
  const tMes = dias.reduce((a, d) => ({ n: a.n + d.n, c: a.c + d.c }), { n: 0, c: 0 }), maxDia = Math.max(1, ...dias.map((d) => d.n))
  const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(agora))
  const dica = (d: { dia: string; n: number; c: number }) => `${ddmm(d.dia)}: ${d.n} ${d.n === 1 ? 'resposta' : 'respostas'}${d.n ? `, ${d.c} ${d.c === 1 ? 'certa' : 'certas'} (${pct(d.c, d.n)}%)` : ''}`
  // A faixa inteira do gráfico é o alvo de toque (cada barra tem 14–28 px): o dedo escolhe a barra mais perto na horizontal e pode arrastar.
  const escolheBarra = (e: React.PointerEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); setSel(Math.min(dias.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * dias.length)))) }
  const sims = hist.sims, ultimos = sims.slice(-6).reverse()
  const resumo: [string, string][] = [
    ['Hoje', `${hoje.n} ${hoje.n === 1 ? 'resposta' : 'respostas'}`], ['Sequência', `${seq} ${seq === 1 ? 'dia' : 'dias'}`],
    ['Respostas dadas', String(T.n)], ['Acertos', String(T.c)], ['Questões vistas', `${T.seen} de ${BANK.length}`], ['Para rever', String(T.wrong)],
    ['Mais forte', porMat.length > 1 ? SUBJECT[porMat[0].m.n].s : '–'], ['Mais fraca', porMat.length > 1 ? SUBJECT[porMat[porMat.length - 1].m.n].s : '–'],
  ]
  const tabela = (linhas: typeof top, cls: string) => (
    <div className={`card tbl scroll ${cls}`}><table><thead><tr><th>Tema</th><th className="n">Caiu</th><th className="n">Seu acerto</th></tr></thead><tbody>
      {linhas.map(([k, l]) => { const [m, t] = k.split('|'), tt = totals(l, prog)
        return <tr key={k}><td>{t}<div className="muted small">{SUBJECT[m]?.s ?? m}</div></td><td className="n">{l.length}×</td><td className="n">{accTxt(tt.acc)}</td></tr> })}
    </tbody></table></div>
  )
  return (
    <>
      <div className="split edge tr">
        <div className="col">
          <Top title="Desempenho" sub="só o que você respondeu aqui" />
          <div className="stats narrow-only">
            <div className="stat"><b>{T.seen}</b><span>de {BANK.length} questões vistas</span></div>
            <div className="stat"><b>{accTxt(T.acc)}</b><span>de acerto</span></div>
            <div className="stat"><b>{T.wrong}</b><span>para rever</span></div>
          </div>
          <div className="narrow-only">{/* em tela larga estes cartões ficam no Início */}
            <div className="sec first">Por matéria</div>
            <div className="folders">
              {ALL_SUBJECTS.map((m) => <CartaoMateria key={m.n} m={m} prog={prog} />)}
            </div>
          </div>
          <div className="sec first">Evolução</div>
          <div className="evo">
            <div className="card">
              <h3>{nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}</h3>
              <p className="note" aria-live="polite">{sel != null ? dica(dias[sel]) : tMes.n ? `${tMes.n} respostas no mês · acerto ${pct(tMes.c, tMes.n)}%` : 'Responda questões para ver sua evolução aqui.'}</p>
              <div className="bars" role="group" aria-label="Respostas por dia, mês atual" onPointerDown={escolheBarra} onPointerMove={escolheBarra} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setSel(null) }}>
                {dias.map((d, i) => {
                  const dd = i + 1, tip = dica(d)
                  return (
                    <div key={d.dia} className={`bcol${d.dia === diaHoje ? ' hoje' : ''}${d.dia > diaHoje ? ' futuro' : ''}`} style={{ '--i': i } as CSSProperties} title={tip} aria-label={tip} tabIndex={0} onFocus={() => setSel(i)} onBlur={() => setSel(null)}>
                      <span className="btrack"><span className="bstack" style={{ height: `${(100 * d.n) / maxDia}%` }}>
                        <i className="berr" style={{ flexGrow: d.n - d.c }} /><i className="bok" style={{ flexGrow: d.c }} />
                      </span></span>
                      <span className={`blb${dd === 1 || dd % 5 === 0 ? '' : ' raro'}`}>{dd}</span>
                    </div>
                  )
                })}
              </div>
              <p className="legend"><span><i className="sw ok" />Certas</span><span><i className="sw err" />Erradas</span><span className="muted">Toque ou passe o mouse numa barra para ver o dia. Os dias que ainda não chegaram ficam vazios.</span></p>
              <table className="sr-only"><caption>Respostas por dia</caption><thead><tr><th>Dia</th><th>Respostas</th><th>Certas</th></tr></thead><tbody>
                {dias.map((d) => <tr key={d.dia}><td>{ddmm(d.dia)}</td><td>{d.n}</td><td>{d.c}</td></tr>)}
              </tbody></table>
            </div>
            <div className="card">
              <h3>Simulados</h3>
              {sims.length ? (
                <>
                  <p className="note">{sims.length} {sims.length === 1 ? 'entregue' : 'entregues'} · melhor nota {f1(Math.max(...sims.map((x) => x.p)))} · passou em {sims.filter((x) => x.ok).length}</p>
                  <ul className="simlist">
                    {ultimos.map((x) => (
                      <li key={x.t}>
                        <span className="num">{ddmm(diaDe(x.t))}</span>
                        <span className="sbar" role="img" aria-label={`Nota ${x.p.toFixed(1)} de 100; mínimo 50`}><i style={{ width: `${Math.min(100, x.p)}%` }} /><u /></span>
                        <b className="num">{f1(x.p)}</b>
                        <span className="tag">{x.ok ? 'Passou' : 'Não passou'}</span>
                        {x.d !== undefined && <span className="dur">Tempo: {formatarDuracao(x.d)}</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="note">A linha marca o mínimo de 50 pontos. Mostra os {ultimos.length} mais recentes.</p>
                </>
              ) : <p className="note">Nenhum simulado entregue ainda. Faça um pelo Início: a nota de cada um fica guardada aqui.</p>}
            </div>
          </div>
          <div className="sec">Temas que mais caíram</div>
          <div className="tbls">{tabela(top.slice(0, 8), 't1')}{tabela(top.slice(8), 't2')}</div>
          <p className="note">“Caiu” conta as questões do banco com o tema. As provas de 2018 valem metade e as de 2010 a 2015 valem um quarto, porque o edital era outro.</p>
        </div>
        <Aside className="panel tr wide-only">
          <div className="side-h wide-only"><Icon n="chart" size={18} />Resumo geral</div>
          <Hr className="wide-only" />
          <div className="wide-only">
            <div className="preview"><Ring p={T.acc ?? 0} label="de acerto" /></div>
            <Hr />
            <dl className="sum">{resumo.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            <Hr />
            <button className="btn pri go-btn" onClick={startErrors} disabled={!T.wrong}>Rever erros · {T.wrong}</button>
          </div>
        </Aside>
      </div>
    </>
  )
}

/** Conta Google e sincronização: entrar é opcional (o app funciona igual sem conta e sem internet). */
function Conta() {
  const { estado, usuario, sync, detalhe, ocupado, erro, entrar, sair } = useConta()
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  const situacao = sync === 'erro' ? `Não sincronizou agora (${detalhe || 'erro'}). O app segue funcionando; tente de novo mais tarde.`
    : !online ? 'Sem internet: o que você fizer fica guardado aqui e sobe quando voltar.'
    : sync === 'ok' ? 'Sincronizado.' : 'Sincronizando…'
  return (
    <div className="card conta"><h3>Conta e sincronização</h3>
      {estado === 'dentro' && usuario ? (
        <>
          <p className="note" data-testid="conta-email">Conectado como <b>{usuario.email}</b>{usuario.nome ? ` (${usuario.nome})` : ''}.</p>
          <p className="note" role="status" data-testid="conta-situacao">{situacao}</p>
          <p className="note">Progresso, histórico, cartões, marcações e anotações ficam iguais no celular e no computador. Sair da conta não apaga nada deste aparelho.</p>
          <div className="row" style={{ marginTop: 10 }}><button className="btn" disabled={ocupado} onClick={() => void sair()}>Sair da conta</button></div>
        </>
      ) : (
        <>
          <p className="note">Entre com a conta Google para manter o progresso, os cartões e as marcações iguais no celular e no computador. Sem conta, tudo continua funcionando só neste aparelho.</p>
          <div className="row" style={{ marginTop: 10 }}><button className="btn pri" disabled={ocupado || estado === 'iniciando'} onClick={() => void entrar()}>{ocupado ? 'Entrando…' : 'Entrar com Google'}</button></div>
        </>
      )}
      {erro && <p className="note" role="alert" data-testid="conta-erro" style={{ color: 'var(--err)' }}>{erro}</p>}
    </div>
  )
}

export function Mais() {
  const aba = useAba()
  const tema = useApp((s) => s.tema)
  const { setTema, resetAll } = useApp.getState()
  const [ask, setAsk] = useState(false)
  return (
    <>
      <div className="split edge tr">
        <div className="col">
          <Top title="Mais" sub="conta, aparência, barra de navegação e sobre o banco" />
          <div className="mgrid">
            <Conta />
            <div className="card"><h3>Aparência</h3>
              <div className="seg" role="group" aria-label="Tema">
                {[['auto', 'Do aparelho'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, l]) =>
                  <button key={v} aria-pressed={tema === v} onClick={() => setTema(v)}>{l}</button>)}
              </div>
            </div>
            <div className="card so-celular"><h3>Aba da barra de navegação</h3>
              <p className="note">No celular, segure a aba por meio segundo e arraste para mudar de lado ou de altura. Segurar um ícone e arrastar muda a ordem dos ícones. Ou escolha aqui.</p>
              <div className="field"><span className="lb">Lado</span>
                <div className="chips" role="group" aria-label="Lado da aba">
                  {([['esq', 'Esquerda'], ['dir', 'Direita']] as const).map(([v, r]) => <button key={v} className="chip" aria-pressed={aba.lado === v} onClick={() => aba.mover(v, aba.pos)}>{r}</button>)}
                </div>
              </div>
              <div className="field"><span className="lb">Altura</span>
                <div className="chips" role="group" aria-label="Altura da aba">
                  {([[0, 'Em cima'], [0.5, 'No meio'], [1, 'Embaixo']] as const).map(([v, r]) => <button key={v} className="chip" aria-pressed={Math.abs(aba.pos - v) < 0.06} onClick={() => aba.mover(aba.lado, v)}>{r}</button>)}
                </div>
              </div>
              <div className="field"><span className="lb">Ícones na barra</span>
                <div className="chips c3" role="group" aria-label="Onde ficam os ícones na barra">
                  {(Object.keys(ICONES) as Icones[]).map((v) => <button key={v} className="chip" aria-pressed={aba.icones === v} onClick={() => aba.definirIcones(v)}>{ICONES[v]}</button>)}
                </div>
              </div>
              <p className="note" role="status">Agora: aba {descreverAba(aba)}; ícones {ICONES[aba.icones].toLowerCase()}.</p>
              <div className="row"><button className="btn" onClick={() => { aba.reiniciar(); useOrdemRail.getState().reiniciar() }}>Voltar ao padrão</button></div>
            </div>
            <div className="card"><h3>Zerar progresso</h3>
              {!ask ? <div className="row" style={{ marginTop: 10 }}><button className="btn warn" onClick={() => setAsk(true)}>Zerar tudo</button></div> : (
                <>
                  <p className="note" role="alert">Apaga o progresso (acertos e erros) e a evolução por dia e por simulado. Suas marcações, anotações e flashcards ficam. Dá para desfazer por alguns segundos.</p>
                  <div className="row" style={{ marginTop: 10 }}><button className="btn warn" onClick={() => { setAsk(false); void resetAll() }}>Sim, zerar</button><button className="btn" onClick={() => setAsk(false)}>Cancelar</button></div>
                </>
              )}
            </div>
            <div className="card about span"><h3>Sobre este banco</h3>
              <div className="nt">
                <p className="note">{BANK.length} questões de {SOURCE_KEYS.length} provas da Cesgranrio (BB, Caixa, BNB, Banco da Amazônia e Banese), de 2010 a 2025. O gabarito é o do caderno 1 de cada prova; as questões anuladas ficaram de fora.</p>
                <p className="note">Provas do BB de 2010 a 2015 seguem o edital antigo: aparecem como “prova antiga” e entram menos no treino por peso. Estatística, Ética, Legislação e Conhecimentos Digitais não fazem parte do edital do BB: treinam, mas pesam menos no sorteio e não entram no simulado. Provas marcadas (TI) são de cargos de tecnologia; só entraram as questões úteis ao Agente Comercial.</p>
                <p className="note">O texto foi extraído dos PDFs por programa e os temas foram atribuídos por palavra-chave, então podem errar. Quando a questão tem imagem, ela vale mais que o texto (fórmulas, tabelas e figuras se perdem na extração).</p>
                <p className="note">O BB encerrou o contrato com a Cesgranrio em dezembro de 2025 e a nova banca ainda não foi definida. A estrutura da prova é definida pelo BB, então treinar pelo estilo de 2021 e 2023 segue valendo.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
