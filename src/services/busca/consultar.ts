// "Perguntar ao meu material": junta o que a pessoa tem no espaço ativo (materiais, questões e cartões), mantém o índice em memória e devolve os achados com o trecho
// certo em destaque. O índice é refeito só quando algo muda (outro espaço, material novo/apagado, mais questões ou cartões).
import { docsDeCartoes, docsDeMateriais, docsDeQuestoes, type DocBusca, type TipoDoc } from '../../core/busca/documentos'
import { extrairConsulta, termosDaConsulta } from '../../core/busca/consulta'
import { trechoDestacado, type TrechoDestacado } from '../../core/busca/trecho'
import { SOURCES } from '../../core/subjects'
import { BANK, useApp } from '../../store/app'
import { useCards } from '../../store/cards'
import { useEspacos } from '../../store/espacos'
import { lerTrechos, listarMateriais, versaoMateriais } from '../db'
import { criarIndice, type IndiceBusca } from './indice'

export interface Achado { tipo: TipoDoc; titulo: string; fonte: string; trecho: TrechoDestacado; parcial: boolean; ref?: string }
export interface Resposta { consulta: string; achados: Achado[]; /** quantos documentos o índice tem (0 = nada guardado para procurar) */ documentos: number }

let cache: { chave: string; indice: IndiceBusca } | null = null
export const limparIndiceDeBusca = () => { cache = null }

async function indiceAtual(): Promise<IndiceBusca> {
  const e = useEspacos.getState().ativo
  const cartoes = useCards.getState()
  const chave = [e, versaoMateriais(), useApp.getState().versao, BANK.length, cartoes.cartoes.length, cartoes.baralhos.length].join('|')
  if (cache?.chave === chave) return cache.indice
  const [materiais, trechos] = await Promise.all([listarMateriais(e), lerTrechos(e)])
  const docs: DocBusca[] = [...docsDeMateriais(materiais, trechos), ...docsDeQuestoes(BANK, SOURCES), ...docsDeCartoes(cartoes.cartoes, cartoes.baralhos)]
  const indice = await criarIndice(docs)
  cache = { chave, indice }
  return indice
}

/** Procura o que a pessoa escreveu ("o que é Copom?", "inflação") e devolve até `limite` achados. */
export async function consultar(texto: string, limite = 3): Promise<Resposta> {
  const consulta = extrairConsulta(texto)
  const indice = await indiceAtual()
  const termos = termosDaConsulta(consulta)
  if (!termos.length) return { consulta, achados: [], documentos: indice.tamanho }
  const achados = indice.buscar(consulta, limite).map((r): Achado => ({
    tipo: r.doc.tipo, titulo: r.doc.titulo, fonte: r.doc.fonte, trecho: trechoDestacado(r.doc.texto, termos), parcial: r.parcial, ref: r.doc.ref,
  }))
  return { consulta, achados, documentos: indice.tamanho }
}
