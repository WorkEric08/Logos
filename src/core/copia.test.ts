import { describe, expect, it } from 'vitest'
import { VERSAO_COPIA, lerCopia, montarCopia, nomeDoArquivo, planoDeRestauracao, resumir, temConteudo, textoDoResumo, type ConteudoLocal, type IdsLocais } from './copia'

const vazio: ConteudoLocal = { espacos: [], questoes: [], imagens: [], materiais: [], trechos: [] }
const conteudo: ConteudoLocal = {
  espacos: [{ id: 'e1', nome: 'Direito' }, { id: 'e2', nome: 'Pesquisa' }],
  questoes: [{ id: 'q1', e: 'e1' }, { id: 'q2', e: 'e1' }, { id: 'q3', e: 'e2' }],
  imagens: [{ id: 'q1', e: 'e1', tipo: 'image/jpeg', dados: 'AAAA' }],
  materiais: [{ id: 'm1', e: 'e1', nome: 'Resumo' }],
  trechos: [{ id: 'm1:0', m: 'm1', e: 'e1', t: 'texto' }, { id: 'm1:1', m: 'm1', e: 'e1', t: 'mais texto' }],
}
// questões e imagens são chaveadas por espaço + id (a mesma questão em dois espaços são duas linhas): nos testes a chave é "e1|q1"
const ids = (o: Partial<Record<keyof IdsLocais, string[]>> = {}): IdsLocais => ({ espacos: new Set(o.espacos), questoes: new Set(o.questoes), imagens: new Set(o.imagens), materiais: new Set(o.materiais), trechos: new Set(o.trechos) })

describe('cópia de segurança do que só existe no aparelho', () => {
  it('monta, escreve e lê de volta sem perder nada', () => {
    const c = montarCopia(conteudo, 1_700_000_000_000)
    expect(c).toMatchObject({ app: 'logos', versao: VERSAO_COPIA, em: 1_700_000_000_000 })
    const l = lerCopia(JSON.stringify(c))
    expect(l.ok).toBe(true)
    if (l.ok) { expect(resumir(l.copia)).toEqual({ espacos: 2, questoes: 3, imagens: 1, materiais: 1, trechos: 2 }); expect(l.copia.imagens[0].dados).toBe('AAAA') }
  })
  it('recusa com mensagem clara o que não é uma cópia: texto qualquer, outro app, versão futura, partes faltando, itens sem id', () => {
    const mensagem = (t: string) => { const l = lerCopia(t); return l.ok ? '' : l.erro }
    expect(mensagem('isto não é json')).toMatch(/não é uma cópia do Logos/)
    expect(mensagem('{"app":"outro"}')).toMatch(/não é uma cópia do Logos/)
    expect(mensagem('[1,2]')).toMatch(/não é uma cópia do Logos/)
    expect(mensagem(JSON.stringify({ ...montarCopia(vazio, 1), versao: VERSAO_COPIA + 1 }))).toMatch(/versão mais nova/)
    expect(mensagem(JSON.stringify({ app: 'logos', versao: 1, em: 1, espacos: [] }))).toMatch(/incompleta/)
    expect(mensagem(JSON.stringify({ ...montarCopia(vazio, 1), questoes: [{ e: 'x' }] }))).toMatch(/danificada/)
    expect(mensagem(JSON.stringify({ ...montarCopia(vazio, 1), imagens: [{ id: 'a' }] }))).toMatch(/danificada/)
  })
  it('restaurar só acrescenta: o que já existe fica como está e é contado à parte', () => {
    const c = montarCopia(conteudo, 1)
    const p = planoDeRestauracao(c, ids({ espacos: ['e1'], questoes: ['e1|q1', 'e1|q2'], materiais: ['m1'], trechos: ['m1:0'] }))
    expect(p.acrescentar.espacos.map((x) => x.id)).toEqual(['e2'])
    expect(p.acrescentar.questoes.map((x) => x.id)).toEqual(['q3'])
    expect(p.acrescentar.imagens.map((x) => x.id)).toEqual(['q1'])
    expect(p.acrescentar.materiais).toEqual([]); expect(p.acrescentar.trechos.map((x) => x.id)).toEqual(['m1:1'])
    expect(p.novos).toEqual({ espacos: 1, questoes: 1, imagens: 1, materiais: 0, trechos: 1 })
    expect(p.jaExistiam).toEqual({ espacos: 1, questoes: 2, imagens: 0, materiais: 1, trechos: 1 })
  })
  it('num aparelho vazio entra tudo; num aparelho que já tem tudo não entra nada (restaurar duas vezes não duplica)', () => {
    const c = montarCopia(conteudo, 1)
    expect(planoDeRestauracao(c, ids()).novos).toEqual(resumir(conteudo))
    const tudo = ids({ espacos: ['e1', 'e2'], questoes: ['e1|q1', 'e1|q2', 'e2|q3'], imagens: ['e1|q1'], materiais: ['m1'], trechos: ['m1:0', 'm1:1'] })
    expect(planoDeRestauracao(c, tudo).novos).toEqual(resumir(vazio))
  })
  it('o nome do arquivo leva a data e o resumo diz só o que há, com concordância', () => {
    expect(nomeDoArquivo(new Date(2026, 10, 7, 12).getTime())).toBe('logos-copia-2026-11-07.json')
    expect(textoDoResumo(resumir(conteudo))).toBe('2 espaços, 3 questões e 1 material')
    expect(textoDoResumo({ espacos: 1, questoes: 0, imagens: 0, materiais: 0, trechos: 0 })).toBe('1 espaço')
    expect(textoDoResumo(resumir(vazio))).toBe('nada')
    expect(temConteudo(resumir(vazio))).toBe(false); expect(temConteudo(resumir(conteudo))).toBe(true)
  })
})

// ---------- C-8: o estudo (progresso, histórico, baralhos, cartões) vai na cópia e volta sem perder nada ----------
import { estudoVazio, juntarEstudo, juntarHist, resumirEstudo, temEstudo, textoDaCopia, type Estudo } from './copia'
import type { Baralho, Cartao } from './cards'

const baralho = (id: string): Baralho => ({ id, nome: 'B ' + id, criado: 1 })
const cartao = (id: string, b: string): Cartao => ({ id, b, f: 'f' + id, v: 'v' + id, estado: 'novo', criado: 1, ult: 0, due: 0, ef: 2.5, iv: 0, lapsos: 0, reps: 0 }) as unknown as Cartao
const sim = (t: number) => ({ t, p: 50, b: 10, e: 20, c: 30, n: 70, ok: false })
const estudo = (o: Partial<Estudo> = {}): Estudo => ({ ...estudoVazio(), ...o })

describe('cópia de segurança com o estudo (versão 2)', () => {
  it('ida e volta pelo texto: progresso, histórico, baralhos e cartões saem e voltam iguais', () => {
    const e = estudo({
      baralhos: [baralho('b1')], cartoes: [cartao('c1', 'b1'), cartao('c2', 'b1')],
      prog: { q1: { n: 3, c: 2, ok: true, last: 'A', t: 9 }, q2: { n: 1, c: 0, ok: false, last: 'B', t: 5 } },
      hist: { dias: { '2026-11-17': { n: 10, c: 7 } }, sims: [sim(100)] }, histCartoes: { dias: { '2026-11-16': { n: 4, c: 3 } }, sims: [] },
    })
    const l = lerCopia(JSON.stringify(montarCopia(vazio, 5, e)))
    expect(l.ok).toBe(true)
    if (l.ok) { expect(l.copia.estudo.prog).toEqual(e.prog); expect(l.copia.estudo.hist).toEqual(e.hist); expect(l.copia.estudo.histCartoes).toEqual(e.histCartoes); expect(l.copia.estudo.baralhos.map((b) => b.id)).toEqual(['b1']); expect(l.copia.estudo.cartoes.map((c) => c.id)).toEqual(['c1', 'c2']) }
  })
  it('cópia antiga (versão 1, sem o estudo) continua valendo e restaura como antes (estudo vazio)', () => {
    const antiga = { app: 'logos', versao: 1, em: 1, ...vazio }
    const l = lerCopia(JSON.stringify(antiga))
    expect(l.ok).toBe(true)
    if (l.ok) expect(temEstudo(resumirEstudo(l.copia.estudo))).toBe(false)
  })
  it('itens estragados do estudo são descartados em vez de derrubar a leitura (cartão sem baralho, progresso sem número)', () => {
    const l = lerCopia(JSON.stringify({ ...montarCopia(vazio, 1), estudo: { baralhos: [baralho('b1')], cartoes: [cartao('c1', 'b1'), cartao('c2', 'naoexiste')], prog: { q1: { n: 1, c: 1 }, q2: { n: 'x' } }, hist: 'lixo' } }))
    expect(l.ok).toBe(true)
    if (l.ok) { expect(l.copia.estudo.cartoes.map((c) => c.id)).toEqual(['c1']); expect(Object.keys(l.copia.estudo.prog)).toEqual(['q1']); expect(l.copia.estudo.hist).toEqual({ dias: {}, sims: [] }) }
  })
  it('juntar nunca perde nem diminui: baralho e cartão que já existem ficam como estão; só entra o que falta', () => {
    const local = estudo({ baralhos: [baralho('b1')], cartoes: [{ ...cartao('c1', 'b1'), f: 'EDITADO' }] })
    const copia = estudo({ baralhos: [baralho('b1'), baralho('b2')], cartoes: [cartao('c1', 'b1'), cartao('c2', 'b2'), cartao('c3', 'b1')] })
    const { estudo: r, novos } = juntarEstudo(local, copia)
    expect(r.cartoes.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']); expect(r.cartoes[0].f).toBe('EDITADO')
    expect(r.baralhos.map((b) => b.id)).toEqual(['b1', 'b2']); expect(novos).toMatchObject({ baralhos: 1, cartoes: 2 })
  })
  it('juntar o progresso: fica o registro com MAIS respostas por questão; o aparelho nunca regride', () => {
    const local = estudo({ prog: { q1: { n: 5, c: 4, ok: true, last: 'A', t: 9 }, q2: { n: 1, c: 0, ok: false, last: 'B', t: 3 } } })
    const copia = estudo({ prog: { q1: { n: 2, c: 1, ok: false, last: 'C', t: 99 }, q2: { n: 3, c: 3, ok: true, last: 'D', t: 4 }, q3: { n: 1, c: 1, ok: true, last: 'A', t: 5 } } })
    const { estudo: r, novos } = juntarEstudo(local, copia)
    expect(r.prog.q1.n).toBe(5); expect(r.prog.q2.n).toBe(3); expect(r.prog.q3.n).toBe(1)
    expect(novos.questoesVistas).toBe(2) // q2 e q3 vieram da cópia; q1 ficou o do aparelho
  })
  it('juntar o histórico: em cada dia vale o de mais respostas e os simulados são a união (sem repetir o mesmo instante)', () => {
    const local = { dias: { '2026-11-16': { n: 10, c: 5 }, '2026-11-17': { n: 2, c: 1 } }, sims: [sim(1), sim(2)] }
    const copia = { dias: { '2026-11-16': { n: 4, c: 4 }, '2026-11-17': { n: 8, c: 6 }, '2026-11-15': { n: 1, c: 1 } }, sims: [sim(2), sim(3)] }
    const h = juntarHist(local, copia)
    expect(h.dias['2026-11-16']).toEqual({ n: 10, c: 5 }); expect(h.dias['2026-11-17']).toEqual({ n: 8, c: 6 }); expect(Object.keys(h.dias)).toHaveLength(3)
    expect(h.sims.map((s) => s.t)).toEqual([1, 2, 3])
  })
  it('restaurar o mesmo arquivo duas vezes não muda nada (nada é "novo" na 2ª)', () => {
    const e = estudo({ baralhos: [baralho('b1')], cartoes: [cartao('c1', 'b1')], prog: { q1: { n: 2, c: 1, ok: true, last: 'A', t: 1 } }, hist: { dias: { '2026-11-17': { n: 3, c: 2 } }, sims: [sim(7)] } })
    const { estudo: unido } = juntarEstudo(estudoVazio(), e)
    const outra = juntarEstudo(unido, e)
    expect(outra.novos).toEqual({ baralhos: 0, cartoes: 0, questoesVistas: 0, diasEstudados: 0, simulados: 0, marcacoes: 0 }); expect(outra.estudo).toEqual(unido)
  })
  it('o texto diz só o que há, com o estudo junto', () => {
    expect(textoDaCopia(resumir(conteudo), { baralhos: 2, cartoes: 40, questoesVistas: 80, diasEstudados: 0, simulados: 3, marcacoes: 0 })).toBe('2 espaços, 3 questões, 1 material, 2 baralhos, 40 cartões, progresso em 80 questões e 3 simulados')
    expect(textoDaCopia(resumir(vazio), { baralhos: 0, cartoes: 0, questoesVistas: 0, diasEstudados: 0, simulados: 0, marcacoes: 0 })).toBe('nada')
  })
})

describe('F-17: marcações e anotações vão na cópia e se juntam pela alteração mais recente', () => {
  const marcas = { q1: { r: true, a: 'ver de novo', t: 50 }, q2: { a: 'só nota', t: 10 } }
  it('ida e volta: marcações e anotações saem e voltam iguais', () => {
    const l = lerCopia(JSON.stringify(montarCopia(vazio, 1, estudo({ marks: marcas }))))
    expect(l.ok && l.copia.estudo.marks).toEqual(marcas)
  })
  it('juntar: vale a alteração mais recente de cada questão; a do aparelho nunca é trocada por uma mais velha', () => {
    const local = estudo({ marks: { q1: { r: true, a: 'NOVA', t: 99 }, q3: { r: true, t: 5 } } })
    const { estudo: r, novos } = juntarEstudo(local, estudo({ marks: marcas }))
    expect(r.marks.q1.a).toBe('NOVA'); expect(r.marks.q2.a).toBe('só nota'); expect(r.marks.q3.r).toBe(true)
    expect(novos.marcacoes).toBe(1) // só q2 veio da cópia
    expect(textoDaCopia(resumir(vazio), { ...resumirEstudo(estudoVazio()), marcacoes: 2 })).toBe('2 questões marcadas ou anotadas')
  })
})
