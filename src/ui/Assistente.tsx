import { useEffect, useRef, useState } from 'react'
import { ACOES } from '../core/assistente'
import { REGRAS } from '../core/scoring'
import { ALL_SUBJECTS } from '../core/subjects'
import type { Letter } from '../core/types'
import { BANK, useApp } from '../store/app'
import { iaLigada } from '../services/importar/ia'
import { useAssistente } from '../store/assistente'
import { useEspacos } from '../store/espacos'
import { IaPainel } from './AssistenteIA'
import { Icon, Top } from './bits'
import { Cena, Pilulas, useContagem, useFalas, useFechar, type ItemPilula } from './movimentoChat'

const LETRAS: Letter[] = ['A', 'B', 'C', 'D', 'E']
const resumo = (t: string, n = 110) => (t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…')

/** Um botão que abre o seletor de arquivo (o <input type="file"> fica escondido: só o botão aparece). */
function EscolherArquivo({ rotulo, aceita, nome, onArquivo, id, pri }: { rotulo: string; aceita: string; nome?: string; onArquivo: (f: File) => void; id: string; pri?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="as-arq">
      <input ref={ref} id={id} type="file" accept={aceita} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onArquivo(f); e.target.value = '' }} />
      <button className={`btn${pri ? ' pri' : ''}`} onClick={() => ref.current?.click()}><Icon n="doc" size={18} />{rotulo}</button>
      {nome && <span className="as-nome" title={nome}>{nome}</span>}
    </div>
  )
}

/** Sugestões: pílulas no fim da conversa (como as respostas rápidas de um chat). Tocar numa delas é "dizer" aquilo. */
function Sugestoes() {
  const { escolher, ajuda } = useAssistente.getState()
  const desambiguar = useAssistente((s) => s.desambiguar)
  const itens: ItemPilula[] = [
    ...desambiguar.map((id) => ({ id: `d-${id}`, rotulo: ACOES.find((a) => a.id === id)!.sugestao, pri: true, acao: id, run: () => escolher(id) })),
    ...ACOES.filter((a) => !desambiguar.includes(a.id)).map((a) => ({ id: a.id, rotulo: a.sugestao, acao: a.id, run: () => escolher(a.id) })),
    { id: 'ajuda', rotulo: 'O que você sabe fazer?', acao: 'ajuda', run: ajuda },
  ]
  return <Pilulas itens={itens} />
}

/** A caixa de mensagem: escrever um pedido ("importar prova") tem o mesmo efeito de tocar na sugestão. Enter envia. Fica logo abaixo da última fala (nunca presa no
 *  pé da tela), então o teclado do celular só a cobre se a pessoa rolar a conversa: a regra do teclado do app. */
function Composer() {
  const enviar = useAssistente((s) => s.enviar)
  const [txt, setTxt] = useState('')
  return (
    <form className="as-composer" onSubmit={(e) => { e.preventDefault(); if (txt.trim()) { enviar(txt); setTxt('') } }}>
      <input id="as-msg" className="campo" value={txt} maxLength={200} onChange={(e) => setTxt(e.target.value)} autoComplete="off" enterKeyHint="send" aria-label="Mensagem para o assistente" placeholder={'Escreva um pedido, ex.: "importar prova"'} />
      <button type="submit" className="btn pri" disabled={!txt.trim()}>Enviar</button>
    </form>
  )
}

function NovoEspaco() {
  const fechar = useFechar()
  const { criarEspaco, voltarAoInicio } = useAssistente.getState()
  const ocupado = useAssistente((s) => s.ocupado)
  const [nome, setNome] = useState('')
  return (
    <div className="card as-painel">
      <label className="lb" htmlFor="as-espaco">Nome do espaço</label>
      <input id="as-espaco" className="campo" value={nome} maxLength={40} placeholder="Ex.: Direito, Concurso 2026…" onChange={(e) => setNome(e.target.value)} autoComplete="off" />
      <div className="foot sticky">
        <button className="btn" onClick={() => fechar(voltarAoInicio)}>Cancelar</button>
        <button className="btn" disabled={ocupado} onClick={() => void criarEspaco(nome, false)}>Criar vazio</button>
        <button className="btn pri" disabled={ocupado} onClick={() => void criarEspaco(nome, true)}>Com as questões do BB</button>
      </div>
    </div>
  )
}

function ArquivosProva() {
  const fechar = useFechar()
  const { lerProva, voltarAoInicio } = useAssistente.getState()
  const [prova, setProva] = useState<File | null>(null)
  const [gab, setGab] = useState<File | null>(null)
  return (
    <div className="card as-painel">
      <div className="lb">1. Prova (PDF)</div>
      <EscolherArquivo id="as-f-prova" rotulo="Escolher o PDF da prova" aceita="application/pdf,.pdf" nome={prova?.name} onArquivo={setProva} pri />
      <div className="lb">2. Gabarito (PDF, opcional)</div>
      <EscolherArquivo id="as-f-gab" rotulo="Escolher o PDF do gabarito" aceita="application/pdf,.pdf" nome={gab?.name} onArquivo={setGab} />
      <p className="note">Sem o gabarito, você marca a resposta de cada questão na prévia. Se o PDF tiver mais de um gabarito (cadernos 1, 2…), uso o primeiro.</p>
      <div className="foot sticky">
        <button className="btn" onClick={() => fechar(voltarAoInicio)}>Voltar</button>
        <button className="btn pri" disabled={!prova} onClick={() => prova && void lerProva(prova, gab)}>Ler a prova</button>
      </div>
    </div>
  )
}

function Lendo() {
  const p = useAssistente((s) => s.progresso)
  return (
    <div className="card as-painel as-lendo" role="status" aria-live="polite">
      <p>{p?.texto ?? 'Lendo…'}</p>
      <div className="bar as-brilho" aria-hidden="true"><i style={{ width: `${Math.max(4, p?.pct ?? 0)}%` }} /></div>
      <div className="as-esqueleto" aria-hidden="true"><i /><i /><i /></div>
    </div>
  )
}

function PreviaProva() {
  const fechar = useFechar()
  const s = useAssistente()
  const p = s.previa!
  const [todas, setTodas] = useState(false)
  const lista = p.prep.lida.questoes
  const respostas = { ...(p.prep.gabarito?.respostas ?? {}), ...p.manual }
  const prontas = p.escolhidas.filter((n) => { const q = lista.find((x) => x.numero === n); return q && n in respostas && respostas[n] !== null && q.alternativas[respostas[n] as Letter] })
  const visiveis = todas ? lista : lista.slice(0, 30)
  const semResposta = p.escolhidas.length - prontas.length
  return (
    <div className="as-painel">
      <div className="card">
        <label className="lb" htmlFor="as-prova">Nome da prova</label>
        <input id="as-prova" className="campo" value={p.rotulo} maxLength={80} onChange={(e) => s.setRotulo(e.target.value)} autoComplete="off" />
        <div className="lb">Imagem da questão (recorte da página)</div>
        <div className="chips" role="group" aria-label="Quais questões guardam imagem">
          {([['figuras', 'Só com figura ou tabela'], ['todas', 'Todas'], ['nenhuma', 'Nenhuma']] as const).map(([v, r]) => <button key={v} className="chip" aria-pressed={p.imagens === v} onClick={() => s.setImagens(v)}>{r}</button>)}
        </div>
        <p className="note" role="status">{prontas.length} de {lista.length} prontas para entrar{semResposta ? ` · ${semResposta} sem resposta (marque abaixo)` : ''}.</p>
      </div>
      <ul className="as-qs">
        {visiveis.map((q, idx) => {
          const marcada = p.escolhidas.includes(q.numero)
          const r = respostas[q.numero]
          return (
            <li key={q.numero} className={`as-q${marcada ? '' : ' off'}${idx < 12 ? ' casc' : ''}`} style={{ '--i': idx } as React.CSSProperties}>
              <label className="as-q-top">
                <input type="checkbox" checked={marcada} onChange={() => s.alternarQuestao(q.numero)} aria-label={`Incluir a questão ${q.numero}`} />
                <b>Q{q.numero}</b><span className="muted">{q.materia || 'sem matéria'}</span>
                {q.avisos.length > 0 && <span className="as-aviso" title={q.avisos.join('; ')}>aviso</span>}
              </label>
              <p className="as-q-txt">{resumo(q.enunciado)}</p>
              {q.avisos.length > 0 && <p className="note as-q-av">{q.avisos.join('; ')}</p>}
              {q.avisos.length > 0 && iaLigada() && !s.sugestoes[q.numero] && <button className="btn small-btn" disabled={s.relendo !== null} onClick={() => void s.releer(q.numero)}>{s.relendo === q.numero ? 'Relendo…' : 'Reler com IA'}</button>}
              {s.sugestoes[q.numero] && (
                <div className="as-sug" role="group" aria-label={`Sugestão da IA para a questão ${q.numero}`}>
                  <p className="note"><b>Sugestão da IA</b> (confira com a prova):</p>
                  <p className="as-q-txt">{resumo(s.sugestoes[q.numero].enunciado, 160)}</p>
                  <ul className="as-sug-alts">{LETRAS.filter((l) => s.sugestoes[q.numero].alternativas[l]).map((l) => <li key={l}><b>{l}</b> {resumo(s.sugestoes[q.numero].alternativas[l] ?? '', 80)}</li>)}</ul>
                  <div className="row"><button className="btn small-btn pri" onClick={() => s.aceitarIA(q.numero)}>Usar a sugestão</button><button className="btn small-btn" onClick={() => s.descartarIA(q.numero)}>Descartar</button></div>
                </div>
              )}
              <div className="chips as-letras" role="group" aria-label={`Resposta da questão ${q.numero}`}>
                {LETRAS.map((l) => <button key={l} className="chip" disabled={!q.alternativas[l]} aria-pressed={r === l} onClick={() => s.marcarResposta(q.numero, l)}>{l}</button>)}
                {r === null && <span className="note">anulada</span>}
              </div>
            </li>
          )
        })}
      </ul>
      {lista.length > 30 && !todas && <button className="btn" onClick={() => setTodas(true)}>Mostrar as {lista.length} questões</button>}
      <div className="foot sticky">
        <button className="btn" onClick={() => fechar(() => useAssistente.getState().voltarAoInicio())}>Cancelar</button>
        <button className="btn pri" disabled={s.ocupado || !prontas.length} onClick={() => void s.confirmarProva()}>{s.ocupado ? 'Adicionando…' : `Adicionar ${prontas.length}`}</button>
      </div>
    </div>
  )
}

/** Sucesso: o "visto" se desenha, o número de itens sobe contando e as próximas sugestões entram em cascata. */
function Pronto({ treinar }: { treinar: boolean }) {
  const { voltarAoInicio, escolher } = useAssistente.getState()
  const resultado = useAssistente((s) => s.resultado)
  const n = useContagem(resultado?.n ?? 0)
  const ir = (t: 'treinar' | 'cartoes') => useApp.getState().setTab(t)
  const itens: ItemPilula[] = [
    treinar ? { id: 'treinar', rotulo: 'Treinar agora', pri: true, run: () => ir('treinar') } : { id: 'cartoes', rotulo: 'Ver os cartões', pri: true, run: () => ir('cartoes') },
    ...(treinar ? [{ id: 'outra', rotulo: 'Importar outra prova', run: () => escolher('prova') }] : []),
    { id: 'mais', rotulo: 'Mais sugestões', run: voltarAoInicio },
  ]
  return (
    <>
      {resultado?.n !== undefined && (
        <div className="as-sucesso" role="status">
          <svg className="as-visto" viewBox="0 0 52 52" width="44" height="44" aria-hidden="true"><circle cx="26" cy="26" r="23" /><path d="M15 27l8 8 15-17" /></svg>
          <div><b className="as-conta" data-testid="conta">{n}</b><span>{treinar ? (resultado.n === 1 ? ' questão adicionada' : ' questões adicionadas') : (resultado.n === 1 ? ' cartão criado' : ' cartões criados')}</span></div>
        </div>
      )}
      <Pilulas itens={itens} />
    </>
  )
}

function ArquivoCartoes() {
  const fechar = useFechar()
  const { lerCartoes, voltarAoInicio } = useAssistente.getState()
  return (
    <div className="card as-painel">
      <EscolherArquivo id="as-f-resumo" rotulo="Escolher o arquivo do resumo" aceita="application/pdf,.pdf,.txt,.md,.markdown,text/plain,text/markdown" onArquivo={(f) => void lerCartoes(f)} pri />
      <p className="note">Funciona melhor com "Termo: definição", "Pergunta? Resposta", "X é …", títulos com parágrafo e trechos em **negrito**.</p>
      <div className="foot sticky"><button className="btn" onClick={() => fechar(voltarAoInicio)}>Voltar</button></div>
    </div>
  )
}

function PreviaCartoes() {
  const fechar = useFechar()
  const s = useAssistente()
  const c = s.cartoes!
  const [todos, setTodos] = useState(false)
  const visiveis = todos ? c.sug.cartoes : c.sug.cartoes.slice(0, 40)
  return (
    <div className="as-painel">
      <div className="card">
        <label className="lb" htmlFor="as-baralho">Nome do baralho</label>
        <input id="as-baralho" className="campo" value={c.nome} maxLength={40} onChange={(e) => s.setNomeBaralho(e.target.value)} autoComplete="off" />
        <p className="note" role="status">{c.escolhidos.length} de {c.sug.cartoes.length} cartões escolhidos.</p>
      </div>
      <ul className="as-qs">
        {visiveis.map((x, i) => (
          <li key={i} className={`as-q${c.escolhidos.includes(i) ? '' : ' off'}${i < 12 ? ' casc' : ''}`} style={{ '--i': i } as React.CSSProperties}>
            <label className="as-q-top">
              <input type="checkbox" checked={c.escolhidos.includes(i)} onChange={() => s.alternarCartao(i)} aria-label={`Incluir o cartão ${i + 1}`} />
              <b>{resumo(x.f, 70)}</b>
            </label>
            <p className="as-q-txt">{resumo(x.v, 140)}</p>
          </li>
        ))}
      </ul>
      {c.sug.cartoes.length > 40 && !todos && <button className="btn" onClick={() => setTodos(true)}>Mostrar os {c.sug.cartoes.length} cartões</button>}
      <div className="foot sticky">
        <button className="btn" onClick={() => fechar(() => useAssistente.getState().voltarAoInicio())}>Cancelar</button>
        <button className="btn pri" disabled={!c.escolhidos.length} onClick={s.confirmarCartoes}>Criar o baralho</button>
      </div>
    </div>
  )
}

function Simulado() {
  const fechar = useFechar()
  const { iniciarSimulado, voltarAoInicio } = useAssistente.getState()
  const [mat, setMat] = useState<string | null>(null)
  const [n, setN] = useState(20)
  const mats = ALL_SUBJECTS.filter((m) => BANK.some((q) => q.m === m.n))
  if (REGRAS) {
    return (
      <div className="card as-painel">
        <p className="note">Prova do edital, com nota e regras.</p>
        <div className="foot sticky"><button className="btn" onClick={() => fechar(voltarAoInicio)}>Voltar</button><button className="btn pri" onClick={() => iniciarSimulado(null, 0)}>Começar o simulado</button></div>
      </div>
    )
  }
  return (
    <div className="card as-painel">
      <div className="lb">Matéria</div>
      <div className="chips" role="group" aria-label="Matéria do simulado">
        {mats.map((m) => <button key={m.n} className="chip" aria-pressed={mat === m.n} onClick={() => setMat(m.n)}>{m.s}</button>)}
        {!mats.length && <p className="note">Este espaço ainda não tem questões. Importe uma prova primeiro.</p>}
      </div>
      <div className="lb">Quantidade</div>
      <div className="chips" role="group" aria-label="Quantidade de questões">
        {[10, 20, 30, 40].map((v) => <button key={v} className="chip" aria-pressed={n === v} onClick={() => setN(v)}>{v}</button>)}
      </div>
      <div className="foot sticky"><button className="btn" onClick={() => fechar(voltarAoInicio)}>Voltar</button><button className="btn pri" disabled={!mat} onClick={() => mat && iniciarSimulado(mat, n)}>Começar</button></div>
    </div>
  )
}

function Espacos() {
  const fechar = useFechar()
  const { lista, ativo, ativar, apagar } = useEspacos()
  const { voltarAoInicio, novoEspaco } = useAssistente.getState()
  const [apagando, setApagando] = useState<string | null>(null)
  return (
    <div className="card as-painel">
      <ul className="as-esp">
        {lista.map((e) => (
          <li key={e.id} className="as-esp-i">
            <button className="chip" aria-pressed={e.id === ativo} onClick={() => void ativar(e.id)}>{e.nome}<small> · {e.n} questões</small></button>
            {!e.embutido && (apagando === e.id
              ? <span className="as-conf"><button className="btn warn small-btn" onClick={() => { setApagando(null); void apagar(e.id) }}>Apagar mesmo</button><button className="btn small-btn" onClick={() => setApagando(null)}>Não</button></span>
              : <button className="btn small-btn" aria-label={`Apagar o espaço ${e.nome}`} onClick={() => setApagando(e.id)}><Icon n="trash" size={16} /></button>)}
          </li>
        ))}
      </ul>
      <p className="note">Apagar um espaço tira as questões e as imagens dele. O seu progresso fica guardado por questão: importar o mesmo arquivo de novo recupera.</p>
      <div className="foot sticky"><button className="btn" onClick={() => fechar(voltarAoInicio)}>Voltar</button><button className="btn pri" onClick={novoEspaco}>Novo espaço</button></div>
    </div>
  )
}

function Conversa({ iniciais, falas }: { iniciais: number; falas: { visiveis: number; digitando: boolean } }) {
  const msgs = useAssistente((s) => s.mensagens)
  return (
    <div className="as-chat" role="log" aria-live="polite" aria-label="Conversa com o assistente">
      {msgs.slice(0, falas.visiveis).map((x, i) => (
        <div key={x.id} className={`as-linha ${x.de}${i >= iniciais ? ' entra' : ''}`}>
          {x.de === 'a' && <span className="as-avatar" aria-hidden="true"><Icon n="chat" size={16} /></span>}
          <p className={`as-msg ${x.de}${x.tipo ? ' ' + x.tipo : ''}`}>{x.texto}</p>
        </div>
      ))}
      {falas.digitando && (
        <div className="as-linha a entra as-digitando-linha" aria-hidden="true">
          <span className="as-avatar"><Icon n="chat" size={16} /></span>
          <p className="as-msg a as-digitando"><i /><i /><i /></p>
        </div>
      )}
    </div>
  )
}

/** A aba do Assistente: um chat. O assistente fala em balões; o que ele precisa de você aparece dentro da conversa; as ações vêm como sugestões. */
export function Assistente() {
  const etapa = useAssistente((s) => s.etapa)
  const mensagens = useAssistente((s) => s.mensagens)
  const resultado = useAssistente((s) => s.resultado)
  const espaco = useEspacos((s) => s.lista.find((e) => e.id === s.ativo)?.nome ?? '')
  const tela = useRef<HTMLDivElement>(null)
  useEffect(() => { useAssistente.getState().iniciarConversa() }, [])
  const iniciais = useRef(useAssistente.getState().vistas).current // as que já estavam mostradas ao entrar na aba não animam de novo
  const falas = useFalas(mensagens, iniciais, (n) => useAssistente.getState().marcarVistas(n))
  // a tela mostra a fala mais recente no alto, com o que o assistente pede logo abaixo (lista longa de prévia começa pelo começo);
  // depois do reposicionamento da aba, para não ser desfeito
  useEffect(() => {
    const id = requestAnimationFrame(() => tela.current?.querySelector('.as-chat > .as-linha:last-child')?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(id)
  }, [falas.visiveis, falas.digitando, etapa])
  const menu = etapa === 'inicio' || etapa === 'prova-pronta' || etapa === 'cartoes-pronto'
  return (
    <>
      <Top title="Assistente" sub={`Espaço: ${espaco}`} />
      <div className="chat-tela" ref={tela}>
        <Conversa iniciais={iniciais} falas={falas} />
        {menu && <Composer />}
        {!falas.falando && (
          <Cena chave={etapa}>
            <div className="as-corpo">
              {etapa === 'inicio' && <Sugestoes />}
              {etapa === 'espaco-novo' && <NovoEspaco />}
              {etapa === 'prova-arquivos' && <ArquivosProva />}
              {etapa === 'lendo' && <Lendo />}
              {etapa === 'prova-previa' && <PreviaProva />}
              {etapa === 'prova-pronta' && <Pronto treinar />}
              {etapa === 'cartoes-arquivo' && <ArquivoCartoes />}
              {etapa === 'cartoes-previa' && <PreviaCartoes />}
              {etapa === 'cartoes-pronto' && <Pronto treinar={false} />}
              {etapa === 'simulado' && <Simulado />}
              {etapa === 'espacos' && <Espacos />}
              {etapa === 'ia' && <IaPainel />}
            </div>
          </Cena>
        )}
        {resultado && <p className="sr-only" role="status">{resultado.texto}</p>}
      </div>
    </>
  )
}

