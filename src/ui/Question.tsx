import { useEffect, useState, type CSSProperties } from 'react'
import { sentidoDaQuestao } from '../core/movimento'
import { createPortal } from 'react-dom'
import { ALL_SUBJECTS, SOURCES, SUBJECT } from '../core/subjects'
import { AVISOS } from '../core/avisos'
import { scoreSimulado } from '../core/scoring'
import { formatarDuracao } from '../core/cronometro'
import { BASES, BY_ID, useApp } from '../store/app'
import { useCards } from '../store/cards'
import type { Question } from '../core/types'
import { Aside, Hr, Icon, Top, useWide } from './bits'
import { ehNativo } from '../services/native'
import { useBackLayer } from './useBackLayer'

const ZOOMS = [1, 1.5, 2, 3]
/** Imagem em tela cheia, com zoom por botões e rolagem (no APK, onde "abrir em outra aba" não existe). Voltar fecha só ela. */
function Ampliador({ src, titulo, onFechar }: { src: string; titulo: string; onFechar: () => void }) {
  useBackLayer(true, onFechar)
  const [z, setZ] = useState(0)
  return createPortal(
    <div className="ampliador" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="ampliador-barra">
        <button className="btn small-btn" onClick={onFechar}><Icon n="back" size={18} />Fechar</button>
        <span className="ampliador-zoom">
          <button className="btn small-btn" onClick={() => setZ((i) => Math.max(0, i - 1))} disabled={z === 0} aria-label="Diminuir o zoom">−</button>
          <span className="num" aria-live="polite">{Math.round(ZOOMS[z] * 100)}%</span>
          <button className="btn small-btn" onClick={() => setZ((i) => Math.min(ZOOMS.length - 1, i + 1))} disabled={z === ZOOMS.length - 1} aria-label="Aumentar o zoom">+</button>
        </span>
      </div>
      <div className="ampliador-rolo"><img src={src} alt={titulo} style={{ width: `${ZOOMS[z] * 100}%` }} /></div>
    </div>,
    document.body,
  )
}

/** Imagem original da questão; toque abre em tamanho real (no navegador, outra aba; no APK, a tela cheia acima). */
function ImagemQuestao({ q }: { q: Question }) {
  const src = `q/${q.img}`
  const [falhou, setFalhou] = useState(false)
  const [ampliada, setAmpliada] = useState(false)
  useEffect(() => setFalhou(false), [src])
  // Sem rede e sem a imagem guardada (ainda não vista): mensagem clara em vez de imagem quebrada.
  if (falhou) {
    return (
      <div className="warnbox" role="status">
        Não consegui carregar a imagem desta questão. Sem internet, ela só abre se já tiver sido vista antes neste aparelho: conecte-se uma vez para guardá-la.
        <div className="row" style={{ marginTop: 8 }}><button className="btn small-btn" onClick={() => setFalhou(false)}>Tentar de novo</button></div>
      </div>
    )
  }
  return (
    <figure className="qfig">
      <a href={src} target="_blank" rel="noopener" aria-label={`Abrir a imagem da questão ${q.n} em tamanho real`} onClick={(e) => { if (ehNativo()) { e.preventDefault(); setAmpliada(true) } }}>
        <img className="qimg" src={src} alt={`Imagem original da questão ${q.n}`} decoding="async" onError={() => setFalhou(true)} />
      </a>
      {q.ig ? <figcaption className="note">Imagem de página inteira: toque para ampliar. A questão {q.n} está nela.</figcaption> : null}
      {ampliada && <Ampliador src={src} titulo={`Imagem da questão ${q.n}`} onFechar={() => setAmpliada(false)} />}
    </figure>
  )
}

/** Página inteira da prova com a legenda embaixo; tocar amplia (no navegador abre a imagem em outra aba; no APK, a tela cheia com zoom). */
function PaginaProva({ src, alt, legenda }: { src: string; alt: string; legenda: string }) {
  const [ampliada, setAmpliada] = useState(false)
  return (
    <figure className="pg">
      <a href={src} target="_blank" rel="noopener" aria-label={`Abrir em tamanho real: ${alt}`} onClick={(e) => { if (ehNativo()) { e.preventDefault(); setAmpliada(true) } }}>
        <img src={src} alt={alt} loading="lazy" decoding="async" />
      </a>
      <figcaption className="note">{legenda}</figcaption>
      {ampliada && <Ampliador src={src} titulo={alt} onFechar={() => setAmpliada(false)} />}
    </figure>
  )
}

/** Texto do flashcard feito a partir de uma questão: a pergunta (com as alternativas, se couberem) e o gabarito. */
function textoDoCartao(q: Question, soImg: boolean, nota?: string): { f: string; v: string } {
  const prova = SOURCES[q.s] ?? q.s, mat = SUBJECT[q.m]?.s ?? q.m
  const minha = nota?.trim() ? `\n\nMinha anotação: ${nota.trim()}` : ''
  if (soImg) return { f: `Questão ${q.n} · ${prova} (${mat}, ${q.t}). O enunciado está numa imagem: abra a questão no Treinar para ver.`, v: `Gabarito: ${q.g}${minha}` }
  const alts = (['A', 'B', 'C', 'D', 'E'] as const).map((l) => `${l}) ${q.o[l]}`).join('\n')
  const completa = `${q.e}\n\n${alts}`
  return {
    f: completa.length <= 2000 ? completa : q.e.slice(0, 1990),
    v: `Gabarito: ${q.g}) ${q.o[q.g]}\n\n${q.a ? `Assunto: ${q.a}` : `Tema: ${q.t}`} · ${prova}, questão ${q.n}${minha}`,
  }
}
function criarCartao(q: Question, soImg: boolean, nota?: string) {
  const r = useCards.getState().daQuestao(q, textoDoCartao(q, soImg, nota))
  useApp.getState().showToast(r === 'criado' ? AVISOS.flashcardCriado : AVISOS.flashcardExiste)
}

const pad = (n: number) => String(n).padStart(2, '0')
const f1 = (v: number) => v.toFixed(1).replace('.', ',')

export function Questao() {
  const s = useApp((st) => st.session)!
  const prog = useApp((st) => st.prog)
  const mk = useApp((st) => st.marks[s.ids[s.i]])
  const { answer, go, finish, backToResult, sair, toggleMark, setNote, flushMarks } = useApp.getState()
  const q = BY_ID[s.ids[s.i]], n = s.ids.length, a = s.ans[q.id]
  const reveal = !s.sim || s.done || s.review
  const wide = useWide()
  // a questão seguinte entra pela direita e a anterior pela esquerda (o pé com Anterior/Próxima não se mexe); decidido em estado para não cortar a animação num re-render
  const [mq, setMq] = useState<{ i: number; dir: 'avanca' | 'recua' | null }>({ i: s.i, dir: null })
  if (mq.i !== s.i) setMq({ i: s.i, dir: sentidoDaQuestao(mq.i, s.i) })
  const url = (p: number) => `pages/p${q.ps ?? q.s}-${pad(p)}.jpg`
  const imgUrl = q.img ? `q/${q.img}` : null
  // Sem texto confiável (alternativas ou fórmulas perdidas na extração): vale a imagem e as alternativas viram só as letras.
  const soImg = !!q.ia || !!q.rv?.includes('texto_pode_ter_perdido_formulas__usar_imagem')
  const seen = prog[q.id]?.n ?? 0
  const hasBp = !!q.bp && q.bp !== q.p
  return (
    <>
      <div className="split q">
        <div className="col">
      <div className="qbar">
        <button className="btn small-btn" onClick={sair}><Icon n="back" size={18} />Sair</button>
        <span className="bar" role="progressbar" aria-label="Andamento" aria-valuemin={0} aria-valuemax={n} aria-valuenow={s.i + (a ? 1 : 0)}>
          <i style={{ width: `${Math.round((100 * (s.i + (a ? 1 : 0))) / n)}%` }} />
        </span>
        <span className="cnt">{s.i + 1}/{n}</span>
        <button className="btn small-btn marcar" aria-pressed={!!mk?.r} aria-label={mk?.r ? 'Tirar a marca de revisar' : 'Marcar para revisar depois'} onClick={() => toggleMark(q.id)}>
          <Icon n="flag" size={18} /><span>{mk?.r ? 'Marcada' : 'Marcar'}</span>
        </button>
      </div>
          <div className={`sheet${mq.dir ? ` q-${mq.dir}` : ''}`} key={q.id}>
            <div className="meta">
              <span className="tag m">{SUBJECT[q.m]?.s ?? q.m}</span><span className="tag">{q.t}</span>
              {!(s.sim && !s.done) && <><span className="tag">{SOURCES[q.s]} · questão {q.n}</span>{q.ol ? <span className="tag">prova antiga</span> : null}{q.ant ? <span className="tag">gabarito não conferido</span> : null}</>}
            </div>
            {q.f && !imgUrl ? <div className="warnbox">Esta questão pode ter tabela ou figura que não veio no texto. Confira na prova abaixo.</div> : null}
            {imgUrl && !wide && <ImagemQuestao q={q} />}
            {q.b && BASES[q.b] && (
              <details className="base" open={q.m === 'Língua Inglesa' || q.m === 'Língua Portuguesa'}>
                <summary>Texto da questão</summary><div className="txt">{BASES[q.b]}</div>
              </details>
            )}
            {!soImg && <p className="enun">{q.e}</p>}
            <ul className={`alts${soImg ? ' letras' : ''}`}>
              {(Object.entries(q.o) as [keyof typeof q.o, string][]).map(([l, t]) => {
                const cls = reveal && a ? (l === q.g ? 'ok' : l === a ? 'err' : 'dim') : ''
                return (
                  <li key={l}><button className={`alt ${cls}`} aria-pressed={a === l} disabled={reveal && !!a} onClick={() => answer(l)}>
                    <span className="bub">{l}</span>{soImg ? <span className="sr-only">Alternativa {l}</span> : <span className="tx">{t}</span>}
                    {cls === 'ok' && <><span className="mk"><Icon n="check" size={22} /></span><span className="sr-only">Alternativa correta</span></>}
                    {cls === 'err' && <><span className="mk"><Icon n="x" size={22} /></span><span className="sr-only">Sua resposta, errada</span></>}
                  </button></li>
                )
              })}
            </ul>
            {reveal && a && (
              <div className={`fb ${a === q.g ? 'ok' : 'err'}`} role="status">
                <b className="v">{a === q.g ? 'Certo.' : 'Errou.'} Gabarito: {q.g}</b>
                <p>{q.a ? `Assunto: ${q.a}` : `Tema: ${q.t}`}{seen > 1 ? ` · você já viu ${seen}×` : ''}</p>
              </div>
            )}
            {reveal && a && <button className="btn small-btn criarcard" onClick={() => criarCartao(q, soImg, mk?.a)}><Icon n="cards" size={18} />Criar flashcard desta questão</button>}
            <details className="nota" key={q.id} open={!!mk?.a}>
              <summary><Icon n="note" size={16} />Anotação{mk?.a ? ' · salva' : ''}</summary>
              <textarea value={mk?.a ?? ''} maxLength={2000} placeholder="Um lembrete para você sobre esta questão" aria-label="Anotação da questão" autoComplete="off" autoCapitalize="sentences"
                onChange={(e) => setNote(q.id, e.target.value)} onBlur={flushMarks} />
            </details>
          </div>
        </div>
        {(hasBp || q.p || (wide && imgUrl)) && (
          <Aside className="pgside">
            <div className="side-h wide-only"><Icon n="doc" size={18} />{imgUrl ? 'Questão original' : 'Página da prova'}</div>
            <Hr className="wide-only" />
            {wide && imgUrl && <ImagemQuestao key={q.id} q={q} />}
            {/* A página INTEIRA da prova aparece sozinha, sempre, com a legenda embaixo: é como no dia da prova. */}
            {(hasBp || q.p) && <div className="sec narrow-only">Página da prova</div>}
            {hasBp && (
              <PaginaProva key={url(q.bp!)} src={url(q.bp!)} alt={`Página ${q.bp} da prova, com o texto-base`} legenda={`Página ${q.bp} da prova, com o texto. O texto pode continuar na página seguinte.`} />
            )}
            {q.p && (
              <PaginaProva key={url(q.p)} src={url(q.p)} alt={`Página ${q.p} da prova`} legenda={`Página ${q.p} da prova. A questão ${q.n} está nesta página.`} />
            )}
          </Aside>
        )}
        <div className="foot sticky">
        <button className="btn" onClick={() => go(-1)} disabled={!s.i}>Anterior</button>
        {s.i < n - 1 ? <button className="btn pri" onClick={() => go(1)}>{!s.sim && !a ? 'Pular' : 'Próxima'}</button>
          : s.review ? <button className="btn pri" onClick={backToResult}>Voltar ao resultado</button>
          : <button className="btn pri" onClick={finish}>{s.sim ? 'Entregar prova' : 'Ver resultado'}</button>}
        </div>
      </div>
    </>
  )
}

export function Resultado() {
  const s = useApp((st) => st.session)!
  const { jump, leave, startSimulado, startByWeight } = useApp.getState()
  const L = s.ids.map((id) => BY_ID[id])
  const r = scoreSimulado(L, s.ans)
  const ok = L.filter((q) => s.ans[q.id] === q.g).length
  return (
    <>
      <div className="split">
        <div className="col">
          <Top title={s.sim ? 'Resultado do simulado' : 'Resultado'} sub={`${ok} de ${L.length} certas`} />
          {s.sim && L.length === 70 && (
            <div className="scorecard">
              <span className="lb">Sua nota</span>
              <div className="score">{f1(r.points)}<span className="muted big"> / 100 pontos</span></div>
              {s.dur !== undefined && <p className="tempo">Tempo gasto: <b>{formatarDuracao(s.dur)}</b></p>}
              <ul className="rules">
                <li><span className={`d ${r.passTotal ? 'ok' : ''}`} />{r.passTotal ? 'Passou' : 'Não passou'} · total: mínimo 50 pontos (você fez {f1(r.points)})</li>
                <li><span className={`d ${r.passBasic ? 'ok' : ''}`} />{r.passBasic ? 'Passou' : 'Não passou'} · básicos: mínimo 16,25 de 32,5 (você fez {f1(r.basic)})</li>
                <li><span className={`d ${r.passSpecific ? 'ok' : ''}`} />{r.passSpecific ? 'Passou' : 'Não passou'} · específicos: mínimo 33,75 de 67,5 (você fez {f1(r.specific)})</li>
                <li><span className={`d ${r.zeroed.length ? '' : 'ok'}`} />{r.zeroed.length ? `Nota zero elimina: ${r.zeroed.join(', ')}` : 'Nenhuma matéria zerada'}</li>
              </ul>
              <p className="note">Regras do edital 2022/001, o último publicado. Prova montada com questões antigas, sem garantia do mesmo nível de dificuldade.</p>
            </div>
          )}
          <div className="sec">Cartão-resposta · toque para rever</div>
          <div className="cartao">
            {L.map((q, i) => { const a = s.ans[q.id]
              return <button key={q.id} style={{ '--i': Math.min(i, 24) } as CSSProperties} className={`cell ${a ? (a === q.g ? 'ok' : 'err') : ''}`} aria-label={`Questão ${i + 1}: ${a ? (a === q.g ? 'certa' : 'errada') : 'em branco'}`} onClick={() => jump(i)}>{i + 1}</button> })}
          </div>
        </div>
        <Aside>
          <div className="sec narrow-only">Por matéria</div>
          <div className="side-h wide-only"><Icon n="chart" size={18} />Por matéria</div>
          <Hr className="wide-only" />
          <div className="card tbl scroll"><table><tbody>
            {ALL_SUBJECTS.filter((m) => r.bySubject[m.n]).map((m) => <tr key={m.n}><td>{m.s}</td><td className="n">{r.bySubject[m.n].c}/{r.bySubject[m.n].n}</td></tr>)}
          </tbody></table></div>
        </Aside>
        <div className="foot sticky"><button className="btn" onClick={leave}>Início</button>
        <button className="btn pri" onClick={s.sim ? startSimulado : startByWeight}>{s.sim ? 'Novo simulado' : 'Mais 10 por peso'}</button></div>
      </div>
    </>
  )
}
