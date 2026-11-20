// Cópia de segurança do que só existe NESTE aparelho: os espaços de estudo que a pessoa criou, as questões importadas ou geradas, as imagens recortadas das provas e os materiais
// (com os trechos). Desde a versão 2 (2026-11-18, C-8) o arquivo leva TAMBÉM o estudo: progresso por questão, histórico (dias e simulados), baralhos, cartões e o histórico dos cards;
// cópias da versão 1 (sem esses campos) continuam valendo e restauram como antes. Puro: sem banco, sem DOM, sem arquivo (quem lê e grava é services/copia.ts).
// Restaurar só ACRESCENTA ou JUNTA, nunca apaga nem diminui: conteúdo por ids de conteúdo; baralhos e cartões por id (o que já existe fica como está); progresso fica com o registro de mais
// respostas por questão; histórico fica com o maior número do dia e a união dos simulados.
import { limparCards, type Baralho, type Cartao } from './cards'
import { MAX_SIMS, limparHist, limparMarks, type Hist, type Marks } from './historico'
import type { Progress, ProgressMap } from './types'

export const VERSAO_COPIA = 2
/** Acima disto a cópia não cabe no arquivo (a ponte do app com o Android passa o texto inteiro de uma vez). */
export const TAMANHO_MAX_COPIA = 50 * 1024 * 1024

type Linha = { id: string } & Record<string, unknown>
/** Uma imagem recortada de prova: `dados` é o arquivo da imagem em base64. */
export interface ImagemCopiada { id: string; e: string; tipo: string; dados: string }

/** Progresso, histórico e cartões: o que a pessoa estudou. */
export interface Estudo { baralhos: Baralho[]; cartoes: Cartao[]; prog: ProgressMap; hist: Hist; histCartoes: Hist
  /** Marcações ("Marcar") e anotações por questão. */
  marks: Marks }
export const estudoVazio = (): Estudo => ({ baralhos: [], cartoes: [], prog: {}, hist: { dias: {}, sims: [] }, histCartoes: { dias: {}, sims: [] }, marks: {} })

export interface Copia {
  app: 'logos'
  versao: number
  /** Quando a cópia foi feita (ms). */
  em: number
  espacos: Linha[]
  questoes: Linha[]
  imagens: ImagemCopiada[]
  materiais: Linha[]
  trechos: Linha[]
  /** O estudo (versão 2): vazio em cópias da versão 1. */
  estudo: Estudo
}

export type ConteudoLocal = Pick<Copia, 'espacos' | 'questoes' | 'imagens' | 'materiais' | 'trechos'>

export const montarCopia = (c: ConteudoLocal, agora: number, estudo: Estudo = estudoVazio()): Copia => ({ app: 'logos', versao: VERSAO_COPIA, em: agora, ...c, estudo })

const dois = (n: number) => String(n).padStart(2, '0')
/** "logos-copia-2026-11-17.json" (a data do aparelho). */
export const nomeDoArquivo = (agora: number): string => { const d = new Date(agora); return `logos-copia-${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}.json` }

export interface Resumo { espacos: number; questoes: number; imagens: number; materiais: number; trechos: number }
export const resumir = (c: ConteudoLocal): Resumo => ({ espacos: c.espacos.length, questoes: c.questoes.length, imagens: c.imagens.length, materiais: c.materiais.length, trechos: c.trechos.length })
/** Há conteúdo (espaços, questões, materiais) que só existe neste aparelho? */
export const temConteudo = (r: Resumo): boolean => r.espacos + r.questoes + r.materiais > 0

const ehObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const comId = (x: unknown): x is Linha => ehObjeto(x) && typeof x.id === 'string' && x.id.length > 0
const ehImagem = (x: unknown): x is ImagemCopiada => ehObjeto(x) && typeof x.id === 'string' && typeof x.e === 'string' && typeof x.tipo === 'string' && typeof x.dados === 'string'

export type Leitura = { ok: true; copia: Copia } | { ok: false; erro: string }

/** Lê o texto de um arquivo de cópia e confere o formato. Nunca lança: erro vira mensagem para a pessoa. */
export function lerCopia(texto: string): Leitura {
  let o: unknown
  try { o = JSON.parse(texto) } catch { return { ok: false, erro: 'Este arquivo não é uma cópia do Logos (não consegui ler o conteúdo).' } }
  if (!ehObjeto(o) || o.app !== 'logos') return { ok: false, erro: 'Este arquivo não é uma cópia do Logos.' }
  if (typeof o.versao !== 'number' || o.versao > VERSAO_COPIA) return { ok: false, erro: 'Esta cópia foi feita por uma versão mais nova do Logos. Atualize o aplicativo e tente de novo.' }
  const lista = (k: string): unknown[] | null => (Array.isArray(o[k]) ? (o[k] as unknown[]) : null)
  const [espacos, questoes, imagens, materiais, trechos] = ['espacos', 'questoes', 'imagens', 'materiais', 'trechos'].map(lista)
  if (!espacos || !questoes || !imagens || !materiais || !trechos) return { ok: false, erro: 'A cópia está incompleta (faltam partes do arquivo).' }
  if (!espacos.every(comId) || !questoes.every(comId) || !materiais.every(comId) || !trechos.every(comId) || !imagens.every(ehImagem)) return { ok: false, erro: 'A cópia está danificada (há itens que não consigo ler).' }
  return { ok: true, copia: { app: 'logos', versao: o.versao, em: typeof o.em === 'number' ? o.em : 0, espacos: espacos as Linha[], questoes: questoes as Linha[], imagens: imagens as ImagemCopiada[], materiais: materiais as Linha[], trechos: trechos as Linha[], estudo: lerEstudo(o.estudo) } }
}

/** O estudo de uma cópia (versão 2), limpo: item inválido é descartado; cartão sem baralho também. Cópia antiga (sem o campo) = vazio. */
function lerEstudo(x: unknown): Estudo {
  if (!ehObjeto(x)) return estudoVazio()
  const cards = limparCards({ baralhos: x.baralhos, cartoes: x.cartoes }, limparHist)
  const prog: ProgressMap = {}
  if (ehObjeto(x.prog)) for (const [id, v] of Object.entries(x.prog)) if (ehObjeto(v) && typeof v.n === 'number' && typeof v.c === 'number' && v.n >= 0 && v.c >= 0) prog[id] = v as unknown as Progress
  return { baralhos: cards.baralhos, cartoes: cards.cartoes, prog, hist: limparHist(x.hist), histCartoes: limparHist(x.histCartoes), marks: limparMarks(x.marks) }
}

// ---------- o estudo: juntar o da cópia com o do aparelho (nunca perde nem diminui) ----------
export interface ResumoEstudo { baralhos: number; cartoes: number; questoesVistas: number; diasEstudados: number; simulados: number; marcacoes: number }
export const resumirEstudo = (e: Estudo): ResumoEstudo => ({
  baralhos: e.baralhos.length, cartoes: e.cartoes.length, questoesVistas: Object.keys(e.prog).length,
  diasEstudados: Object.keys(e.hist.dias).length, simulados: e.hist.sims.length, marcacoes: Object.keys(e.marks).length,
})
export const temEstudo = (r: ResumoEstudo): boolean => r.baralhos + r.cartoes + r.questoesVistas + r.diasEstudados + r.simulados + r.marcacoes > 0

/** Junta dois históricos: em cada dia vale o de mais respostas; os simulados são a união (o mesmo instante não repete). */
export function juntarHist(local: Hist, copia: Hist): Hist {
  const dias = { ...local.dias }
  for (const [k, d] of Object.entries(copia.dias)) if (!dias[k] || d.n > dias[k].n) dias[k] = d
  const tem = new Set(local.sims.map((s) => s.t))
  const sims = [...local.sims, ...copia.sims.filter((s) => !tem.has(s.t))].sort((a, b) => a.t - b.t).slice(-MAX_SIMS)
  return { dias, sims }
}
/** Junta o estudo da cópia no do aparelho. `novos` conta só o que a cópia trouxe (o que já estava, ou o que o aparelho tem de mais, não conta). */
export function juntarEstudo(local: Estudo, copia: Estudo): { estudo: Estudo; novos: ResumoEstudo } {
  const bIds = new Set(local.baralhos.map((b) => b.id)), cIds = new Set(local.cartoes.map((c) => c.id))
  const baralhosNovos = copia.baralhos.filter((b) => !bIds.has(b.id))
  const baralhosTodos = new Set([...bIds, ...baralhosNovos.map((b) => b.id)])
  const cartoesNovos = copia.cartoes.filter((c) => !cIds.has(c.id) && baralhosTodos.has(c.b))
  const prog: ProgressMap = { ...local.prog }
  let questoesVistas = 0
  for (const [id, p] of Object.entries(copia.prog)) { const l = prog[id]; if (!l || p.n > l.n) { prog[id] = p; questoesVistas++ } }
  const hist = juntarHist(local.hist, copia.hist), histCartoes = juntarHist(local.histCartoes, copia.histCartoes)
  const marks: Marks = { ...local.marks }
  let marcacoes = 0
  for (const [id, m] of Object.entries(copia.marks)) { const l = marks[id]; if (!l || m.t > l.t) { marks[id] = m; marcacoes++ } } // a alteração mais recente de cada questão vence
  const diasEstudados = Object.keys(hist.dias).filter((k) => hist.dias[k] !== local.hist.dias[k]).length
  const simulados = hist.sims.filter((s) => !local.hist.sims.some((x) => x.t === s.t)).length
  return {
    estudo: { baralhos: [...local.baralhos, ...baralhosNovos], cartoes: [...local.cartoes, ...cartoesNovos], prog, hist, histCartoes, marks },
    novos: { baralhos: baralhosNovos.length, cartoes: cartoesNovos.length, questoesVistas, diasEstudados, simulados, marcacoes },
  }
}

export interface IdsLocais { espacos: ReadonlySet<string>; questoes: ReadonlySet<string>; imagens: ReadonlySet<string>; materiais: ReadonlySet<string>; trechos: ReadonlySet<string> }
export interface Plano { acrescentar: ConteudoLocal; novos: Resumo; jaExistiam: Resumo }

/** O que da cópia ainda falta neste aparelho (e o que já estava): restaurar só acrescenta. */
/** A chave de uma questão ou imagem importada: o ESPAÇO e o id (a mesma questão em dois espaços são duas linhas; desde a F6.2 do banco, v8). */
export const chaveLinha = (x: { e?: unknown; id: string }) => `${typeof x.e === 'string' ? x.e : ''}|${x.id}`
export function planoDeRestauracao(c: Copia, locais: IdsLocais): Plano {
  const falta = <T extends { id: string }>(lista: readonly T[], ja: ReadonlySet<string>, chave: (x: T) => string = (x) => x.id) => lista.filter((x) => !ja.has(chave(x)))
  const acrescentar: ConteudoLocal = {
    espacos: falta(c.espacos, locais.espacos), questoes: falta(c.questoes, locais.questoes, chaveLinha), imagens: falta(c.imagens, locais.imagens, chaveLinha),
    materiais: falta(c.materiais, locais.materiais), trechos: falta(c.trechos, locais.trechos),
  }
  const novos = resumir(acrescentar), todos = resumir(c)
  return { acrescentar, novos, jaExistiam: { espacos: todos.espacos - novos.espacos, questoes: todos.questoes - novos.questoes, imagens: todos.imagens - novos.imagens, materiais: todos.materiais - novos.materiais, trechos: todos.trechos - novos.trechos } }
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const juntar = (partes: string[]) => (!partes.length ? 'nada' : partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`)
/** "2 espaços, 140 questões e 3 materiais" (só o que tem; imagens e trechos são detalhe e não entram). */
export function textoDoResumo(r: Resumo): string {
  return juntar([r.espacos && plural(r.espacos, 'espaço', 'espaços'), r.questoes && plural(r.questoes, 'questão', 'questões'), r.materiais && plural(r.materiais, 'material', 'materiais')].filter(Boolean) as string[])
}
/** O resumo com o estudo: "2 espaços, 140 questões, 3 baralhos, 40 cartões, progresso em 80 questões, 12 dias de estudo e 3 simulados" (só o que tem). */
export function textoDaCopia(r: Resumo, e: ResumoEstudo): string {
  return juntar([
    r.espacos && plural(r.espacos, 'espaço', 'espaços'), r.questoes && plural(r.questoes, 'questão', 'questões'), r.materiais && plural(r.materiais, 'material', 'materiais'),
    e.baralhos && plural(e.baralhos, 'baralho', 'baralhos'), e.cartoes && plural(e.cartoes, 'cartão', 'cartões'),
    e.questoesVistas && `progresso em ${plural(e.questoesVistas, 'questão', 'questões')}`, e.diasEstudados && plural(e.diasEstudados, 'dia de estudo', 'dias de estudo'), e.marcacoes && plural(e.marcacoes, 'questão marcada ou anotada', 'questões marcadas ou anotadas'), e.simulados && plural(e.simulados, 'simulado', 'simulados'),
  ].filter(Boolean) as string[])
}
