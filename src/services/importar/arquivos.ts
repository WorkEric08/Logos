// Orquestra a leitura dos arquivos que a pessoa escolhe: PDF de prova + gabarito, e texto de estudo (PDF/TXT/MD). Roda no navegador, no aparelho:
// nada é enviado para fora (só a "Reler com IA", opcional, manda o trecho da questão para a API da Anthropic, com a chave da própria pessoa).
import { lerGabarito, type GabaritoLido } from '../../core/importar/gabarito'
import { linhasParaParagrafos, textoParaParagrafos } from '../../core/importar/cartoes'
import { paginasParaLinhas } from '../../core/importar/layout'
import { detectarProva, type MetaProva } from '../../core/importar/montar'
import { lerProva, type ProvaLida, type QuestaoLida } from '../../core/importar/prova'
import type { Question } from '../../core/types'
import { gravarImagem } from '../db'
import { lerPaginas, type PdfDoc } from './pdf'
import { carregarPdfJs } from './pdfjs'
import { recortarQuestao } from './recorte'

export interface ProvaPreparada { meta: MetaProva; lida: ProvaLida; gabarito: GabaritoLido | null; doc: PdfDoc | null; arquivo: string; paginas: number }
export type Progresso = (texto: string, pct: number) => void

const bytes = async (f: File) => new Uint8Array(await f.arrayBuffer())
const TAMANHO_MAX = 60 * 1024 * 1024
const confere = (f: File) => { if (f.size > TAMANHO_MAX) throw new Error(`O arquivo "${f.name}" tem ${(f.size / 1048576).toFixed(0)} MB; o limite é 60 MB.`) }

export async function prepararProva(prova: File, gab: File | null, progresso: Progresso): Promise<ProvaPreparada> {
  confere(prova); if (gab) confere(gab)
  progresso('Abrindo o leitor de PDF…', 2)
  const pdfjs = await carregarPdfJs()
  const lido = await lerPaginas(pdfjs, await bytes(prova), (p) => progresso(`Lendo a prova: página ${p.pagina} de ${p.de}…`, 5 + Math.round((80 * p.pagina) / p.de)))
  progresso('Procurando as questões…', 88)
  const lida = lerProva(paginasParaLinhas(lido.paginas))
  let gabarito: GabaritoLido | null = null
  if (gab) {
    progresso('Lendo o gabarito…', 92)
    const g = await lerPaginas(pdfjs, await bytes(gab))
    gabarito = lerGabarito(paginasParaLinhas(g.paginas, { colunas: false, margens: false }))
    await g.doc.destroy?.()
  }
  progresso('Pronto.', 100)
  return { meta: detectarProva(prova.name), lida, gabarito, doc: lido.doc, arquivo: prova.name, paginas: lido.total }
}

/** Parágrafos de um arquivo de estudo: PDF (com texto), .txt ou .md. */
export async function paragrafosDoArquivo(f: File, progresso: Progresso): Promise<{ paragrafos: string[]; avisos: string[] }> {
  confere(f)
  if (/\.(txt|md|markdown)$/i.test(f.name) || f.type.startsWith('text/')) return { paragrafos: textoParaParagrafos(await f.text()), avisos: [] }
  progresso('Abrindo o leitor de PDF…', 2)
  const pdfjs = await carregarPdfJs()
  const lido = await lerPaginas(pdfjs, await bytes(f), (p) => progresso(`Lendo página ${p.pagina} de ${p.de}…`, 5 + Math.round((90 * p.pagina) / p.de)))
  await lido.doc.destroy?.()
  const linhas = paginasParaLinhas(lido.paginas)
  return { paragrafos: linhasParaParagrafos(linhas), avisos: linhas.length ? [] : ['Não encontrei texto no PDF: ele pode ser escaneado (só imagem).'] }
}

/** Guarda a imagem recortada das questões que pedem (figura/tabela, ou todas) e aponta `img` da questão para ela (`u:<id>`). */
export async function anexarImagens(prep: ProvaPreparada, questoes: Question[], espacoId: string, quais: 'figuras' | 'todas' | 'nenhuma', progresso?: Progresso): Promise<{ questoes: Question[]; falhas: number }> {
  if (quais === 'nenhuma' || !prep.doc) return { questoes, falhas: 0 }
  const porNumero = new Map<number, QuestaoLida>(prep.lida.questoes.map((q) => [q.numero, q]))
  const alvo = questoes.filter((q) => quais === 'todas' || q.f === 1)
  let falhas = 0, feitas = 0
  const saida = new Map(questoes.map((q) => [q.id, q]))
  for (const q of alvo) {
    progresso?.(`Recortando imagens: ${feitas + 1} de ${alvo.length}…`, Math.round((100 * feitas) / Math.max(1, alvo.length)))
    try {
      const blob = await recortarQuestao(prep.doc, porNumero.get(q.n)?.regioes ?? [])
      if (!blob) { falhas++; continue }
      await gravarImagem(q.id, espacoId, blob)
      saida.set(q.id, { ...q, img: `u:${q.id}` })
    } catch { falhas++ }
    feitas++
  }
  return { questoes: [...saida.values()], falhas }
}
