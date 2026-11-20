import { describe, expect, it } from 'vitest'
import type { Material, Trecho } from '../material'
import type { Question } from '../types'
import { itemValido, tipoDe } from './nuvem'
import {
  LIMITES_SYNC, aplicarPacoteQ, aplicarParteM, bytesDe, chaveEspaco, chavePacote, confereCotas, empacotarMaterial, empacotarQuestoes, lerCorpo, materialCompleto,
  pidDeQuestoes, pidValido, questoesSoDoPacote, valorEspacoValido, valorPacoteValido, type ConteudoQ, type EstadoMaterial, type EstadoQuestoes,
} from './espacos'

// Dados do tamanho dos reais (medido com as 22 provas Cesgranrio: ~930 bytes por questão, ~53 questões por prova).
const longo = (n: number, base: string) => (base + ' ').repeat(Math.ceil(n / (base.length + 1))).slice(0, n)
const questao = (i: number, s = 'prova-2021', extra: Partial<Question> = {}): Question => ({
  id: `u${s.replace(/\W/g, '')}${i}`, y: 2021, s, n: i, m: i % 2 ? 'Português' : 'Matemática', t: 'Geral', a: '', e: longo(420, `Enunciado ${i} com acentuação: açúcar, não, é`), b: '',
  o: { A: longo(80, 'alternativa A ção'), B: longo(80, 'alternativa B'), C: longo(80, 'alternativa C'), D: longo(80, 'alternativa D'), E: longo(80, 'alternativa E') }, g: 'C', p: null, bp: null, f: 0, ol: 0, ...extra,
})
const questoes = (n: number, s = 'prova-2021') => Array.from({ length: n }, (_, i) => questao(i + 1, s))
const BANCOS = [{ id: 'bb', nome: 'Banco do Brasil' }]
const estadoVazio = (): EstadoQuestoes => ({ questoes: [], bases: {}, fontes: {}, bancos: [] })
const conteudo = (e: ReturnType<typeof empacotarQuestoes>[number]): ConteudoQ => { const l = lerCorpo(e.pid, e.corpo); if (!l.ok || l.k !== 'q') throw new Error('corpo ruim'); return l.conteudo }

describe('empacotar questões', () => {
  it('uma prova de 70 questões cabe em UM pacote bem abaixo do limite', () => {
    const p = empacotarQuestoes('e1', questoes(70), {}, { 'prova-2021': 'Banco 2021' }, BANCOS)
    expect(p).toHaveLength(1)
    expect(p[0].catalogo).toMatchObject({ e: 'e1', k: 'q', n: 70 }); expect(p[0].catalogo.b).toBeLessThan(LIMITES_SYNC.pacoteBytes); expect(p[0].catalogo.b).toBe(bytesDe(p[0].corpo.d))
    expect(p[0].pid).toMatch(/^q-e1-[a-z0-9]+$/); expect(pidValido(p[0].pid)).toBe(true)
  })
  it('o MESMO conjunto de questões dá o MESMO id de pacote, em qualquer ordem (a mesma prova em dois aparelhos cai no mesmo documento)', () => {
    const a = questoes(10), b = [...a].reverse()
    expect(pidDeQuestoes('e1', a)).toBe(pidDeQuestoes('e1', b))
    expect(pidDeQuestoes('e1', a)).not.toBe(pidDeQuestoes('e2', a)) // outro espaço: outro pacote
    expect(pidDeQuestoes('e1', a)).not.toBe(pidDeQuestoes('e1', a.slice(1)))
    expect(empacotarQuestoes('e1', a, {}, {}, [])[0].pid).toBe(empacotarQuestoes('e1', b, {}, {}, [])[0].pid)
  })
  it('um pacote por prova; prova enorme vira partes que cabem no limite e não perdem nem repetem questão', () => {
    const duas = [...questoes(5, 'prova-a'), ...questoes(5, 'prova-b')]
    expect(empacotarQuestoes('e1', duas, {}, {}, [])).toHaveLength(2)
    const grande = questoes(1500, 'prova-grande') // ~1,4 MB
    const p = empacotarQuestoes('e1', grande, {}, {}, [])
    expect(p.length).toBeGreaterThan(2); for (const x of p) expect(bytesDe(x.corpo.d)).toBeLessThanOrEqual(LIMITES_SYNC.pacoteBytes)
    const ids = p.flatMap((x) => conteudo(x).questoes.map((q) => q.id))
    expect(ids).toHaveLength(1500); expect(new Set(ids).size).toBe(1500)
  })
  it('a questão vai INTEIRA (o enunciado `e` fica), com o texto-base e a prova (fonte) dela; o resto não vai', () => {
    const q = { ...questao(1, 'prova-2021', { b: 'tb1' }), e: 'texto do enunciado' }
    const p = empacotarQuestoes('e1', [q], { tb1: 'Texto-base longo', outra: 'não vai' }, { 'prova-2021': 'Banco 2021', 'outra-prova': 'não vai' }, BANCOS)
    const c = conteudo(p[0])
    expect(c.questoes[0].e).toBe('texto do enunciado')
    expect(c.bases).toEqual({ tb1: 'Texto-base longo' }); expect(c.fontes).toEqual({ 'prova-2021': 'Banco 2021' }); expect(c.bancos).toEqual(BANCOS)
  })
  it('questão do banco embutido NUNCA sobe', () => {
    const q = questoes(4)
    const p = empacotarQuestoes('e1', q, {}, {}, [], new Set([q[0].id, q[1].id]))
    expect(p).toHaveLength(1); expect(conteudo(p[0]).questoes.map((x) => x.id)).toEqual([q[2].id, q[3].id])
    expect(empacotarQuestoes('e1', q, {}, {}, [], new Set(q.map((x) => x.id)))).toEqual([])
  })
  it('acento conta 2 bytes na conta do tamanho (como o Firestore)', () => {
    expect(bytesDe('abc')).toBe(3); expect(bytesDe('ação')).toBe(6); expect(bytesDe('€')).toBe(3); expect(bytesDe('😀')).toBe(4)
  })
})

const material = (n: number, tam = 220): { m: Material; t: Trecho[] } => {
  const m: Material = { id: 'Mabc123', e: 'e1', nome: 'Resumo SFN', tipo: 'texto', criado: 10, trechos: n, caracteres: n * tam }
  return { m, t: Array.from({ length: n }, (_, i) => ({ id: `${m.id}:${i}`, m: m.id, e: 'e1', i, t: longo(tam, `Trecho ${i} sobre juros, inflação e crédito`) })) }
}
describe('empacotar material', () => {
  it('material típico (200 trechos) cabe em UMA parte, com os metadados nela', () => {
    const { m, t } = material(200)
    const p = empacotarMaterial(m, t)
    expect(p).toHaveLength(1); expect(p[0].pid).toBe('m-Mabc123-0'); expect(p[0].catalogo).toMatchObject({ k: 'm', nome: 'Resumo SFN', parte: 0, partes: 1, n: 200 })
    const l = lerCorpo(p[0].pid, p[0].corpo); expect(l.ok && l.k === 'm' && l.conteudo.material?.nome).toBe('Resumo SFN')
  })
  it('material no limite do app (20 mil trechos) vira várias partes ≤ 500 KB; juntas, reconstituem tudo (em qualquer ordem)', () => {
    const { m, t } = material(20_000, 200)
    const p = empacotarMaterial(m, t)
    expect(p.length).toBeGreaterThan(5); for (const x of p) expect(bytesDe(x.corpo.d)).toBeLessThanOrEqual(LIMITES_SYNC.pacoteBytes)
    expect(p.every((x, i) => x.catalogo.parte === i && x.catalogo.partes === p.length)).toBe(true)
    const aplicar = (ordem: typeof p) => ordem.reduce<EstadoMaterial>((est, x) => { const l = lerCorpo(x.pid, x.corpo); if (!l.ok || l.k !== 'm') throw new Error('ruim'); return aplicarParteM('e1', est, l.conteudo).estado }, { material: null, trechos: [] })
    const certo = aplicar(p), invertido = aplicar([...p].reverse())
    expect(certo.trechos).toHaveLength(20_000); expect(certo.material?.id).toBe('Mabc123'); expect(materialCompleto(certo.material, certo.trechos)).toBe(true)
    expect(invertido).toEqual(certo) // a ordem de chegada não muda o resultado
    expect(certo.trechos[7]).toEqual(t[7])
    expect(materialCompleto(aplicar(p.slice(1)).material, aplicar(p.slice(1)).trechos)).toBe(false) // sem a parte 0 não há material completo
  })
})

describe('aplicar um pacote que chega: união, nunca reduz', () => {
  const pacote = (n: number, extra: Partial<ConteudoQ> = {}): ConteudoQ => ({ questoes: questoes(n), bases: { tb: 'texto' }, fontes: { 'prova-2021': 'Banco 2021' }, bancos: BANCOS, ...extra })
  it('aplicar duas vezes dá o mesmo resultado', () => {
    const p = pacote(5), um = aplicarPacoteQ(estadoVazio(), p), dois = aplicarPacoteQ(um.estado, p)
    expect(um.adicionadas).toBe(5); expect(dois.adicionadas).toBe(0); expect(dois.estado).toEqual(um.estado)
  })
  it('aplicar em qualquer ordem dá o mesmo conjunto (propriedade)', () => {
    const a = pacote(4), b: ConteudoQ = { questoes: [...questoes(3).slice(1), questao(9, 'prova-b')], bases: {}, fontes: { 'prova-b': 'B' }, bancos: [{ id: 'cx', nome: 'Caixa' }, ...BANCOS] }
    const ab = aplicarPacoteQ(aplicarPacoteQ(estadoVazio(), a).estado, b).estado, ba = aplicarPacoteQ(aplicarPacoteQ(estadoVazio(), b).estado, a).estado
    const norm = (e: EstadoQuestoes) => ({ q: e.questoes.map((x) => x.id).sort(), f: e.fontes, bases: e.bases, bancos: e.bancos.map((x) => x.id).sort() })
    expect(norm(ab)).toEqual(norm(ba))
  })
  it('a questão que já existe FICA como está; só ganha a imagem se não tinha', () => {
    const local: EstadoQuestoes = { ...estadoVazio(), questoes: [{ ...questao(1), t: 'EDITADO' }, { ...questao(2), img: 'u:2' }] }
    const chega = pacote(2, { questoes: [{ ...questao(1), img: 'u:1', ig: 1 }, { ...questao(2), img: 'u:OUTRA' }] })
    const r = aplicarPacoteQ(local, chega).estado.questoes
    expect(r.find((q) => q.n === 1)).toMatchObject({ t: 'EDITADO', img: 'u:1', ig: 1 }); expect(r.find((q) => q.n === 2)?.img).toBe('u:2')
  })
  it('questão do banco embutido que chegasse por engano é ignorada', () => {
    const p = pacote(3), r = aplicarPacoteQ(estadoVazio(), p, new Set([p.questoes[0].id]))
    expect(r.adicionadas).toBe(2); expect(r.estado.questoes.map((q) => q.id)).not.toContain(p.questoes[0].id)
  })
})

describe('nunca confiar no que chega da nuvem', () => {
  const bom = empacotarQuestoes('e1', questoes(3), {}, {}, [])[0]
  it('corpo mal formado, grande demais ou de tipo trocado é recusado', () => {
    expect(lerCorpo(bom.pid, null).ok).toBe(false)
    expect(lerCorpo(bom.pid, { ...bom.corpo, d: 'não é json' }).ok).toBe(false)
    expect(lerCorpo(bom.pid, { ...bom.corpo, k: 'm' }).ok).toBe(false)
    expect(lerCorpo('q-e1-x', { ...bom.corpo, d: 'x'.repeat(LIMITES_SYNC.corpoBytes + 1) }).ok).toBe(false)
    expect(lerCorpo('../x', bom.corpo).ok).toBe(false)
    expect(lerCorpo(bom.pid, { ...bom.corpo, extra: 1 }).ok).toBe(true) // campo a mais é ignorado (as regras do Firestore é que barram)
  })
  it('questão estragada dentro de um pacote bom é descartada (e contada); o resto entra', () => {
    const q = questoes(3)
    const d = JSON.stringify({ questoes: [q[0], { id: 'x' }, { ...q[1], g: 'Z' }, q[2]], bases: { a: 'ok', b: 5 }, fontes: {}, bancos: [{ id: 1 }, { id: 'bb', nome: 'BB' }] })
    const l = lerCorpo('q-e1-abc', { e: 'e1', k: 'q', d })
    expect(l.ok && l.k === 'q' && l.conteudo.questoes.map((x) => x.id)).toEqual([q[0].id, q[2].id])
    expect(l.ok && l.k === 'q' && l.descartadas).toBe(2); expect(l.ok && l.k === 'q' && l.conteudo.bases).toEqual({ a: 'ok' }); expect(l.ok && l.k === 'q' && l.conteudo.bancos).toEqual([{ id: 'bb', nome: 'BB' }])
  })
  it('catálogo e espaço: forma, tamanhos e tipo conferidos', () => {
    const v = { e: 'e1', k: 'q', n: 3, b: 1000, de: 5 }
    expect(valorPacoteValido('q-e1-abc', v)).toEqual(v)
    expect(valorPacoteValido('m-e1-abc', v)).toBeNull() // o k não bate com o id
    expect(valorPacoteValido('q-e1-abc', { ...v, b: LIMITES_SYNC.corpoBytes + 1 })).toBeNull()
    expect(valorPacoteValido('q-e1-abc', { ...v, e: 'a/b' })).toBeNull()
    expect(valorPacoteValido('q-e1-abc', { ...v, parte: 3, partes: 2 })).toBeNull()
    expect(valorPacoteValido('xx', v)).toBeNull()
    expect(valorEspacoValido({ nome: 'Direito', criado: 1, usaBB: true, local: true, lixo: 1 })).toEqual({ nome: 'Direito', criado: 1, usaBB: true, local: true })
    expect(valorEspacoValido({ nome: '  ', criado: 1 })).toBeNull(); expect(valorEspacoValido({ nome: 'x', criado: 'ontem' })).toBeNull()
  })
  it('as chaves e: e p: entram no motor de itens (tipoDe/itemValido); lápide vale; lixo é ignorado', () => {
    expect(tipoDe(chaveEspaco('e1'))).toEqual({ tipo: 'espaco', id: 'e1' }); expect(tipoDe(chavePacote('q-e1-abc'))).toEqual({ tipo: 'pacote', id: 'q-e1-abc' })
    expect(itemValido('e:e1', { u: 5, dev: 'd1', v: { nome: 'Direito', criado: 1 } })).toMatchObject({ key: 'e:e1', v: { nome: 'Direito' } })
    expect(itemValido('e:e1', { u: 5, dev: 'd1', x: 1 })).toEqual({ key: 'e:e1', u: 5, dev: 'd1', x: 1 })
    expect(itemValido('e:e1', { u: 5, dev: 'd1', v: { nome: 7 } })).toBeNull()
    expect(itemValido('p:q-e1-abc', { u: 5, dev: 'd1', v: { e: 'e1', k: 'm', n: 1, b: 1, de: 1 } })).toBeNull()
    expect(itemValido('b:x', { u: 5, dev: 'd1', v: { qualquer: 1 } })).not.toBeNull() // o que já existia continua igual
  })
})

describe('referências e cotas', () => {
  it('ao tirar um pacote saem só as questões que nenhum outro pacote traz', () => {
    const m = new Map([['p1', ['a', 'b', 'c']], ['p2', ['c', 'd']]])
    expect(questoesSoDoPacote('p1', m)).toEqual(['a', 'b']); expect(questoesSoDoPacote('p2', m)).toEqual(['d']); expect(questoesSoDoPacote('nenhum', m)).toEqual([])
  })
  it('cota por espaço (25 MB) e por conta (100 MB)', () => {
    const MB = 1024 * 1024
    expect(confereCotas(1 * MB, 5 * MB, 1 * MB)).toEqual({ ok: true })
    expect(confereCotas(24.5 * MB, 30 * MB, 1 * MB)).toEqual({ ok: false, motivo: 'espaco' })
    expect(confereCotas(1 * MB, 99.5 * MB, 1 * MB)).toEqual({ ok: false, motivo: 'conta' })
  })
})
