// Materiais de estudo: o texto que a pessoa entrega (resumo, apostila, anotações) guardado no aparelho, em TRECHOS buscáveis. Puro.
// Decisão de dados: o material (metadados) e os trechos ficam em tabelas separadas (um arquivo grande vira muitas linhas pequenas: leitura incremental, apagar em
// cascata, futura sincronização por trecho); o id vem do CONTEÚDO (importar o mesmo arquivo de novo no mesmo espaço não duplica).
import { hashTexto } from './espaco'
import { dividirEmTrechos } from './busca/trecho'

export type TipoMaterial = 'pdf' | 'texto'
export interface Material {
  id: string
  /** Espaço de estudo a que pertence (qualquer um, inclusive o do Banco do Brasil: material não é questão embutida). */
  e: string
  nome: string
  tipo: TipoMaterial
  criado: number
  /** Quantos trechos e quantas letras: para a lista e para os limites. */
  trechos: number
  caracteres: number
}
export interface Trecho { id: string; m: string; e: string; i: number; t: string }

/** Limites (proteção do aparelho e do índice): acima disso o material é recusado com uma mensagem clara. */
export const LIMITES = { caracteres: 4_000_000, trechos: 20_000 }

export type Preparado = { ok: true; material: Material; trechos: Trecho[] } | { ok: false; erro: string }

export function prepararMaterial(espacoId: string, nome: string, tipo: TipoMaterial, paragrafos: readonly string[], agora = Date.now()): Preparado {
  const partes = dividirEmTrechos(paragrafos)
  const caracteres = partes.reduce((a, t) => a + t.length, 0)
  if (!partes.length) return { ok: false, erro: 'Não encontrei texto neste arquivo (ele pode ser escaneado, só imagem).' }
  if (caracteres > LIMITES.caracteres) return { ok: false, erro: `O material é grande demais (${Math.round(caracteres / 1000)} mil letras; o limite é ${LIMITES.caracteres / 1000} mil). Divida o arquivo.` }
  if (partes.length > LIMITES.trechos) return { ok: false, erro: `O material tem trechos demais (${partes.length}; o limite é ${LIMITES.trechos}). Divida o arquivo.` }
  const id = 'M' + hashTexto(`${espacoId}|${partes.join('\n')}`)
  const limpo = nome.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Material'
  return {
    ok: true,
    material: { id, e: espacoId, nome: limpo, tipo, criado: agora, trechos: partes.length, caracteres },
    trechos: partes.map((t, i) => ({ id: `${id}:${i}`, m: id, e: espacoId, i, t })),
  }
}
