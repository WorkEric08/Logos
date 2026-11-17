// De texto de estudo (resumos, apostilas, anotações em PDF/TXT/MD) para cartões (frente/verso), SEM IA: só padrões que se reconhecem com segurança.
// O que não casa com nenhum padrão não vira cartão (a tela diz quantos parágrafos ficaram de fora). Puro.
import type { Linha } from './layout'

import { avaliar } from '../cartoes/qualidade'
import { cartoesDeLista, ehIntroducao, ehItemDeLista, itemLimpo, itensValidos, lerEnumeracaoInline } from '../cartoes/enumeracao'
import { lerConceito } from '../cartoes/conceito'
import { lacunasDeFrases } from '../cartoes/lacunas'
import { limparParagrafos } from './higiene'
import { cartoesDeSiglas } from '../cartoes/siglas'
import { lerSintaxe, temSintaxe } from '../cartoes/sintaxe'
import type { CartaoSugerido, Descartado, Sugestoes } from '../cartoes/tipos'

export type { CartaoSugerido, Descartado, Sugestoes, TipoCartao } from '../cartoes/tipos'

const TAM_FRENTE = 300, TAM_VERSO = 1200, MAX = 300
const limpa = (t: string) => t.replace(/\s+/g, ' ').replace(/^[\s•·▪■□●○◦–—*>\-\d.)]+\s+(?=\S)/, '').trim()
const corta = (t: string, n: number) => (t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…')

/** Linhas de um PDF → parágrafos: quebra onde o espaço vertical é maior que o normal, em marcador de lista e em título solto. */
export function linhasParaParagrafos(linhas: readonly Linha[]): string[] {
  const saida: string[] = []
  let atual = ''
  let anterior: Linha | null = null
  const gaps: number[] = []
  for (let i = 1; i < linhas.length; i++) if (linhas[i].pagina === linhas[i - 1].pagina && linhas[i].coluna === linhas[i - 1].coluna) { const d = linhas[i - 1].y - linhas[i].y; if (d > 2 && d < 40) gaps.push(d) }
  const tipico = gaps.length ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length * 0.3)] : 12
  const fecha = () => { if (atual.trim()) saida.push(atual.trim()); atual = '' }
  // largura típica (a MEDIANA, que tabelas e quadros de largura inteira não distorcem) das linhas de cada coluna: uma linha bem mais curta, sem pontuação no fim, é um TÍTULO ("Tratamento medicamentoso"), não meio de parágrafo
  const larguras = new Map<string, number[]>()
  for (const l of linhas) { const k = `${l.pagina}:${l.coluna}`; larguras.set(k, [...(larguras.get(k) ?? []), l.x1 - l.x0]) }
  const tipica = new Map([...larguras].map(([k, v]) => [k, [...v].sort((a, b) => a - b)[Math.floor(v.length * 0.5)] ?? 0]))
  const ehTitulo = (l: Linha) => l.texto.length <= 90 && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9"“]/.test(l.texto) && !/[.!?;:”"]$/.test(l.texto) && l.x1 - l.x0 < 0.72 * (tipica.get(`${l.pagina}:${l.coluna}`) ?? 0)
  for (const l of linhas) {
    const marcador = /^[•·▪■●○◦-]\s/.test(l.texto) || /^\d{1,2}[.)]\s+\S/.test(l.texto)
    const lugarNovo = !anterior || l.pagina !== anterior.pagina || l.coluna !== anterior.coluna
    // a frase que termina no pé de uma coluna ou de uma página e continua no alto da seguinte (palavra partida com hífen, ou um trecho sem ponto final) segue sendo o mesmo parágrafo; os títulos curtos já foram fechados à parte
    const continua = lugarNovo && !!anterior && !marcador && /^[a-zà-ÿ]/.test(l.texto) && (/[A-Za-zÀ-ÿ]-$/.test(atual) || (atual.trim().length >= 20 && !/[.!?:;)”"»]$/.test(atual.trim())))
    const titulo = ehTitulo(l)
    // um título começa parágrafo novo quando o anterior já acabou numa frase, e fica sozinho (o corpo vem no parágrafo seguinte)
    const quebra = !anterior || (lugarNovo ? !continua : anterior.y - l.y > tipico * 1.55 || marcador) || (titulo && /[.!?:;)”"»]$/.test(atual.trim()))
    if (quebra) fecha()
    atual = atual ? (/[A-Za-zÀ-ÿ]-$/.test(atual) && /^[a-zà-ÿ]/.test(l.texto) ? atual.slice(0, -1) + l.texto : /[A-Za-zÀ-ÿ]-$/.test(atual) && /^-[A-Za-zÀ-ÿ]/.test(l.texto) ? atual + l.texto.slice(1) : `${atual} ${l.texto}`) : l.texto // (o 2º caso: "M-" + "-CHAT-R", o hífen do composto repetido na quebra de linha)
    anterior = l
    if (titulo) { fecha(); anterior = null }
  }
  fecha()
  return saida
}

/** Um título de seção solto ("Tratamento medicamentoso"): curto, sem ponto final, começa com maiúscula e não é item de lista. */
const pareceTitulo = (p: string) => !/\s[–—-]\s|:/.test(p) && p.length >= 4 && p.length <= 90 && p.split(/\s+/).length <= 12 && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9"“]/.test(p) && !/[.!?;:”"»]$/.test(p) && !/^#/.test(p)

/** Texto puro (TXT/MD) → parágrafos, mantendo os títulos de markdown ("# …") como parágrafos próprios. */
export function textoParaParagrafos(texto: string): string[] {
  const saida: string[] = []
  for (const bloco of texto.replace(/\r/g, '').split(/\n\s*\n/)) {
    let atual: string[] = []
    for (const linha of bloco.split('\n')) {
      if (/^#{1,6}\s/.test(linha) || /^\s*[-*•]\s/.test(linha)) { if (atual.length) saida.push(atual.join(' ')); atual = []; saida.push(linha.trim()); continue }
      atual.push(linha.trim())
    }
    if (atual.length) saida.push(atual.join(' '))
  }
  return saida.map((p) => p.trim()).filter(Boolean)
}

const DEF_DOIS_PONTOS = /^(?:\*\*)?([^:.;?!]{2,70}?)(?:\*\*)?\s*:\s+(.{12,})$/
const DEF_TRACO = /^([^:.;?!–—-]{2,60}?)\s+[–—-]\s+(.{15,})$/
const PERGUNTA = /^(?:P|Pergunta|Q)\s*[:.)]\s*(.+?\?)\s*(?:R|Resposta|A)\s*[:.)]\s*(.+)$/i

/**
 * Cartões a partir dos parágrafos. A ordem importa (do mais fiel ao mais adivinhado): marcação explícita da pessoa (`::`, `:::`, `==x==`, `{{x}}`, ` ? `) →
 * lista com marcadores → pergunta/resposta → título + parágrafo → enumeração dentro da frase → "termo: definição" → lacuna em negrito → "X é …" → lacuna em número.
 * Siglas ("Banco Central (BACEN)") rendem cartões ALÉM do que o parágrafo já rendeu. Tudo passa pelo filtro de qualidade (`cartoes/qualidade.ts`): o que for barrado
 * volta em `descartados`, com o motivo, em vez de sumir sem explicação.
 */
export function sugerirCartoes(todosOsParagrafos: readonly string[]): Sugestoes {
  // o que não é para estudar (referências bibliográficas, créditos) nem entra na conta
  const higiene = limparParagrafos(todosOsParagrafos)
  const paragrafos = higiene.paragrafos
  const cartoes: CartaoSugerido[] = []
  const descartados: Descartado[] = []
  const vistos = new Set<string>()
  let sobraram = 0
  /** Entra se for novo e passar na qualidade. Devolve se entrou. */
  const add = (c: CartaoSugerido): boolean => {
    const f = corta(c.f.trim(), TAM_FRENTE), v = corta(c.v.trim(), TAM_VERSO)
    const k = f.toLowerCase().replace(/\W+/g, '')
    if (!f || !v || vistos.has(k) || cartoes.length >= MAX) return false
    const r = avaliar({ ...c, f, v })
    if (r.descartar) { descartados.push({ f, motivo: r.descartar }); return false }
    vistos.add(k); cartoes.push({ ...c, f, v, ...(r.aviso ? { aviso: r.aviso } : {}) }); return true
  }
  const addTodos = (lista: readonly CartaoSugerido[]) => lista.reduce((n, c) => n + (add(c) ? 1 : 0), 0)

  let titulo = '' // o título curto logo acima do parágrafo da vez (o assunto das frases dele)
  for (let i = 0; i < paragrafos.length; i++) {
    const bruto = paragrafos[i]
    const p = limpa(bruto.replace(/\*\*/g, '**'))
    if (!p) continue
    const contexto = titulo
    titulo = pareceTitulo(p) ? p : ''
    let m: RegExpExecArray | null
    // siglas: cartões a mais, sem consumir o parágrafo
    const dasSiglas = addTodos(cartoesDeSiglas(p))
    if (dasSiglas && p.length <= 100) continue // linha de glossário curta ("FGC – Fundo Garantidor de Créditos"): as siglas já disseram tudo
    // 1. marcação explícita da pessoa
    if (temSintaxe(bruto)) { if (addTodos(lerSintaxe(bruto))) continue }
    // 2. lista com marcadores depois de uma introdução ("Os poderes:")
    if (ehIntroducao(p) && !/^#/.test(bruto)) {
      const itens: string[] = []
      for (let j = i + 1; j < paragrafos.length && ehItemDeLista(paragrafos[j]); j++) itens.push(itemLimpo(paragrafos[j]))
      if (itensValidos(itens) && addTodos(cartoesDeLista(p, itens, [bruto, ...paragrafos.slice(i + 1, i + 1 + itens.length)].join('\n')))) { i += itens.length; continue }
    }
    if ((m = PERGUNTA.exec(p))) { if (add({ f: m[1], v: m[2], tipo: 'pergunta', origem: p })) continue }
    if (/^#{1,6}\s/.test(bruto)) {
      // título de markdown + o parágrafo seguinte (se não for outro título ou lista)
      const prox = paragrafos[i + 1]
      const proxEhOutroPadrao = !!prox && (DEF_DOIS_PONTOS.test(limpa(prox)) || DEF_TRACO.test(limpa(prox)) || PERGUNTA.test(limpa(prox)) || temSintaxe(prox) || ehIntroducao(limpa(prox))) // "# Juros" + "Juros simples: …": o parágrafo já é o seu próprio cartão, não a explicação do título
      if (prox && !proxEhOutroPadrao && !/^#{1,6}\s/.test(prox) && !/^\s*[-*•]\s/.test(prox) && limpa(prox).length >= 25) { if (add({ f: p.replace(/^#+\s*/, ''), v: limpa(prox), tipo: 'titulo', origem: p })) { i++; continue } }
      continue
    }
    // 3. enumeração dentro da frase ("Os princípios são: a, b e c.")
    const inline = lerEnumeracaoInline(p)
    if (inline && addTodos(inline)) continue
    if ((m = DEF_DOIS_PONTOS.exec(p)) && !/^https?/i.test(m[1]) && m[1].split(/\s+/).length <= 9 && !/\d{1,2}:\d{2}/.test(p.slice(0, 20))) { if (add({ f: m[1].replace(/\*\*/g, '').trim(), v: m[2].replace(/\*\*/g, ''), tipo: 'definicao', origem: p })) continue }
    if ((m = DEF_TRACO.exec(p)) && m[1].split(/\s+/).length <= 8) { if (add({ f: m[1], v: m[2], tipo: 'definicao', origem: p })) continue }
    const negritos = [...p.matchAll(/\*\*([^*]{2,50})\*\*/g)]
    if (negritos.length === 1 && p.length <= 400 && p.length > 40) {
      const termo = negritos[0][1]
      if (add({ f: p.replace(`**${termo}**`, '_____').replace(/\*\*/g, ''), v: termo, tipo: 'lacuna', origem: p })) continue
    }
    const conceito = lerConceito(p)
    if (conceito && add({ f: conceito.frente, v: conceito.verso, tipo: 'verbo', origem: p })) continue
    // 4. último recurso: números, datas e valores em lacuna
    const numeros = lacunasDeFrases(p, contexto)
    if (numeros && addTodos(numeros)) continue
    if (!dasSiglas) sobraram++
  }
  return { cartoes, paragrafos: paragrafos.length, sobraram, descartados, ignorados: higiene.ignorados, motivosIgnorados: higiene.motivos }
}
