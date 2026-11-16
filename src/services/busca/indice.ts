// Índice de busca em MEMÓRIA (MiniSearch, carregado sob demanda): palavra → radical → trechos, com prefixo, erro de digitação e ranking BM25.
// Decisão de dados: o índice NÃO é guardado no banco. Ele é derivado (some e volta a partir dos trechos), então guardá-lo só criaria risco de ficar velho; reconstruir é
// barato (medido em services/busca/indice.test.ts). Se um dia o orçamento de tempo estourar, a saída é guardar o índice serializado com a versão dos dados.
import type { DocBusca } from '../../core/busca/documentos'
import { radical } from '../../core/busca/radical'
import { PALAVRAS_VAZIAS, palavras, semAcento } from '../../core/busca/texto'

export interface Resultado { doc: DocBusca; pontos: number; /** achou só parte das palavras (a busca por todas não deu resultado) */ parcial: boolean }
export interface IndiceBusca { tamanho: number; buscar(consulta: string, limite?: number): Resultado[] }

/** Material pesa mais que cartão, e cartão mais que questão: quem pergunta "o que é X?" quer a explicação antes do exercício. */
const PESO_TIPO = (id: string) => (id.startsWith('m:') ? 1.25 : id.startsWith('c:') ? 1 : 0.8)

export async function criarIndice(docs: readonly DocBusca[]): Promise<IndiceBusca> {
  const { default: MiniSearch } = await import('minisearch')
  const ms = new MiniSearch<DocBusca>({
    fields: ['titulo', 'texto'], idField: 'id',
    tokenize: (t) => palavras(t, true),
    processTerm: (termo) => (PALAVRAS_VAZIAS.has(semAcento(termo)) ? null : radical(termo)),
    searchOptions: { boost: { titulo: 1.5 }, prefix: (t) => t.length >= 4, fuzzy: (t) => (t.length >= 6 ? 0.2 : false), boostDocument: (id) => PESO_TIPO(id) },
  })
  ms.addAll(docs as DocBusca[])
  const por = new Map(docs.map((d) => [d.id, d]))
  return {
    tamanho: docs.length,
    buscar(consulta, limite = 5) {
      const lista: Resultado[] = ms.search(consulta, { combineWith: 'AND' }).map((r) => ({ doc: por.get(r.id)!, pontos: r.score, parcial: false }))
      const termos = palavras(consulta).filter((p) => !PALAVRAS_VAZIAS.has(p))
      if (lista.length < limite && termos.length > 1) { // poucas com TODAS as palavras: completa com as que têm ALGUMAS
        const tem = new Set(lista.map((r) => r.doc.id))
        for (const r of ms.search(consulta, { combineWith: 'OR' })) if (!tem.has(r.id)) lista.push({ doc: por.get(r.id)!, pontos: r.score * 0.5, parcial: true })
      }
      return lista.filter((r) => r.doc).slice(0, limite)
    },
  }
}
