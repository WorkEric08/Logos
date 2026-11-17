// Cópia de segurança do que só existe neste aparelho (as regras puras estão em core/copia.ts): gera o arquivo (e o entrega pela folha de compartilhar do Android, ou como
// download no navegador) e restaura de um arquivo, só acrescentando. Mexe só nas tabelas de espaços, questões importadas, imagens, materiais e trechos: o progresso, os cartões e
// o resto continuam por conta da sincronização com a conta Google.
import { TAMANHO_MAX_COPIA, lerCopia, montarCopia, nomeDoArquivo, planoDeRestauracao, resumir, type ImagemCopiada, type Resumo } from '../core/copia'
import type { ConteudoLocal } from '../core/copia'
import { acrescentarConteudoDoAparelho, gravarUltimaCopia, idsDoAparelho, lerConteudoDoAparelho, type ConteudoDoAparelho } from './db'
import { salvarArquivo, type ResultadoSalvar } from './native/arquivos'

/** Blob → base64 (por `arrayBuffer`, que existe em todo navegador e WebView modernos; em pedaços, para não estourar a pilha com imagem grande). */
export const paraBase64 = async (b: Blob): Promise<string> => {
  const bytes = new Uint8Array(typeof b.arrayBuffer === 'function' ? await b.arrayBuffer() : await new Response(b).arrayBuffer()) // (a 2ª forma serve onde o Blob não tem arrayBuffer, como o jsdom dos testes)
  let texto = ''
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(texto)
}
/** As linhas do banco entram na cópia como são (o núcleo só exige o `id`). */
const linhas = <T extends { id: string }>(l: readonly T[]) => l as unknown as ConteudoLocal['espacos']
export const deBase64 = (dados: string, tipo: string): Blob => {
  const bin = atob(dados), bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: tipo })
}

/** O que há agora no aparelho, em números (sem carregar as imagens): para a tela dizer o que uma cópia guardaria. */
export async function resumoDoAparelho(): Promise<Resumo> {
  const ids = await idsDoAparelho()
  return { espacos: ids.espacos.size, questoes: ids.questoes.size, imagens: ids.imagens.size, materiais: ids.materiais.size, trechos: ids.trechos.size }
}

export type ResultadoCopia = { ok: true; resumo: Resumo; resultado: ResultadoSalvar; megabytes: number } | { ok: false; erro: string }

/** Monta a cópia de tudo o que há no aparelho e a entrega como arquivo. Só marca "última cópia" se a pessoa não cancelou. */
export async function salvarCopia(agora = Date.now()): Promise<ResultadoCopia> {
  try {
    const c = await lerConteudoDoAparelho()
    const imagens: ImagemCopiada[] = []
    for (const i of c.imagens) imagens.push({ id: i.id, e: i.e, tipo: i.blob.type || 'image/jpeg', dados: await paraBase64(i.blob) })
    const copia = montarCopia({ espacos: linhas(c.espacos), questoes: linhas(c.questoes), imagens, materiais: linhas(c.materiais), trechos: linhas(c.trechos) }, agora)
    const texto = JSON.stringify(copia)
    if (texto.length > TAMANHO_MAX_COPIA) return { ok: false, erro: `A cópia ficou grande demais (${Math.round(texto.length / 1048576)} MB; o limite é ${TAMANHO_MAX_COPIA / 1048576} MB). Apague o que não usa mais e tente de novo.` }
    const resultado = await salvarArquivo(nomeDoArquivo(agora), texto, 'application/json')
    if (resultado !== 'cancelado') await gravarUltimaCopia(agora)
    return { ok: true, resumo: resumir(copia), resultado, megabytes: texto.length / 1048576 }
  } catch (e) { return { ok: false, erro: 'Não consegui salvar a cópia: ' + (e instanceof Error ? e.message : String(e)) } }
}

export type ResultadoRestauracao = { ok: true; novos: Resumo; jaExistiam: Resumo } | { ok: false; erro: string }

/** Restaura de um arquivo de cópia: só ACRESCENTA o que falta (nada é apagado nem sobrescrito). */
export async function restaurarCopia(texto: string): Promise<ResultadoRestauracao> {
  const l = lerCopia(texto)
  if (!l.ok) return l
  try {
    const plano = planoDeRestauracao(l.copia, await idsDoAparelho())
    const a = plano.acrescentar
    const conteudo: ConteudoDoAparelho = {
      espacos: a.espacos as unknown as ConteudoDoAparelho['espacos'], questoes: a.questoes as unknown as ConteudoDoAparelho['questoes'],
      imagens: a.imagens.map((i) => ({ id: i.id, e: i.e, blob: deBase64(i.dados, i.tipo) })),
      materiais: a.materiais as unknown as ConteudoDoAparelho['materiais'], trechos: a.trechos as unknown as ConteudoDoAparelho['trechos'],
    }
    await acrescentarConteudoDoAparelho(conteudo)
    return { ok: true, novos: plano.novos, jaExistiam: plano.jaExistiam }
  } catch (e) { return { ok: false, erro: 'Não consegui restaurar a cópia: ' + (e instanceof Error ? e.message : String(e)) } }
}
