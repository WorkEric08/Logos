// Cartão de uma questão com o trecho do material da pessoa que explica o assunto (se ela guardou um): o gabarito sozinho diz QUAL é a certa, o material diz POR QUÊ. Puro.
const MAX_TRECHO = 280

/** Acrescenta ao verso "Do seu material (fonte): trecho". Trecho vazio: o verso fica como está. */
export function versoComMaterial(verso: string, fonte: string, trecho: string): string {
  const limpo = trecho.replace(/\s+/g, ' ').trim()
  if (!limpo) return verso
  const curto = limpo.length <= MAX_TRECHO ? limpo : limpo.slice(0, MAX_TRECHO - 1).replace(/\s+\S*$/, '') + '…'
  return `${verso}\n\nDo seu material (${fonte}): ${curto}`
}
