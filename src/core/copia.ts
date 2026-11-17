// Cópia de segurança do que só existe NESTE aparelho: os espaços de estudo que a pessoa criou, as questões importadas ou geradas, as imagens recortadas das provas e os materiais
// (com os trechos). O progresso, o histórico, os cartões e as marcações já vão para a conta Google pela sincronização; isto não. Puro: sem banco, sem DOM, sem arquivo (quem lê e
// grava é services/copia.ts). Restaurar só ACRESCENTA o que falta (os ids vêm do conteúdo: o que já existe fica como está e nada é apagado nem duplicado).

export const VERSAO_COPIA = 1
/** Acima disto a cópia não cabe no arquivo (a ponte do app com o Android passa o texto inteiro de uma vez). */
export const TAMANHO_MAX_COPIA = 50 * 1024 * 1024

type Linha = { id: string } & Record<string, unknown>
/** Uma imagem recortada de prova: `dados` é o arquivo da imagem em base64. */
export interface ImagemCopiada { id: string; e: string; tipo: string; dados: string }

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
}

export type ConteudoLocal = Pick<Copia, 'espacos' | 'questoes' | 'imagens' | 'materiais' | 'trechos'>

export const montarCopia = (c: ConteudoLocal, agora: number): Copia => ({ app: 'logos', versao: VERSAO_COPIA, em: agora, ...c })

const dois = (n: number) => String(n).padStart(2, '0')
/** "logos-copia-2026-11-17.json" (a data do aparelho). */
export const nomeDoArquivo = (agora: number): string => { const d = new Date(agora); return `logos-copia-${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}.json` }

export interface Resumo { espacos: number; questoes: number; imagens: number; materiais: number; trechos: number }
export const resumir = (c: ConteudoLocal): Resumo => ({ espacos: c.espacos.length, questoes: c.questoes.length, imagens: c.imagens.length, materiais: c.materiais.length, trechos: c.trechos.length })
/** Há algo que só existe neste aparelho (e portanto vale guardar uma cópia)? */
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
  return { ok: true, copia: { app: 'logos', versao: o.versao, em: typeof o.em === 'number' ? o.em : 0, espacos: espacos as Linha[], questoes: questoes as Linha[], imagens: imagens as ImagemCopiada[], materiais: materiais as Linha[], trechos: trechos as Linha[] } }
}

export interface IdsLocais { espacos: ReadonlySet<string>; questoes: ReadonlySet<string>; imagens: ReadonlySet<string>; materiais: ReadonlySet<string>; trechos: ReadonlySet<string> }
export interface Plano { acrescentar: ConteudoLocal; novos: Resumo; jaExistiam: Resumo }

/** O que da cópia ainda falta neste aparelho (e o que já estava): restaurar só acrescenta. */
export function planoDeRestauracao(c: Copia, locais: IdsLocais): Plano {
  const falta = <T extends { id: string }>(lista: readonly T[], ja: ReadonlySet<string>) => lista.filter((x) => !ja.has(x.id))
  const acrescentar: ConteudoLocal = {
    espacos: falta(c.espacos, locais.espacos), questoes: falta(c.questoes, locais.questoes), imagens: falta(c.imagens, locais.imagens),
    materiais: falta(c.materiais, locais.materiais), trechos: falta(c.trechos, locais.trechos),
  }
  const novos = resumir(acrescentar), todos = resumir(c)
  return { acrescentar, novos, jaExistiam: { espacos: todos.espacos - novos.espacos, questoes: todos.questoes - novos.questoes, imagens: todos.imagens - novos.imagens, materiais: todos.materiais - novos.materiais, trechos: todos.trechos - novos.trechos } }
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
/** "2 espaços, 140 questões e 3 materiais" (só o que tem; imagens e trechos são detalhe e não entram). */
export function textoDoResumo(r: Resumo): string {
  const partes = [r.espacos && plural(r.espacos, 'espaço', 'espaços'), r.questoes && plural(r.questoes, 'questão', 'questões'), r.materiais && plural(r.materiais, 'material', 'materiais')].filter(Boolean) as string[]
  if (!partes.length) return 'nada'
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
}
