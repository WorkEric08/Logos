import { describe, expect, it } from 'vitest'
import { textoParaParagrafos } from '../importar/cartoes'
import { destacaPeloTamanho, escolherDistratores, formaDe, rngDe, semelhanca, serveComoErrada } from './distratores'
import { gerarQuestoes, MATERIA_GERADAS, type Geracao } from './gerar'
import { RESUMO_TESTE } from './fixture'
import { perturbar } from './numeros'
import { questionFactor } from '../weights'
import type { Question } from '../types'

const gera = (texto = RESUMO_TESTE): Geracao => gerarQuestoes(textoParaParagrafos(texto), { id: 'Mteste', nome: 'Resumo SFN' }, { ano: 2026 })

describe('alternativas erradas (distratores)', () => {
  const rng = rngDe('x')
  it('"serve como errada": diferente, não contida e não quase igual à certa', () => {
    expect(serveComoErrada('Banco Central do Brasil', 'Conselho Monetário Nacional')).toBe(true)
    expect(serveComoErrada('Banco Central do Brasil', 'banco central do brasil')).toBe(false)
    expect(serveComoErrada('Banco Central do Brasil', 'Banco Central')).toBe(false)
    expect(serveComoErrada('o rendimento é calculado sobre o capital inicial', 'o rendimento é calculado sobre o capital inicial do período')).toBe(false)
    expect(semelhanca('a b c', 'x y z')).toBe(0)
  })
  it('escolhe as de tamanho mais parecido, sem repetir, e devolve null se faltar candidato', () => {
    const cand = ['uma frase bem curta', 'outra oração também breve', 'mais um trecho pequeno aqui', 'texto reduzido de novo ok', 'sentença miúda qualquer outra', 'enunciado compacto bastante parecido', 'uma definição enorme que não se parece nada com a certa em comprimento e que vai ficar de fora da escolha']
    const e = escolherDistratores('uma certa também curta', cand, 4, rng)!
    expect(e).toHaveLength(4); expect(new Set(e).size).toBe(4); expect(e).not.toContain(cand[6])
    expect(escolherDistratores('x certa', cand.slice(0, 3), 4, rng)).toBeNull()
    expect(escolherDistratores('certa', ['certa', 'Certa', 'CERTA!', 'outra', 'mais', 'ainda mais'], 4, rng)).toBeNull() // só 3 servem (as 3 primeiras são a própria certa)
  })
  it('o sorteio é repetível: a mesma semente, o mesmo resultado', () => {
    const palavras = ['rendimento', 'capital', 'liquidez', 'dívida', 'prazo', 'taxa', 'ativo', 'saldo', 'parcela', 'crédito', 'mercado', 'poupança']
    const cand = palavras.map((p, i) => `${p} ${palavras[(i + 5) % 12]} tipo${i}`)
    expect(escolherDistratores('certa de tamanho parecido', cand, 4, rngDe('a'))).toEqual(escolherDistratores('certa de tamanho parecido', cand, 4, rngDe('a')))
    expect(escolherDistratores('certa de tamanho parecido', cand, 4, rngDe('a'))).not.toEqual(escolherDistratores('certa de tamanho parecido', cand, 4, rngDe('b')))
  })
  it('a certa que se destaca pelo tamanho é denunciada', () => {
    expect(destacaPeloTamanho('x'.repeat(100), ['y'.repeat(30), 'y'.repeat(35), 'y'.repeat(40), 'y'.repeat(45)])).toBe(true)
    expect(destacaPeloTamanho('x'.repeat(40), ['y'.repeat(30), 'y'.repeat(35), 'y'.repeat(40), 'y'.repeat(45)])).toBe(false)
    expect(destacaPeloTamanho('BACEN', ['CMN', 'CVM', 'FGC', 'SELIC'])).toBe(false) // palavras curtas: o tamanho não entrega nada
  })
})

describe('forma da resposta', () => {
  it('número, nome curto e frase', () => {
    expect(formaDe('45 dias')).toBe('numero'); expect(formaDe('R$ 250 mil')).toBe('numero'); expect(formaDe('1994')).toBe('numero')
    expect(formaDe('Selic')).toBe('curta'); expect(formaDe('CMN')).toBe('curta'); expect(formaDe('Risco de crédito')).toBe('curta')
    expect(formaDe('o rendimento é calculado só sobre o capital inicial')).toBe('longa')
  })
})

describe('números parecidos', () => {
  const rng = rngDe('n')
  it('prazos, valores, percentuais e anos mudam de forma plausível, na mesma forma', () => {
    const dias = perturbar('45 dias', rng)!
    expect(dias).toHaveLength(4); expect(new Set(dias).size).toBe(4); expect(dias.every((d) => /^\d+ dias$/.test(d) && d !== '45 dias')).toBe(true)
    const rs = perturbar('R$ 250 mil', rng)!
    expect(rs.every((d) => /^R\$ [\d.,]+ mil$/.test(d) && d !== 'R$ 250 mil')).toBe(true)
    expect(perturbar('15%', rng)!.every((d) => /^\d+%$/.test(d) && d !== '15%')).toBe(true)
    const anos = perturbar('1994', rng)!
    expect(anos.every((a) => Math.abs(Number(a) - 1994) <= 10 && a !== '1994')).toBe(true)
    expect(perturbar('3 anos', rng)!.every((d) => /^\d+ anos$/.test(d))).toBe(true)
  })
  it('número com vírgula mantém as casas; o que não é número volta null', () => {
    expect(perturbar('1,5 ponto percentual', rng)!.every((d) => /^\d+,\d ponto percentual$/.test(d))).toBe(true)
    expect(perturbar('Copom', rng)).toBeNull()
    expect(perturbar('', rng)).toBeNull()
  })
  it('é repetível', () => { expect(perturbar('45 dias', rngDe('k'))).toEqual(perturbar('45 dias', rngDe('k'))) })
})

describe('questões geradas do material', () => {
  const g = gera()
  it('gera questões de vários tipos a partir do resumo, sem inventar fatos', () => {
    expect(g.questoes.length).toBeGreaterThanOrEqual(20)
    const tipos = new Set(g.questoes.map((x) => x.tipo))
    for (const t of ['definicao', 'termo', 'sigla', 'numero', 'lacuna', 'pergunta', 'incorreta'] as const) expect(tipos.has(t), `falta o tipo ${t}`).toBe(true)
  })
  it('toda questão tem 5 alternativas diferentes e exatamente uma certa, que é o que o material diz', () => {
    for (const { q } of g.questoes) {
      const alts = Object.values(q.o)
      expect(alts, q.e).toHaveLength(5)
      expect(new Set(alts.map((a) => a.toLowerCase())).size, q.e).toBe(5)
      expect(alts.every((a) => a.trim().length > 0), q.e).toBe(true)
      expect(q.o[q.g]).toBeTruthy()
    }
  })
  it('a resposta certa de cada questão aparece no trecho do material de onde ela saiu', () => {
    const solto = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ')
    for (const { q, tipo } of g.questoes) {
      if (tipo === 'incorreta') continue // a certa é a afirmação trocada: está, por construção, em pedaços de dois trechos
      expect(solto(q.fonte ?? ''), `${tipo}: ${q.e} → ${q.o[q.g]}`).toContain(solto(q.o[q.g]).trim().split(' ').slice(0, 3).join(' '))
    }
  })
  it('as erradas de definição/sigla/pergunta vêm do próprio material (nada inventado)', () => {
    const todo = RESUMO_TESTE.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ')
    for (const { q, tipo } of g.questoes) {
      if (tipo === 'numero' || tipo === 'incorreta' || formaDe(q.o[q.g]) === 'numero') continue // números são variados, não tirados do texto
      for (const [l, alt] of Object.entries(q.o)) {
        const a = alt.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
        expect(todo.includes(a), `${tipo} ${l}) "${alt}" não está no material`).toBe(true)
      }
    }
  })
  it('as questões numéricas variam só o número (mesma unidade) e a certa é a do material', () => {
    const n = g.questoes.filter((x) => x.tipo === 'numero')
    expect(n.length).toBe(4)
    const copom = n.find((x) => x.q.e.includes('Copom'))!
    expect(copom.q.o[copom.q.g]).toBe('45 dias'); expect(Object.values(copom.q.o).every((a) => /^\d+ dias$/.test(a))).toBe(true)
    expect(copom.q.e).toBe('Segundo o seu material, complete: O Copom se reúne a cada _____ para definir a taxa Selic.')
  })
  it('"INCORRETA": 4 afirmações do material e uma trocada, e a certa (a gabarito) é a trocada', () => {
    const inc = g.questoes.find((x) => x.tipo === 'incorreta')!
    expect(inc.q.e).toMatch(/INCORRETA/)
    const certas = Object.entries(inc.q.o).filter(([l]) => l !== inc.q.g).map(([, t]) => t)
    const defs = textoParaParagrafos(RESUMO_TESTE).join(' ')
    for (const c of certas) { const [termo, ...def] = c.split(': '); expect(defs, c).toContain(def.join(': ').slice(0, 30)); expect(defs).toContain(termo) }
    const falsa = inc.q.o[inc.q.g]; const [termoF, defF] = [falsa.split(': ')[0], falsa.split(': ').slice(1).join(': ')]
    expect(certas.some((c) => c.startsWith(termoF + ':'))).toBe(false) // o termo da falsa não aparece em nenhuma certa
    expect(certas.some((c) => c.endsWith(defF))).toBe(true) // a definição da falsa é de outra afirmação
  })
  it('a letra certa varia (não é sempre a mesma)', () => {
    const cont: Record<string, number> = {}
    for (const { q } of g.questoes) cont[q.g] = (cont[q.g] ?? 0) + 1
    expect(Object.keys(cont).length).toBeGreaterThanOrEqual(4)
    expect(Math.max(...Object.values(cont))).toBeLessThan(g.questoes.length * 0.5)
  })
  it('pergunta de número recebe números parecidos; pergunta de nome recebe nomes (nunca uma sigla como alternativa de "quantos dias")', () => {
    const dias = g.questoes.find((x) => x.tipo === 'pergunta' && /Quantos dias/.test(x.q.e))!
    expect(dias.q.o[dias.q.g]).toBe('45 dias'); expect(Object.values(dias.q.o).every((a) => /^\d+ dias$/.test(a))).toBe(true)
    const taxa = g.questoes.find((x) => x.tipo === 'pergunta' && /taxa básica/.test(x.q.e))!
    expect(Object.values(taxa.q.o).every((a) => a.split(' ').length <= 3 && !/\d/.test(a))).toBe(true)
  })
  it('não há questão com a pergunta de um título que ganhou o parágrafo errado ("Sistema Financeiro Nacional" não é definição de nada)', () => {
    expect(g.questoes.some((x) => x.q.e.includes('Sistema Financeiro Nacional"'))).toBe(false)
  })
  it('é repetível: gerar de novo dá as mesmas questões, com os mesmos ids (importar duas vezes não duplica)', () => {
    const outra = gera()
    expect(outra.questoes.map((x) => x.q.id)).toEqual(g.questoes.map((x) => x.q.id))
    expect(new Set(g.questoes.map((x) => x.q.id)).size).toBe(g.questoes.length)
  })
  it('vêm marcadas como geradas, numeradas, com a fonte, na matéria e na "prova" do material', () => {
    g.questoes.forEach(({ q }, i) => {
      expect(q).toMatchObject({ ger: 1, n: i + 1, m: MATERIA_GERADAS, t: 'Resumo SFN', s: g.meta.chave, y: 2026, p: null, bp: null, ol: 0, b: '' })
      expect(q.fonte!.length).toBeGreaterThan(5); expect(q.fonte!.length).toBeLessThanOrEqual(300)
    })
    expect(g.meta).toEqual({ chave: 'ger-resumo-sfn-2026', rotulo: 'Geradas: Resumo SFN 2026 · do meu material', ano: 2026, bancoId: 'ger-resumo-sfn', bancoNome: 'Geradas: Resumo SFN' })
  })
  it('a certa nunca se destaca pelo tamanho; o que não deu para gerar fica na lista, com o motivo', () => {
    for (const { q } of g.questoes) {
      const certa = q.o[q.g].length, outras = Object.entries(q.o).filter(([l]) => l !== q.g).map(([, t]) => t.length)
      if (Math.max(certa, ...outras) >= 24) expect(certa, q.e).toBeLessThanOrEqual(Math.max(...outras) * 1.8)
    }
    for (const d of g.descartadas) { expect(d.motivo.length).toBeGreaterThan(5); expect(d.resumo.length).toBeGreaterThan(0) }
  })
  it('material pequeno demais não rende questão (faltam alternativas) e diz por quê', () => {
    const r = gera('Juros simples: o rendimento é calculado apenas sobre o capital inicial, em cada período da aplicação.\n\nLiquidez: facilidade de transformar um ativo em dinheiro rapidamente e sem perder valor.')
    expect(r.questoes).toEqual([]); expect(r.descartadas.length).toBeGreaterThan(0); expect(r.descartadas[0].motivo).toMatch(/poucas alternativas/)
  })
  it('texto sem nenhum padrão não gera nada', () => { expect(gera('Uma frase solta sem padrão nenhum aqui dentro.')).toMatchObject({ questoes: [], fatos: 0 }) })
  it('respeita o limite máximo', () => {
    const r = gerarQuestoes(textoParaParagrafos(RESUMO_TESTE), { id: 'M', nome: 'R' }, { ano: 2026, max: 5 })
    expect(r.questoes).toHaveLength(5); expect(r.descartadas.some((d) => /passou do limite/.test(d.motivo))).toBe(true)
  })
})

describe('peso das geradas no sorteio', () => {
  const base = { id: 'x', y: 2026, s: 's', n: 1, m: 'M', t: 't', a: '', e: '', b: '', o: { A: '', B: '', C: '', D: '', E: '' }, g: 'A', p: null, bp: null, f: 0, ol: 0 } as Question
  it('uma gerada pesa metade de uma de prova real igual', () => {
    expect(questionFactor({ ...base, ger: 1 }, {}, {})).toBeCloseTo(questionFactor(base, {}, {}) / 2, 10)
  })
})
