// O chat com ações fixas (core/assistente.ts): estado da conversa e o fluxo de cada ação. Sem IA: quem lê os arquivos são as regras de core/importar.
// A conversa fica guardada no aparelho (tabela `conversa`): trocar de aba ou fechar o app não a perde; o que importa de verdade vai para o espaço de estudo e para os baralhos.
// F2: pedidos com detalhes ("simulado de matemática com 20 questões"): o que a pessoa não disse o assistente pergunta (core/dialogo), e a última coisa feita pode ser desfeita.
import { create } from 'zustand'
import { sugerirCartoes, type Sugestoes } from '../core/importar/cartoes'
import { montarQuestoes, type MetaProva } from '../core/importar/montar'
import type { QuestaoLida } from '../core/importar/prova'
import { ACOES, acaoPorId, type IdAcao } from '../core/assistente'
import { cadernoDoEspaco, dosErros, montarSemana, resumirCaderno, type Caderno } from '../core/caderno'
import { cartoesPorDia, estadoDoDiaDe, horaTexto, type EstadoDoDia } from '../core/lembrete'
import { useLembrete } from './lembrete'
import { MAX_PLANO, montarPainel, montarPlano, rotuloTempo, textoDoPainel, textoDoPlano, type EntradaPainel, type Painel, type Plano, type SugestaoDia } from '../core/dia'
import { lerPlanoAtivo, novoPlanoAtivo, statusDoPlano, textoDoStatus, type MedidasDoPlano, type PlanoAtivo, type StatusPlano } from '../core/plano'
import { AVISOS } from '../core/avisos'
import { contar, diaDe, type Cartao } from '../core/cards'
import { entender, semAcento } from '../core/conversa'
import { gerarQuestoes, type Geracao } from '../core/questoes/gerar'
import type { Evento } from '../core/sync/eventos'
import { ajustarPelasEntidades, entenderResposta, pedidoDe, preencher, proximoPasso, descrever, ERROS_PADRAO, TREINO_PADRAO, type AcaoPedido, type Opcao, type Pedido, type Slot } from '../core/dialogo/dialogo'
import { extrairEntidades, type Contexto, type CtxProva, type Entidades } from '../core/dialogo/entidades'
import { aplicarSugestao, type Sugestao } from '../core/importar/ia'
import { prepararMaterial, type Material } from '../core/material'
import { REGRAS } from '../core/scoring'
import { ALL_SUBJECTS, SOURCES, SOURCE_KEYS } from '../core/subjects'
import { pick } from '../core/weights'
import type { Letter } from '../core/types'
import { anexarImagens, paragrafosDoArquivo, prepararProva, type ProvaPreparada } from '../services/importar/arquivos'
import { consultar, type Achado } from '../services/busca/consultar'
import { apagarMaterial, gravarConversa, gravarPlanoGuardado, lerConversa, lerEventos, lerPlanoGuardado, limparConversaSalva, listarMateriais, salvarMaterial, trechosDoMaterial } from '../services/db'
import { lerChave, lerModelo, mensagemErroIA, relerComIA } from '../services/importar/ia'
import { recortarQuestao } from '../services/importar/recorte'
import { BANK, TF, useApp } from './app'
import { useCards } from './cards'
import { useEspacos } from './espacos'

export type Etapa = 'inicio' | 'espaco-novo' | 'prova-arquivos' | 'lendo' | 'prova-previa' | 'prova-pronta' | 'cartoes-arquivo' | 'cartoes-previa' | 'cartoes-pronto' | 'materiais' | 'material-arquivo' | 'material-pronto' | 'plano' | 'questoes-material' | 'questoes-previa' | 'caderno' | 'pergunta' | 'limpar' | 'espacos' | 'ia'
/** `tipo`: erro (balão avermelhado que treme uma vez) ou ok (balão de sucesso); sem tipo é conversa normal. */
export interface Msg { id: number; de: 'a' | 'v'; texto: string; tipo?: 'erro' | 'ok' | 'painel' | 'plano'; /** Achados de uma pergunta (trechos com a palavra em destaque e a fonte). */ achados?: Achado[] }
/** A pergunta que o assistente fez para completar um pedido ("De qual matéria?"): as opções viram sugestões e o texto digitado também responde. */
export interface Pendente { pedido: Pedido; slot: Slot; texto: string; opcoes: Opcao[] }
/** As questões geradas de um material, na prévia (nada entra no espaço antes de a pessoa confirmar). */
export interface PreviaGeradas { material: Material; geracao: Geracao; escolhidas: number[] }
export type QuaisImagens = 'figuras' | 'todas' | 'nenhuma'
export interface Previa {
  prep: ProvaPreparada
  rotulo: string
  escolhidas: number[]
  /** Respostas marcadas à mão na prévia (valem mais que as do gabarito lido). */
  manual: Record<number, Letter>
  imagens: QuaisImagens
}
export interface PreviaCartoes { sug: Sugestoes; escolhidos: number[]; nome: string; arquivo: string; avisos: string[] }

interface State {
  etapa: Etapa
  mensagens: Msg[]
  ocupado: boolean
  progresso: { texto: string; pct: number } | null
  /** Ação que pediu para criar um espaço antes de continuar. */
  depois: IdAcao | null
  previa: Previa | null
  cartoes: PreviaCartoes | null
  resultado: { texto: string; treinar?: boolean; n?: number } | null
  /** Materiais guardados no espaço ativo (lista do painel "Meus materiais"). */
  materiais: Material[]
  /** Quantas mensagens a tela já MOSTROU (as novas do assistente entram uma a uma, com "digitando…"): quem volta à aba vê tudo de uma vez. */
  vistas: number
  /** Quando o que a pessoa escreveu pode ser duas ações, o assistente pergunta qual: estas são as duas opções. */
  desambiguar: IdAcao[]
  /** Sugestões da IA (opcional) ainda não aceitas, por número de questão; e a questão que está sendo relida. */
  sugestoes: Record<number, Sugestao>
  relendo: number | null
  /** A pergunta de completar pedido em andamento (etapa 'pergunta'). */
  pendente: Pendente | null
  /** A última prova importada nesta conversa ("treinar essa prova"). */
  ultimaProva: CtxProva | null
  /** Rótulo do que "Desfazer" desfaria agora (null = nada a desfazer). */
  desfazivel: string | null
  /** O que a pessoa já digitou na caixa (as sugestões se filtram enquanto ela escreve). */
  rascunho: string
  /** O painel do dia mostrado ao abrir a aba (as sugestões dele viram pílulas enquanto a última fala for ele). */
  painel: Painel | null
  painelMsgId: number | null
  /** O plano de estudo montado (as pílulas começam pelos cartões ou pelas questões). */
  plano: Plano | null
  /** O plano de HOJE em andamento (o que combinamos e de onde contar o que já foi feito); guardado no aparelho. */
  planoAtivo: PlanoAtivo | null
  /** A pessoa saiu daqui para fazer os cartões do plano: quando eles acabarem, os Cards a levam direto às questões. */
  planoEmCurso: boolean
  /** O andamento do plano de hoje (feito e falta, cartões e questões); null se não há plano de hoje. */
  statusPlano: () => StatusPlano | null
  /** Chamado pelos Cards quando a parte dos cartões do plano acaba: vai direto para as questões do plano (ou volta aqui, se não há mais questões). */
  concluirCartoesDoPlano: () => void
  /** Abre a aba: lê o histórico, se apresenta (primeira vez) e mostra o painel do dia (no máximo uma vez a cada 3 horas). */
  abrirAba: () => Promise<void>
  painelAcao: (s: SugestaoDia) => void
  planoAcao: (que: 'cartoes' | 'questoes' | 'outro') => void
  /** Prévia das questões geradas do material. */
  geradas: PreviaGeradas | null
  /** Gera questões de um material do espaço ativo (mostra a prévia). */
  gerarQuestoes: (materialId: string) => Promise<void>
  alternarGerada: (i: number) => void
  confirmarGeradas: () => Promise<void>
  /** Os eventos de resposta (de todos os aparelhos): dali sai a ordem das respostas do caderno de erros. Lidos ao abrir a aba. */
  eventos: Evento[]
  /** Relê os eventos (depois de responder questões, o caderno muda). */
  atualizarCaderno: () => Promise<void>
  /** O resumo do dia (o que já estudou, o que espera) para o lembrete diário decidir se avisa e o que dizer. Relê os eventos antes. */
  estadoDoDia: () => Promise<EstadoDoDia>
  /** Uma sugestão do painel do caderno de erros: rever (todas ou só uma matéria) ou simulado só dos erros. */
  cadernoAcao: (que: 'rever' | 'simulado' | { materia: string; rotulo: string }) => void
  /** O histórico já foi lido do aparelho. */
  carregada: boolean
  /** Muda quando a conversa é apagada: a tela refaz a conversa do zero. */
  epoca: number
  /** Lê o histórico guardado (uma vez). */
  carregarHistorico: () => Promise<void>
  /** Primeira vez na aba: o assistente se apresenta (se não houver histórico). */
  iniciarConversa: () => Promise<void>
  digitar: (t: string) => void
  /** Tocou numa opção da pergunta. */
  responder: (o: Opcao) => void
  cancelarPergunta: () => void
  /** Desfaz a última coisa que o assistente fez por você. */
  desfazer: () => void
  /** Limpar a conversa: pergunta antes; `limparConversa` apaga de verdade. */
  pedirLimpar: () => void
  limparConversa: () => Promise<void>
  /** Procura o texto digitado nos materiais (a sugestão "Procurar … no meu material"). */
  procurar: (t: string) => void
  /** "O que você sabe fazer?": a lista das ações, em balão. */
  ajuda: () => void
  /** A pessoa digitou um comando (caixa de mensagem): o assistente entende e responde como se ela tivesse tocado na sugestão. */
  enviar: (texto: string) => void
  /** A tela avisa quantas mensagens já mostrou. */
  marcarVistas: (n: number) => void
  voltarAoInicio: () => void
  escolher: (id: IdAcao) => void
  criarEspaco: (nome: string, usaBB: boolean) => Promise<void>
  lerProva: (prova: File, gabarito: File | null) => Promise<void>
  alternarQuestao: (n: number) => void
  marcarResposta: (n: number, l: Letter) => void
  setRotulo: (t: string) => void
  setImagens: (q: QuaisImagens) => void
  confirmarProva: () => Promise<void>
  releer: (n: number) => Promise<void>
  aceitarIA: (n: number) => void
  descartarIA: (n: number) => void
  lerCartoes: (f: File) => Promise<void>
  alternarCartao: (i: number) => void
  setNomeBaralho: (t: string) => void
  confirmarCartoes: () => void
  /** "Novo espaço" a partir da lista de espaços. */
  novoEspaco: () => void
  /** Atualiza a lista de materiais do espaço ativo. */
  carregarMateriais: () => Promise<void>
  /** Guarda um arquivo de texto (PDF, TXT, MD) como material do espaço ativo. */
  guardarMaterial: (f: File) => Promise<void>
  apagarMaterial: (id: string) => Promise<void>
  /** Procura no espaço ativo e responde em balões (os achados vão dentro da fala). */
  perguntar: (texto: string) => Promise<void>
}

let msgId = 0
/** Crescente e único entre aberturas do app (o histórico guardado usa o id como ordem). */
const novoId = () => (msgId = Math.max(msgId + 1, Date.now()))
const m = (de: Msg['de'], texto: string, tipo?: Msg['tipo'], achados?: Achado[]): Msg => ({ id: novoId(), de, texto, ...(tipo ? { tipo } : {}), ...(achados ? { achados } : {}) })
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const NAO_ENTENDI = 'Não entendi esse pedido. Tente, por exemplo: "importar prova", "criar cartões", "o que é Copom?", "montar simulado" ou "meus espaços". Ou toque numa sugestão.'
/** O que "Desfazer" faz agora (só a última coisa; some ao fazer outra). */
let acaoDesfazer: (() => Promise<void>) | null = null
let gravadas = 0
/** O histórico guardado já foi lido nesta abertura do app? */
let historicoLido = false
/** As gravações do histórico saem uma de cada vez, na ordem (apagar a conversa não pode passar na frente de uma fala que ainda está sendo gravada). */
let fila: Promise<unknown> = Promise.resolve()
const naFila = <T,>(fn: () => Promise<T>): Promise<T> => { const p = fila.then(fn, fn); fila = p.catch(() => {}); return p }
const erroTexto = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useAssistente = create<State>((set, get) => {
  const diz = (...textos: string[]) => set((s) => ({ mensagens: [...s.mensagens, ...textos.map((t) => m('a', t))] }))
  const dizErro = (...textos: string[]) => set((s) => ({ mensagens: [...s.mensagens, ...textos.map((t) => m('a', t, 'erro'))] }))
  const dizOk = (...textos: string[]) => set((s) => ({ mensagens: [...s.mensagens, ...textos.map((t) => m('a', t, 'ok'))] }))
  const voce = (t: string) => set((s) => ({ mensagens: [...s.mensagens, m('v', t)] }))
  const ir = (etapa: Etapa, extra: Partial<State> = {}) => set({ etapa, ...extra })
  const progresso = (texto: string, pct: number) => set({ progresso: { texto, pct } })
  const ehBB = () => useEspacos.getState().ativo === 'bb'
  const espacoAtivo = () => useEspacos.getState().ativo
  const tipoDoArquivo = (f: File) => (/\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? 'pdf' : 'texto') as 'pdf' | 'texto'
  const inicio = () => set({ etapa: 'inicio', sugestoes: {}, relendo: null, previa: null, cartoes: null, resultado: null, depois: null, progresso: null, ocupado: false, desambiguar: [], pendente: null })
  /** O caderno de erros de agora, do espaço ativo (refeito a cada uso: é barato e nunca fica velho). */
  const caderno = (): Caderno => cadernoDoEspaco(get().eventos, useApp.getState().prog, BANK)
  const definirDesfazer = (rotulo: string, fn: () => Promise<void>) => { acaoDesfazer = fn; set({ desfazivel: rotulo }) }

  /** O que o assistente sabe do espaço ativo e da conversa: a base para entender "de matemática", "bb 2021", "essa prova". */
  const contexto = (): Contexto => {
    const e = useEspacos.getState()
    return {
      materias: ALL_SUBJECTS.filter((x) => BANK.some((q) => q.m === x.n)).map((x) => ({ nome: x.n, curto: x.s })),
      provas: SOURCE_KEYS.map((chave) => ({ chave, rotulo: SOURCES[chave] })),
      espacos: e.lista.map((x) => ({ id: x.id, nome: x.nome })),
      espacoAtivo: e.ativo, temRegras: !!REGRAS, ultimaProva: get().ultimaProva ?? undefined, erros: Object.keys(caderno()).length,
      lembrete: useLembrete.getState().disponivel ? useLembrete.getState().config : undefined,
    }
  }

  const entradaPainel = (): EntradaPainel => {
    const c = useCards.getState(), a = useApp.getState()
    return { agora: Date.now(), cartoes: c.cartoes, ajustes: c.ajustes, histQuestoes: a.hist, histCartoes: c.hist, prog: a.prog, bank: BANK, caderno: caderno() }
  }
  /** O que o app já viu do plano de hoje: cartões estudados e questões respondidas desde que o plano foi montado. */
  const medidasDoPlano = (p: PlanoAtivo): MedidasDoPlano => {
    const c = useCards.getState(), agora = Date.now()
    const respondidas = new Set<string>()
    for (const e of get().eventos) if (e.k === 'r' && e.t >= p.criado) respondidas.add(e.q)
    return { cartoesHoje: c.hist.dias[diaDe(agora)]?.n ?? 0, cartoesVencidos: contar(c.cartoes as Cartao[], c.ajustes, agora).hoje, respondidas }
  }
  const planoDeHoje = (): PlanoAtivo | null => { const p = get().planoAtivo; return p && p.dia === diaDe(Date.now()) ? p : null }
  const statusAgora = (): StatusPlano | null => { const p = planoDeHoje(); return p ? statusDoPlano(p, medidasDoPlano(p)) : null }
  const guardarPlano = (p: PlanoAtivo | null) => { set({ planoAtivo: p }); void gravarPlanoGuardado(p).catch(() => { /* sem banco: vale nesta abertura */ }) }
  /** Ao voltar ao assistente: se o plano de hoje andou desde o último balão, diz o que já foi feito e o que falta (e as sugestões passam a começar pelo que vem agora). */
  const mostrarAndamentoDoPlano = () => {
    const p = planoDeHoje()
    if (!p) return
    const texto = textoDoStatus(p, statusDoPlano(p, medidasDoPlano(p)))
    if (texto === p.ultimoTexto) return
    const msg = m('a', texto, 'plano')
    set((st) => ({ mensagens: [...st.mensagens, msg], etapa: 'plano' }))
    guardarPlano({ ...p, ultimoTexto: texto })
  }
  const SAUDACAO = "Oi! Eu sou o assistente do Logos. Monto o seu espaço de estudo a partir dos seus arquivos: provas em PDF, gabaritos e resumos. Tudo é lido aqui no seu aparelho. Por onde quer começar?"
  /** O painel do dia como fala do assistente (no máximo uma vez a cada 3 horas: o id da fala é a hora em que ela foi dita). */
  const mostrarPainel = () => {
    const ultimo = [...get().mensagens].reverse().find((x) => x.tipo === 'painel')
    if (ultimo && Date.now() - ultimo.id < 3 * 3_600_000) return
    const p = montarPainel(entradaPainel())
    const msg = m('a', textoDoPainel(p, Date.now()), 'painel')
    set((st) => ({ mensagens: [...st.mensagens, msg], painel: p, painelMsgId: msg.id }))
  }
  /** Tudo o que precisa estar pronto antes de a tela do chat aparecer: histórico, apresentação (1ª vez) e, ao abrir a aba, o painel do dia. */
  const abrir = async (comPainel: boolean) => {
    await get().atualizarCaderno()
    await get().carregarHistorico()
    if (!get().mensagens.length) set({ mensagens: [m('a', SAUDACAO)] })
    if (comPainel) {
      mostrarPainel()
      set({ planoEmCurso: false }) // voltou aqui: o que estava em curso termina; se o plano andou, o balão de andamento vem depois do painel
      if (!get().planoAtivo) { try { set({ planoAtivo: lerPlanoAtivo(await lerPlanoGuardado()) }) } catch { /* sem plano guardado */ } }
      mostrarAndamentoDoPlano()
    }
    set({ carregada: true })
  }

  /** "Me lembre às 20h" / "desligar o lembrete": liga, muda a hora ou desliga o lembrete diário (a permissão de notificação é pedida aqui, na 1ª vez que liga). */
  const aplicarLembrete = async (p: Pedido) => {
    const L = useLembrete.getState()
    if (!L.disponivel) { diz('O lembrete diário só funciona no aplicativo do Android: o navegador não consegue avisar com o app fechado. No aplicativo é só pedir de novo, por exemplo "me lembre às 20h".'); return }
    try {
      if (p.desligar) {
        if (!L.config.ativo) { diz('O lembrete diário já está desligado.'); return }
        await L.desligar(); dizOk('Desliguei o lembrete diário. Para ligar de novo é só pedir, por exemplo "me lembre às 20h".'); return
      }
      const hora = p.hora ?? 19, minuto = p.minuto ?? 0
      await L.definirHora(hora, minuto)
      if (!useLembrete.getState().config.ativo) await useLembrete.getState().ligar()
      const s = useLembrete.getState()
      if (s.config.ativo) dizOk(`Pronto: lembrete diário às ${horaTexto({ hora, minuto })}.${s.proximo ? ` Próximo aviso: ${s.proximo}.` : ''} Se você já tiver estudado no dia, ele não toca.`)
      else diz(s.nota ?? 'Não consegui ligar o lembrete agora.')
    } catch { dizErro('Não consegui mexer no lembrete agora. Tente de novo mais tarde.') }
  }

  /** Monta e começa o simulado/treino pedido (tudo o que faltava já foi respondido). */
  const executarPedido = (p: Pedido) => {
    const { prog, startSimulado, startCustom } = useApp.getState()
    inicio()
    if (p.acao === 'lembrete') { void aplicarLembrete(p); return }
    if (p.acao === 'plano') {
      const pedido = p.minutos ?? 30
      const pl = montarPlano(entradaPainel(), pedido, TF)
      if (pedido > MAX_PLANO) diz(`O máximo é ${rotuloTempo(MAX_PLANO)}: é importante se esforçar, mas também precisamos descansar. Montei o plano de ${rotuloTempo(MAX_PLANO)}; se precisar, depois montamos outro.`)
      const agora = Date.now()
      const ativo = novoPlanoAtivo(pl, diaDe(agora), agora, useCards.getState().hist.dias[diaDe(agora)]?.n ?? 0)
      ativo.ultimoTexto = textoDoStatus(ativo, statusDoPlano(ativo, medidasDoPlano(ativo)))
      diz(`${textoDoPlano(pl)}${pl.cartoes || pl.questoes.ids.length ? '\nQuando você voltar aqui, eu mostro o que ainda falta.' : ''}`)
      set({ plano: pl, planoEmCurso: false }); guardarPlano(ativo); ir('plano'); return
    }
    if (p.acao === 'simulado' && p.materia === 'edital') { dizOk('Montei o simulado do edital: questões sorteadas pelo peso de cada matéria, com nota e regras. Boa prova!'); startSimulado(); return }
    if (p.fonte === 'semana') {
      const s = montarSemana(BANK, prog, caderno(), TF, p.quantidade ?? 20)
      if (!s.ids.length) { dizErro('Este espaço não tem questões para montar o simulado da semana. Importe uma prova primeiro.'); return }
      const partes = [s.partes.erros && `${s.partes.erros} do seu caderno de erros`, s.partes.fracas && `${s.partes.fracas} de matérias fracas (${s.materiasFracas.join(', ')})`, s.partes.novas && `${s.partes.novas} novas`, s.partes.outras && `${s.partes.outras} para completar`].filter(Boolean)
      dizOk(`Montei o ${p.acao === 'simulado' ? 'simulado' : 'treino'} da semana com ${plural(s.ids.length, 'questão', 'questões')}: ${partes.join(', ')}. ${p.acao === 'simulado' ? 'Boa prova!' : 'Bom treino!'}`)
      startCustom(s.ids, p.acao === 'simulado'); return
    }
    const chaves = p.provas?.length ? new Set(p.provas.map((x) => x.chave)) : null
    const materia = p.materia && p.materia !== 'todas' && p.materia !== 'edital' ? p.materia : null
    if (p.fonte === 'erros') {
      const cad = caderno()
      const lista = dosErros(cad, BANK.filter((q) => (!materia || q.m === materia) && (!chaves || chaves.has(q.s))), p.quantidade ?? ERROS_PADRAO)
      if (!lista.length) {
        diz(Object.keys(cad).length ? `Seu caderno de erros não tem questões ${descrever({ ...p, quantidade: undefined, fonte: undefined }).replace(/^(simulado|treino)( de todas as matérias)?/, '').trim() || 'para esse pedido'}. Tente sem esse filtro.` : 'Seu caderno de erros está vazio: ou você ainda não errou nenhuma questão, ou já superou todas com 3 acertos seguidos. Bom sinal! Que tal um treino?')
        return
      }
      dizOk(`Pronto: ${descrever({ ...p, quantidade: lista.length })}. ${p.acao === 'simulado' ? 'Boa prova!' : 'Bom treino!'}`)
      startCustom(lista.map((q) => q.id), p.acao === 'simulado'); return
    }
    if (p.fonte === 'novas') {
      const lista = pick(BANK.filter((q) => !prog[q.id]?.n && (!materia || q.m === materia) && (!chaves || chaves.has(q.s))), p.quantidade ?? TREINO_PADRAO, TF, prog)
      if (!lista.length) { diz('Você já respondeu todas as questões que cabem nesse pedido: não há nenhuma nova. Que tal rever o caderno de erros ou fazer o simulado da semana?'); return }
      dizOk(`Pronto: ${descrever({ ...p, quantidade: lista.length })}. ${p.acao === 'simulado' ? 'Boa prova!' : 'Bom treino!'}`)
      startCustom(lista.map((q) => q.id), p.acao === 'simulado'); return
    }
    const pool = BANK.filter((q) => (!materia || q.m === materia) && (!chaves || chaves.has(q.s)))
    if (!pool.length) { dizErro(`Não achei questões ${descrever({ ...p, quantidade: undefined }).replace(/^(simulado|treino)( de todas as matérias)?/, '').trim() || 'para esse pedido'}. Tente outra matéria ou prova.`); return }
    const pedida = p.quantidade ?? TREINO_PADRAO
    const n = Math.min(pedida, pool.length)
    dizOk(`Pronto: ${descrever({ ...p, quantidade: n })}${n < pedida ? ` (só tenho ${plural(pool.length, 'questão', 'questões')} disso)` : ''}. ${p.acao === 'simulado' ? 'Boa prova!' : 'Bom treino!'}`)
    startCustom(pick(pool, n, TF, prog).map((q) => q.id), p.acao === 'simulado')
  }

  /** O próximo passo de um pedido: executa se já tem tudo, senão pergunta o que falta (com opções para tocar). */
  const avancar = (p: Pedido) => {
    const passo = proximoPasso(p, contexto())
    if (passo.tipo === 'executar') { executarPedido(passo.pedido); return }
    diz(passo.texto)
    set({ pendente: { pedido: passo.pedido, slot: passo.slot, texto: passo.texto, opcoes: passo.opcoes } })
    ir('pergunta')
  }
  const iniciarPedido = (acao: AcaoPedido, e: Entidades = {}) => {
    if (!BANK.length) { dizErro('Este espaço ainda não tem questões. Importe uma prova primeiro.'); return }
    avancar(pedidoDe(acao, e))
  }

  /** A pessoa escreveu algo enquanto o assistente espera uma resposta. Devolve true se tratou (resposta, cancelar, "não entendi"); false se é outro pedido. */
  const responderEscrito = (t: string): boolean => {
    const pd = get().pendente
    if (!pd) return false
    const v = entenderResposta(pd.slot, t, contexto())
    if (v !== undefined) { avancar(preencher(pd.pedido, pd.slot, v)); return true }
    const i = entender(t)
    if (i.tipo === 'cancelar') { diz('Certo, deixei para lá.'); inicio(); return true }
    if (i.tipo === 'nao-entendi' || i.tipo === 'vazio') { diz(`Não entendi essa resposta. ${pd.texto}`); return true }
    set({ pendente: null })
    return false
  }

  const refazerDesfazer = async () => {
    const fn = acaoDesfazer, rotulo = get().desfazivel
    if (!fn) { diz('Não há nada para desfazer agora. Eu desfaço a última coisa que fiz por você: criar um espaço, guardar ou apagar um material, criar cartões.'); return }
    acaoDesfazer = null; set({ desfazivel: null })
    try { await fn(); set({ materiais: await listarMateriais(espacoAtivo()) }); dizOk(`Desfiz: ${rotulo}.`) } catch (e) { dizErro('Não consegui desfazer: ' + erroTexto(e)) }
    inicio()
  }
  const perguntarLimpar = () => { diz('Apagar toda a conversa? Isso não mexe nos seus materiais, questões nem cartões; só some o histórico daqui.'); ir('limpar') }

  const mostrarAjuda = () => diz(['Eu sei fazer isto, tudo aqui no seu aparelho:', ...ACOES.map((a) => `• ${a.rotulo}: ${a.resumo}`), 'Toque numa sugestão ou escreva o que quer (por exemplo: "importar prova").'].join('\n'))

  const executar = (id: IdAcao, e: Entidades = {}, texto = '') => {
    if (id === 'lembrete') { avancar(pedidoDe('lembrete', e)); return }
    if (id === 'plano') {
      // sem o tempo: mostra o dia e pergunta quanto tempo a pessoa tem; com o tempo: monta o plano
      if (!e.minutos) diz(textoDoPainel(montarPainel(entradaPainel()), Date.now()))
      avancar(pedidoDe('plano', e)); return
    }
    if (id === 'caderno') {
      // "rever erros de português", "treinar meus erros": direto; "caderno de erros": o painel com o resumo
      const direto = !!(e.materia || e.provas?.length || e.quantidade) || /\b(rever|revisar|refazer|treinar|estudar|resolver)\b/.test(semAcento(texto))
      if (direto) { iniciarPedido('treinar', { ...e, erros: true }); return }
      const r = resumirCaderno(caderno(), BANK)
      if (!r.total) { diz('Seu caderno de erros está vazio: ou você ainda não errou nenhuma questão, ou já superou todas com 3 acertos seguidos. Bom sinal! Que tal um treino?'); return }
      diz(`Seu caderno de erros tem ${plural(r.total, 'questão', 'questões')}: ${plural(r.naUltima, 'errada na última vez', 'erradas na última vez')} e ${plural(r.recuperando, 'já acertada', 'já acertadas')} 1 ou 2 vezes seguidas (saem do caderno com 3). Onde mais erra: ${r.porMateria.slice(0, 3).map((m) => `${m.materia} (${m.n})`).join(', ')}.`)
      ir('caderno')
      return
    }
    if (id === 'resumo' && (e.materia || e.provas?.length)) {
      const chaves = e.provas?.length ? new Set(e.provas.map((x) => x.chave)) : null
      const n = BANK.filter((q) => (!e.materia || q.m === e.materia) && (!chaves || chaves.has(q.s))).length
      const onde = [e.materia ? `de ${e.materia}` : '', e.provas?.length ? `na prova ${[...new Set(e.provas.map((x) => x.rotulo.split(' · ')[0]))].join(' e ')}` : ''].filter(Boolean).join(' ')
      diz(n ? `Neste espaço há ${plural(n, 'questão', 'questões')} ${onde}.` : `Não há questões ${onde} neste espaço.`)
      return
    }
    if (id === 'resumo') {
      const n = BANK.length, mats = ALL_SUBJECTS.filter((x) => BANK.some((q) => q.m === x.n)).length, provas = SOURCE_KEYS.length
      diz(`O espaço "${useEspacos.getState().lista.find((x) => x.id === useEspacos.getState().ativo)?.nome ?? ''}" tem ${plural(n, 'questão', 'questões')}, ${plural(mats, 'matéria', 'matérias')} e ${plural(provas, 'prova', 'provas')}.`)
      void listarMateriais(espacoAtivo()).then((l) => { if (l.length) diz(`E ${plural(l.length, 'material guardado', 'materiais guardados')} para consulta.`) })
      return
    }
    if (id === 'questoes') {
      if (ehBB()) { diz('As questões geradas entram em espaços seus (o do Banco do Brasil é fixo). Crie um espaço, guarde nele o material e peça de novo.'); ir('espaco-novo', { depois: 'questoes' }); return }
      void listarMateriais(espacoAtivo()).then((l) => {
        set({ materiais: l })
        if (!l.length) { diz('Para gerar questões preciso de um material seu neste espaço. Guarde um resumo ou apostila (PDF, TXT ou MD).'); ir('material-arquivo'); return }
        if (l.length === 1) { void get().gerarQuestoes(l[0].id); return }
        diz('De qual material quer gerar as questões?'); ir('questoes-material')
      })
      return
    }
    if (id === 'prova' && ehBB()) { diz('O espaço do Banco do Brasil não recebe arquivos. Para importar, preciso de um espaço seu: crie um agora (dá para começar com as questões do BB).'); ir('espaco-novo', { depois: 'prova' }); return }
    if (id === 'prova') { continuarDepoisDoEspaco('prova'); return }
    if (id === 'cartoes') { diz('Escolha o arquivo do resumo (PDF com texto, TXT ou MD).'); ir('cartoes-arquivo'); return }
    if (id === 'simulado' || id === 'treinar') { iniciarPedido(id, e); return }
    if (id === 'espaco' && e.espaco) {
      if (e.espaco.id === espacoAtivo()) { diz(`Já estamos no espaço "${e.espaco.nome}".`); return }
      const alvo = e.espaco
      void useEspacos.getState().ativar(alvo.id).then((ok) => { if (ok) dizOk(`Troquei para o espaço "${alvo.nome}".`); else dizErro('Não consegui trocar de espaço.') }).catch(() => dizErro('Não consegui trocar de espaço.'))
      return
    }
    if (id === 'espaco' && e.nome) { void get().criarEspaco(e.nome, false); return }
    if (id === 'espaco') { diz('Estes são os seus espaços. Toque em um para ativar, ou crie um novo.'); ir('espacos'); return }
    if (id === 'perguntar') { diz('Do que quer saber? Escreva, por exemplo: "o que é Copom?" ou "onde fala de inflação". Eu procuro nos seus materiais, questões e cartões.'); return }
    if (id === 'materiais') { void listarMateriais(espacoAtivo()).then((l) => { set({ materiais: l }); diz(l.length ? `Você tem ${plural(l.length, 'material guardado', 'materiais guardados')} neste espaço. Eu consulto todos quando você pergunta.` : 'Você ainda não guardou nenhum material neste espaço. Guarde um resumo, apostila ou anotações (PDF, TXT ou MD) e eu passo a poder responder sobre ele, mesmo sem internet.'); ir('materiais') }); return }
    if (id === 'ia') { diz('A ajuda de IA é opcional e usa a sua chave da Anthropic. Ela só é usada quando você toca em "Reler com IA" na prévia de uma prova.'); ir('ia'); return }
  }

  const continuarDepoisDoEspaco = (id: IdAcao | null) => {
    if (id === 'prova') { diz('Escolha o PDF da prova. Se tiver o do gabarito, escolha também (ou marque as respostas na prévia).'); ir('prova-arquivos') }
    else if (id === 'questoes') { diz('Agora guarde o material de onde saem as questões (PDF, TXT ou MD).'); ir('material-arquivo') }
    else inicio()
  }

  return {
    etapa: 'inicio', mensagens: [], ocupado: false, progresso: null, depois: null, previa: null, cartoes: null, resultado: null, materiais: [], sugestoes: {}, relendo: null, vistas: 0, desambiguar: [],
    pendente: null, ultimaProva: null, desfazivel: null, rascunho: '', carregada: false, epoca: 0, eventos: [], geradas: null, painel: null, painelMsgId: null, plano: null, planoAtivo: null, planoEmCurso: false, statusPlano: () => statusAgora(),
    painelAcao: (sug) => {
      voce(sug.rotulo)
      if (sug.id === 'cartoes') { useApp.getState().setTab('cartoes'); return }
      if (sug.id === 'erros') { iniciarPedido('treinar', { erros: true }); return }
      if (sug.id === 'fraca') { iniciarPedido('treinar', { materia: sug.materia }); return }
      if (sug.id === 'novas') { iniciarPedido('treinar', { novas: true }); return }
      if (sug.id === 'semana') { iniciarPedido('simulado', { tempo: 'semana' }); return }
      executar('prova')
    },
    planoAcao: (que) => {
      const pl = get().plano
      if (que === 'outro') { voce('Outro tempo'); avancar({ acao: 'plano' }); return }
      const st = statusAgora()
      if (!pl && !st) return
      if (que === 'cartoes') {
        voce(st && st.cartoesFeitos > 0 ? 'Continuar os cartões' : 'Começar pelos cartões')
        // abre direto o estudo; quando os cartões do plano acabarem, os Cards levam às questões (concluirCartoesDoPlano)
        set({ planoEmCurso: true }); useCards.getState().pedirEstudo(true); useApp.getState().setTab('cartoes'); return
      }
      const ids = st ? st.questoesFaltam : pl!.questoes.ids
      if (!ids.length) { voce('Fazer as questões'); dizOk('Você já fez todas as questões do plano. Que tal montar outro?'); return }
      voce(st && st.questoesFeitas > 0 ? 'Continuar as questões' : `Fazer as ${ids.length} questões`)
      dizOk(`Pronto: ${plural(ids.length, 'questão', 'questões')} do plano${st && st.questoesFeitas > 0 ? ' que ainda faltavam' : ` de ${pl ? pl.minutos : planoDeHoje()?.minutos} minutos`}. Bom treino!`)
      set({ planoEmCurso: false }); inicio(); useApp.getState().startCustom(ids, false)
    },
    concluirCartoesDoPlano: () => {
      if (!get().planoEmCurso || !planoDeHoje()) return
      set({ planoEmCurso: false })
      const s = statusAgora()
      if (s && s.questoesFaltam.length) { useApp.getState().showToast(AVISOS.cartoesDoPlanoFeitos); useApp.getState().startCustom(s.questoesFaltam, false) }
      else useApp.getState().setTab('assistente') // não há mais questões: volta aqui, onde o balão diz que o plano acabou
    },
    gerarQuestoes: async (materialId) => {
      if (get().ocupado) return
      const mat = get().materiais.find((x) => x.id === materialId) ?? (await listarMateriais(espacoAtivo())).find((x) => x.id === materialId)
      if (!mat) { dizErro('Não achei esse material. Abra "Meus materiais" e tente de novo.'); return }
      voce(`Gerar questões de "${mat.nome}"`)
      ir('lendo', { ocupado: true, progresso: { texto: 'Lendo o material e montando as questões…', pct: 30 } })
      try {
        const textos = (await trechosDoMaterial(mat.id)).sort((a, b) => a.i - b.i).map((t) => t.t)
        const geracao = gerarQuestoes(textos, { id: mat.id, nome: mat.nome })
        set({ ocupado: false, progresso: null })
        if (!geracao.questoes.length) {
          const motivos = [...new Set(geracao.descartadas.map((d) => d.motivo))].slice(0, 2).join('; ')
          diz(geracao.fatos ? `Achei ${plural(geracao.fatos, 'fato', 'fatos')} no material, mas nenhuma questão saiu${motivos ? ' (' + motivos + ')' : ''}. Para gerar questões preciso de pelo menos 5 definições, siglas ou perguntas do mesmo tipo, para ter alternativas erradas parecidas.` : 'Não achei definições, siglas, números nem perguntas neste material (o formato "Termo: definição", "SIGLA – expansão" ou "Pergunta::Resposta" ajuda). Nenhuma questão saiu.')
          ir('material-pronto'); return
        }
        const g = geracao
        diz(`Montei ${plural(g.questoes.length, 'questão', 'questões')} de "${mat.nome}", a partir de ${plural(g.fatos, 'fato', 'fatos')} do material.${g.descartadas.length ? ` ${plural(g.descartadas.length, 'fato não rendeu questão', 'fatos não renderam questão')} (poucas alternativas parecidas, ou alternativas longas demais).` : ''} Confira as alternativas e desmarque o que não servir.`)
        if (g.ignorados.length) diz(`Deixei de fora ${g.ignorados.join(' e ')}: não é conteúdo para estudar.`)
        set({ geradas: { material: mat, geracao: g, escolhidas: g.questoes.map((_, i) => i) } })
        ir('questoes-previa')
      } catch (e) { dizErro('Não consegui gerar as questões: ' + erroTexto(e)); set({ ocupado: false, progresso: null }); ir('material-pronto') }
    },
    alternarGerada: (i) => set((s) => (s.geradas ? { geradas: { ...s.geradas, escolhidas: s.geradas.escolhidas.includes(i) ? s.geradas.escolhidas.filter((x) => x !== i) : [...s.geradas.escolhidas, i] } } : {})),
    confirmarGeradas: async () => {
      const g = get().geradas
      if (!g || get().ocupado) return
      const lista = g.escolhidas.slice().sort((a, b) => a - b).map((i) => g.geracao.questoes[i]?.q).filter(Boolean)
      if (!lista.length) { dizErro('Escolha ao menos uma questão.'); return }
      set({ ocupado: true })
      try {
        const m = g.geracao.meta
        voce(`Adicionar ${plural(lista.length, 'questão', 'questões')}`)
        const r = await useEspacos.getState().adicionar(lista, { fontes: { [m.chave]: m.rotulo }, bancos: [{ id: m.bancoId, nome: m.bancoNome }] })
        const texto = `${plural(r.adicionadas, 'questão entrou', 'questões entraram')} em "${m.rotulo.split(' · ')[0]}"${r.repetidas ? ` (${plural(r.repetidas, 'já estava', 'já estavam')}: não duplicou)` : ''}`
        dizOk(`${texto}. Treine na aba Treinar: elas aparecem como uma prova própria e pesam metade das de prova real no sorteio.`)
        set({ ocupado: false, geradas: null, ultimaProva: { chave: m.chave, rotulo: m.rotulo }, resultado: { texto, treinar: true, n: r.adicionadas } })
        ir('prova-pronta')
      } catch (e) { dizErro('Não consegui adicionar: ' + erroTexto(e)); set({ ocupado: false }) }
    },
    estadoDoDia: async () => { await get().atualizarCaderno(); const e = entradaPainel(); return estadoDoDiaDe(montarPainel(e), cartoesPorDia(e.cartoes, e.ajustes, e.agora)) },
    atualizarCaderno: async () => { try { set({ eventos: await lerEventos() }) } catch { /* sem eventos: vale o progresso agregado */ } },
    cadernoAcao: (que) => {
      if (que === 'rever') { voce('Rever o caderno'); iniciarPedido('treinar', { erros: true }) }
      else if (que === 'simulado') { voce('Simulado só dos erros'); iniciarPedido('simulado', { erros: true }) }
      else { voce(`Rever só ${que.rotulo}`); iniciarPedido('treinar', { erros: true, materia: que.materia }) }
    },
    carregarHistorico: async () => {
      if (historicoLido) return
      historicoLido = true
      try {
        const rows = await naFila(lerConversa)
        if (rows.length && !get().mensagens.length) {
          gravadas = rows[rows.length - 1].id; msgId = Math.max(msgId, gravadas)
          set({ mensagens: rows as Msg[], vistas: rows.length })
        }
      } catch { /* sem histórico guardado: a conversa começa do zero */ }
    },
    iniciarConversa: async () => { await abrir(false) },
    abrirAba: async () => { await abrir(true) },
    ajuda: () => { voce('O que você sabe fazer?'); mostrarAjuda() },
    marcarVistas: (n) => set((st) => (n > st.vistas ? { vistas: n } : {})),
    voltarAoInicio: () => inicio(),
    digitar: (t) => set({ rascunho: t.slice(0, 200) }),
    escolher: (id) => { set({ desambiguar: [], pendente: null }); voce(acaoPorId(id).sugestao); executar(id) },
    responder: (o) => {
      const pd = get().pendente
      if (!pd) return
      voce(o.rotulo); avancar(preencher(pd.pedido, pd.slot, o.valor))
    },
    cancelarPergunta: () => { voce('Cancelar'); diz('Certo, deixei para lá.'); inicio() },
    desfazer: () => { voce('Desfazer'); void refazerDesfazer() },
    pedirLimpar: () => { voce('Limpar a conversa'); perguntarLimpar() },
    limparConversa: async () => {
      await naFila(limparConversaSalva).catch(() => {})
      acaoDesfazer = null
      set((st) => ({ mensagens: [], vistas: 0, epoca: st.epoca + 1, desfazivel: null, rascunho: '' })); inicio()
      await get().iniciarConversa()
    },
    procurar: (t) => { set({ rascunho: '' }); voce(t); void get().perguntar(t) },
    enviar: (texto) => {
      const t = texto.trim().slice(0, 200)
      if (!t) return
      set({ rascunho: '' })
      voce(t)
      if (get().pendente && responderEscrito(t)) return
      const ent = extrairEntidades(t, contexto())
      const i = ajustarPelasEntidades(entender(t), ent, t)
      set({ desambiguar: [] })
      if (i.tipo === 'desfazer') { void refazerDesfazer(); return }
      if (i.tipo === 'limpar') { perguntarLimpar(); return }
      if (i.tipo === 'acao') { executar(i.id, ent, t); return }
      if (i.tipo === 'perguntar') { void get().perguntar(t); return }
      if (i.tipo === 'ajuda') { mostrarAjuda(); return }
      if (i.tipo === 'oi') { diz('Oi! Em que posso ajudar? Toque numa sugestão ou escreva, por exemplo, "importar prova".'); return }
      if (i.tipo === 'obrigado') { diz('De nada! Se precisar de mais alguma coisa, é só falar.'); return }
      if (i.tipo === 'cancelar') { diz('Certo, não há nada em andamento. O que mais quer fazer?'); return }
      if (i.tipo === 'ambigua') { diz(`Quer ${acaoPorId(i.opcoes[0]).sugestao.toLowerCase()} ou ${acaoPorId(i.opcoes[1]).sugestao.toLowerCase()}? Toque numa das opções.`); set({ desambiguar: i.opcoes }); return }
      void consultar(t).then((rr) => { // não é um comando: se for o nome de algo que a pessoa guardou, responde com o que achou
        if (rr.achados.length && !rr.achados.every((a) => a.parcial)) void get().perguntar(t)
        else diz(NAO_ENTENDI)
      }).catch(() => diz(NAO_ENTENDI))
    },
    carregarMateriais: async () => { set({ materiais: await listarMateriais(espacoAtivo()) }) },
    guardarMaterial: async (f) => {
      if (get().ocupado) return
      voce(`Material: ${f.name}`)
      ir('lendo', { ocupado: true, progresso: { texto: 'Começando…', pct: 0 } })
      try {
        const { paragrafos, avisos } = await paragrafosDoArquivo(f, progresso)
        const p = prepararMaterial(espacoAtivo(), f.name, tipoDoArquivo(f), paragrafos)
        if (!p.ok) { dizErro(p.erro, ...avisos); set({ ocupado: false, progresso: null }); ir('material-arquivo'); return }
        const novo = await salvarMaterial(p.material, p.trechos)
        if (!novo) diz(`Esse material já estava guardado neste espaço ("${p.material.nome}"). Não dupliquei.`)
        else { definirDesfazer(`guardar "${p.material.nome}"`, async () => { await apagarMaterial(p.material.id) }) }
        if (novo) dizOk(`Guardei "${p.material.nome}": ${plural(p.material.trechos, 'trecho', 'trechos')}, ${Math.round(p.material.caracteres / 1000)} mil letras. Já posso responder sobre ele.`, ...avisos)
        set({ ocupado: false, progresso: null, materiais: await listarMateriais(espacoAtivo()) })
        ir('material-pronto')
      } catch (e) { dizErro('Não consegui guardar o material: ' + erroTexto(e)); set({ ocupado: false, progresso: null }); ir('material-arquivo') }
    },
    apagarMaterial: async (id) => {
      const mat = get().materiais.find((x) => x.id === id)
      const nome = mat?.nome ?? 'o material'
      const trechos = mat ? await trechosDoMaterial(id) : []
      await apagarMaterial(id)
      if (mat) definirDesfazer(`apagar "${nome}"`, async () => { await salvarMaterial(mat, trechos) })
      set({ materiais: await listarMateriais(espacoAtivo()) })
      voce(`Apagar "${nome}"`); dizOk(`Apaguei "${nome}" e todos os trechos dele. As suas questões e cartões não foram tocados.`)
    },
    perguntar: async (texto) => {
      try {
        const r = await consultar(texto)
        if (!r.consulta) { diz('Do que quer saber? Escreva, por exemplo: "o que é Copom?".'); return }
        if (!r.documentos) { diz('Ainda não tenho nada para procurar neste espaço. Guarde um material em "Meus materiais" (ou importe uma prova).'); return }
        if (!r.achados.length) { diz(`Não achei "${r.consulta}" nos seus materiais, questões nem cartões. Tente outra palavra ou guarde um material sobre o assunto.`); return }
        const parcial = r.achados.every((a) => a.parcial)
        set((st) => ({ mensagens: [...st.mensagens, m('a', parcial ? `Não achei tudo junto, mas estes trechos falam de partes de "${r.consulta}":` : `Achei ${plural(r.achados.length, 'resultado', 'resultados')} para "${r.consulta}":`, undefined, r.achados)] }))
      } catch (e) { dizErro('Não consegui procurar agora: ' + erroTexto(e)) }
    },
    novoEspaco: () => { diz('Dê um nome ao espaço e escolha como começar.'); ir('espaco-novo', { depois: null }) },
    criarEspaco: async (nome, usaBB) => {
      if (get().ocupado) return
      set({ ocupado: true })
      try {
        const depois = get().depois
        const antes = espacoAtivo()
        const id = await useEspacos.getState().criar(nome, usaBB)
        definirDesfazer(`criar o espaço "${nome.trim() || 'Meu espaço'}"`, async () => { await useEspacos.getState().apagar(id); if (antes !== 'bb') await useEspacos.getState().ativar(antes) })
        voce(`Criar o espaço "${nome.trim() || 'Meu espaço'}"${usaBB ? ' com as questões do BB' : ''}`)
        dizOk('Espaço criado e ativo.')
        set({ ocupado: false }); continuarDepoisDoEspaco(depois)
      } catch (e) { dizErro('Não consegui criar o espaço: ' + erroTexto(e)); set({ ocupado: false }) }
    },
    lerProva: async (prova, gabarito) => {
      if (get().ocupado) return
      voce(`Prova: ${prova.name}${gabarito ? ` · gabarito: ${gabarito.name}` : ' · sem gabarito'}`)
      ir('lendo', { ocupado: true, progresso: { texto: 'Começando…', pct: 0 } })
      try {
        const prep = await prepararProva(prova, gabarito, progresso)
        const qs = prep.lida.questoes
        const comGab = prep.gabarito ? qs.filter((q) => q.numero in prep.gabarito!.respostas).length : 0
        diz(
          qs.length
            ? `Li ${plural(qs.length, 'questão', 'questões')} em ${plural(prep.paginas, 'página', 'páginas')}${prep.gabarito ? `; o gabarito cobre ${comGab}` : ''}. Confira a prévia antes de adicionar.`
            : 'Não encontrei questões. O PDF pode ser escaneado (só imagem) ou ter um formato que ainda não conheço.',
          ...prep.lida.avisos.map((x) => `Aviso: ${x}.`), ...(prep.gabarito?.avisos ?? []).map((x) => `Gabarito: ${x}.`),
        )
        if (!qs.length) { set({ ocupado: false, progresso: null }); ir('prova-arquivos'); return }
        const ok = (q: QuestaoLida) => Object.keys(q.alternativas).length >= 2
        set({ ocupado: false, progresso: null, previa: { prep, rotulo: prep.meta.rotulo, escolhidas: qs.filter(ok).map((q) => q.numero), manual: {}, imagens: 'figuras' } })
        ir('prova-previa')
      } catch (e) { dizErro('Não consegui ler o arquivo: ' + erroTexto(e)); set({ ocupado: false, progresso: null }); ir('prova-arquivos') }
    },
    alternarQuestao: (n) => set((s) => (s.previa ? { previa: { ...s.previa, escolhidas: s.previa.escolhidas.includes(n) ? s.previa.escolhidas.filter((x) => x !== n) : [...s.previa.escolhidas, n] } } : {})),
    marcarResposta: (n, l) => set((s) => (s.previa ? { previa: { ...s.previa, manual: { ...s.previa.manual, [n]: l } } } : {})),
    setRotulo: (t) => set((s) => (s.previa ? { previa: { ...s.previa, rotulo: t.slice(0, 80) } } : {})),
    setImagens: (q) => set((s) => (s.previa ? { previa: { ...s.previa, imagens: q } } : {})),
    confirmarProva: async () => {
      const p = get().previa
      if (!p || get().ocupado) return
      set({ ocupado: true })
      try {
        const meta: MetaProva = { ...p.prep.meta, rotulo: p.rotulo.trim() || p.prep.meta.rotulo }
        const respostas = { ...(p.prep.gabarito?.respostas ?? {}), ...p.manual }
        const mont = montarQuestoes(p.prep.lida.questoes, respostas, meta, new Set(p.escolhidas))
        if (!mont.questoes.length) { dizErro('Nenhuma das questões escolhidas pode entrar (falta gabarito ou alternativas). Marque as respostas na prévia.'); set({ ocupado: false }); return }
        voce(`Adicionar ${plural(mont.questoes.length, 'questão', 'questões')}`)
        const espaco = useEspacos.getState().ativo
        const comImg = await anexarImagens(p.prep, mont.questoes, espaco, p.imagens, progresso)
        const r = await useEspacos.getState().adicionar(comImg.questoes, { fontes: { [meta.chave]: meta.rotulo }, bases: mont.bases, bancos: [{ id: meta.bancoId, nome: meta.bancoNome }] })
        const partes = [`${plural(r.adicionadas, 'questão entrou', 'questões entraram')} em "${meta.rotulo}"`]
        if (r.repetidas) partes.push(`${plural(r.repetidas, 'já estava', 'já estavam')} (não duplicou)`)
        if (mont.ignoradas.length) partes.push(`${plural(mont.ignoradas.length, 'ficou de fora', 'ficaram de fora')}: ${mont.ignoradas.slice(0, 6).map((x) => `Q${x.numero} (${x.motivo})`).join(', ')}${mont.ignoradas.length > 6 ? '…' : ''}`)
        if (comImg.falhas) partes.push(`${plural(comImg.falhas, 'imagem não pôde ser recortada', 'imagens não puderam ser recortadas')}`)
        await p.prep.doc?.destroy?.()
        dizOk(partes.join('. ') + '.')
        set({ ocupado: false, progresso: null, previa: null, ultimaProva: { chave: meta.chave, rotulo: meta.rotulo }, resultado: { texto: partes[0], treinar: true, n: r.adicionadas } })
        ir('prova-pronta')
      } catch (e) { dizErro('Não consegui adicionar: ' + erroTexto(e)); set({ ocupado: false, progresso: null }) }
    },
    releer: async (n) => {
      const p = get().previa
      const q = p?.prep.lida.questoes.find((x) => x.numero === n)
      if (!p || !q || get().relendo !== null) return
      const chave = lerChave()
      if (!chave) { dizErro('Para reler com IA, cole a sua chave em "Ajuda de IA".'); return }
      set({ relendo: n })
      try {
        const imagem = p.prep.doc ? await recortarQuestao(p.prep.doc, q.regioes).catch(() => null) : null
        const s = await relerComIA({ chave, modelo: lerModelo(), questao: q, imagem })
        set((st) => ({ sugestoes: { ...st.sugestoes, [n]: s }, relendo: null }))
      } catch (e) { dizErro(`Q${n}: ${mensagemErroIA(e)}`); set({ relendo: null }) }
    },
    aceitarIA: (n) => set((st) => {
      const s = st.sugestoes[n], p = st.previa
      if (!s || !p) return {}
      const questoes = p.prep.lida.questoes.map((q) => (q.numero === n ? aplicarSugestao(q, s) : q))
      const { [n]: _usada, ...resto } = st.sugestoes; void _usada
      return { sugestoes: resto, previa: { ...p, prep: { ...p.prep, lida: { ...p.prep.lida, questoes } } } }
    }),
    descartarIA: (n) => set((st) => { const { [n]: _x, ...resto } = st.sugestoes; void _x; return { sugestoes: resto } }),
    lerCartoes: async (f) => {
      if (get().ocupado) return
      voce(`Resumo: ${f.name}`)
      ir('lendo', { ocupado: true, progresso: { texto: 'Começando…', pct: 0 } })
      try {
        const { paragrafos, avisos } = await paragrafosDoArquivo(f, progresso)
        const sug = sugerirCartoes(paragrafos)
        // o resumo também fica guardado para consulta ("perguntar ao meu material"); se for grande demais ou já estiver guardado, segue sem avisar
        const guardado = prepararMaterial(espacoAtivo(), f.name, tipoDoArquivo(f), paragrafos)
        const novoMaterial = guardado.ok ? await salvarMaterial(guardado.material, guardado.trechos).catch(() => false) : false
        diz(
          sug.cartoes.length ? `Achei ${plural(sug.cartoes.length, 'cartão', 'cartões')} em ${plural(sug.paragrafos, 'parágrafo', 'parágrafos')}. ${sug.sobraram ? `${plural(sug.sobraram, 'parágrafo ficou', 'parágrafos ficaram')} de fora (sem padrão de definição). ` : ''}${sug.descartados.length ? `${plural(sug.descartados.length, 'cartão foi barrado', 'cartões foram barrados')} pelas regras de qualidade (por exemplo: ${sug.descartados[0].motivo}). ` : ''}Escolha os que quer.` : sug.descartados.length ? `Os padrões que reconheci (${plural(sug.descartados.length, 'cartão', 'cartões')}) foram barrados pelas regras de qualidade, por exemplo: ${sug.descartados[0].motivo}.` : 'Não achei trechos no formato "termo: definição", nem listas, siglas ou a sua marcação (Pergunta::Resposta, ==lacuna==) que eu reconheça.',
          ...(novoMaterial ? ['Guardei o resumo para você consultar depois: é só perguntar (por exemplo "o que é …?").'] : []),
          ...(sug.ignorados ? [`Deixei de fora ${sug.motivosIgnorados.join(' e ')}: não é conteúdo para estudar.`] : []),
          ...avisos,
        )
        if (!sug.cartoes.length) { set({ ocupado: false, progresso: null }); ir('cartoes-arquivo'); return }
        set({ ocupado: false, progresso: null, cartoes: { sug, escolhidos: sug.cartoes.map((_, i) => i), nome: f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').slice(0, 40), arquivo: f.name, avisos } })
        ir('cartoes-previa')
      } catch (e) { dizErro('Não consegui ler o arquivo: ' + erroTexto(e)); set({ ocupado: false, progresso: null }); ir('cartoes-arquivo') }
    },
    alternarCartao: (i) => set((s) => (s.cartoes ? { cartoes: { ...s.cartoes, escolhidos: s.cartoes.escolhidos.includes(i) ? s.cartoes.escolhidos.filter((x) => x !== i) : [...s.cartoes.escolhidos, i] } } : {})),
    setNomeBaralho: (t) => set((s) => (s.cartoes ? { cartoes: { ...s.cartoes, nome: t.slice(0, 40) } } : {})),
    confirmarCartoes: () => {
      const c = get().cartoes
      if (!c) return
      const lista = c.escolhidos.slice().sort((a, b) => a - b).map((i) => c.sug.cartoes[i]).filter(Boolean)
      if (!lista.length) { dizErro('Escolha ao menos um cartão.'); return }
      const nome = c.nome.trim() || 'Resumo importado'
      const cards = useCards.getState()
      let b = cards.baralhos.find((x) => x.nome.trim().toLowerCase() === nome.toLowerCase())?.id ?? null
      if (!b) b = cards.novoBaralho(nome)
      if (!b) { dizErro('Não consegui criar o baralho (nome vazio ou repetido). Mude o nome.'); return }
      const criou = !cards.baralhos.some((x) => x.id === b)
      const novos: string[] = []
      for (const x of lista) for (const c of useCards.getState().adicionar(b, x.f, x.v)) novos.push(c.id)
      const n = novos.length
      const baralho = b
      definirDesfazer(`criar o baralho "${nome}"`, async () => { const uc = useCards.getState(); if (criou) uc.excluirBaralho(baralho); else for (const id of novos) uc.excluirCartao(id) })
      voce(`Criar o baralho "${nome}" com ${plural(lista.length, 'cartão', 'cartões')}`)
      dizOk(`${plural(n, 'cartão entrou', 'cartões entraram')} no baralho "${nome}". Estude na aba Cards.`)
      set({ cartoes: null, resultado: { texto: `${plural(n, 'cartão entrou', 'cartões entraram')} no baralho "${nome}".`, n } })
      ir('cartoes-pronto')
    },
  }
})

/** Guarda no aparelho cada fala nova (o histórico volta na próxima abertura do app). */
useAssistente.subscribe((st, ant) => {
  if (st.mensagens === ant.mensagens) return
  const novas = st.mensagens.filter((x) => x.id > gravadas)
  if (!novas.length) return
  gravadas = novas[novas.length - 1].id
  void naFila(() => gravarConversa(novas.map((x) => ({ id: x.id, de: x.de, texto: x.texto, ...(x.tipo ? { tipo: x.tipo } : {}), ...(x.achados ? { achados: x.achados } : {}) })))).catch(() => { /* o histórico é um apoio: falhar em guardar não pode travar a conversa */ })
})
