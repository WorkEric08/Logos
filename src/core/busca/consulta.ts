// Do que a pessoa escreveu ("o que é Copom?", "onde fala de inflação") para o que se procura ("copom", "inflação"). Puro.
import { PALAVRAS_VAZIAS, palavras, semAcento } from './texto'

/** Começos de pergunta que não fazem parte do assunto (já sem acento). Os mais longos primeiro. */
const PREFIXOS = [
  'o que e que', 'o que quer dizer', 'o que significa', 'o que sao', 'o que e', 'oque e', 'que e', 'me explique', 'me explica', 'explique', 'explica', 'defina', 'definicao de', 'definicao do', 'definicao da',
  'significado de', 'significado do', 'significado da', 'conceito de', 'conceito do', 'conceito da', 'onde fala de', 'onde fala sobre', 'onde fala do', 'onde fala da', 'onde esta', 'onde tem', 'onde cai',
  'procure por', 'procurar por', 'procure', 'procurar', 'busque', 'buscar', 'pesquisar', 'pesquise', 'achar', 'ache', 'encontre', 'encontrar', 'me fale sobre', 'fale sobre', 'quero saber sobre', 'quero saber',
  'tem algo sobre', 'tem algo de', 'o que diz sobre', 'o que fala sobre', 'o que meu material diz sobre', 'o que o material diz sobre',
]

/** O assunto da pergunta, sem o começo ("o que é", "onde fala de"…) nem pontuação. Vazio se só havia o começo. */
export function extrairConsulta(texto: string): string {
  let t = semAcento(texto).replace(/[?!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim()
  for (let i = 0; i < 3; i++) { // tira o começo (pode haver mais de um: "me explique, o que é X")
    const antes = t
    for (const p of PREFIXOS) if (t === p || t.startsWith(p + ' ')) { t = t.slice(p.length).trim(); break }
    if (t === antes) break
  }
  return t
}

/** Palavras da consulta que valem para a busca (sem palavras vazias), sem acento. */
export const termosDaConsulta = (consulta: string): string[] => palavras(consulta).filter((p) => !PALAVRAS_VAZIAS.has(p))
