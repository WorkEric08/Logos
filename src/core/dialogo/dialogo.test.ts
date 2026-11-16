import { describe, expect, it } from 'vitest'
import bank from '../../data/bank.json'
import { BB_SUBJECTS, BB_EXTRA } from '../subjects'
import { entenderResposta, descrever, pedidoDe, preencher, proximoPasso, type Pedido } from './dialogo'
import { sugerirDigitando } from './digitando'
import { acharMateria, acharProvas, acharQuantidade, extrairEntidades, type Contexto } from './entidades'
import { ACOES } from '../assistente'

// O contexto do espaço embutido (Banco do Brasil): as matérias e provas reais.
const materias = [...BB_SUBJECTS, ...BB_EXTRA].map((m) => ({ nome: m.n, curto: m.s }))
const provas = Object.entries(bank.sources as Record<string, string>).map(([chave, rotulo]) => ({ chave, rotulo }))
const ctx: Contexto = { materias, provas, espacos: [{ id: 'bb', nome: 'Banco do Brasil' }, { id: 'dp', nome: 'Direito Penal' }], espacoAtivo: 'bb', temRegras: true }
const semRegras: Contexto = { ...ctx, temRegras: false }

describe('matéria', () => {
  const casos: [string, string | undefined][] = [
    ['treinar matemática', 'Matemática'],
    ['matematica financeira 20 questões', 'Matemática Financeira'],
    ['quero juros de matemática financeira', 'Matemática Financeira'],
    ['simulado de português', 'Língua Portuguesa'],
    ['questões de lingua portuguesa', 'Língua Portuguesa'],
    ['inglês', 'Língua Inglesa'],
    ['ingles', 'Língua Inglesa'],
    ['só vendas', 'Vendas e Negociação'],
    ['negociação', 'Vendas e Negociação'],
    ['informática', 'Conhecimentos de Informática'],
    ['conhecimentos bancários', 'Conhecimentos Bancários'],
    ['bancarios', 'Conhecimentos Bancários'],
    ['atualidades', 'Atualidades do Mercado Financeiro'],
    ['estatística', 'Estatística'],
    ['ética', 'Ética'],
    ['legislação', 'Legislação'],
    ['digitais', 'Conhecimentos Digitais'],
    ['matematica', 'Matemática'],
    ['o que é copom', undefined],
    ['simulado', undefined],
    ['quero treinar', undefined],
    ['importar prova', undefined],
  ]
  it.each(casos)('"%s" → %s', (t, esperado) => expect(acharMateria(t, materias)).toBe(esperado))
})

describe('quantidade', () => {
  const casos: [string, number | undefined][] = [
    ['20 questões', 20], ['de 15', 15], ['treinar 30', 30], ['simulado com 25 questoes', 25], ['vinte questões', 20], ['só dez', 10], ['apenas 5', 5],
    ['quinze questões de matemática', 15], ['10 de português', 10], ['quero 40', 40], ['simulado de 60 questões', 60],
    ['questão 12', undefined], ['lei 8', undefined], ['artigo 5', undefined], ['uma prova', undefined], ['um simulado', undefined], ['simulado', undefined], ['0', undefined], ['999', undefined],
  ]
  it.each(casos)('"%s" → %s', (t, esperado) => expect(acharQuantidade(t)).toBe(esperado))
  it('não confunde o ano da prova com a quantidade', () => {
    expect(extrairEntidades('treinar bb 2021', ctx).quantidade).toBeUndefined()
    expect(extrairEntidades('treinar 15 da prova do bb 2021', ctx).quantidade).toBe(15)
  })
})

describe('provas', () => {
  const chaves = (t: string) => acharProvas(t, provas).map((p) => p.chave).sort()
  const casos: [string, string[]][] = [
    ['prova do bb 2021', ['bb-2021']],
    ['bb 2018', ['bb-2018']],
    ['treinar bb 2012', ['bb-2012']],
    ['caixa 2024', ['caixa-2024']],
    ['caixa rs 2024', ['caixa-rs092024']],
    ['banco da amazônia 2018', ['bancodaamazonia-2018']],
    ['bnb 2024', ['bnb-2024']],
    ['banese 2025', ['banese-2025']],
    ['bb 2015', ['bb-032015', 'bb-102015']],
    ['bb 10/2015', ['bb-102015']],
    ['bb 03/2015', ['bb-032015']],
    ['bb 2021 de ti', ['bb-2021-ti']],
    ['bb 2021', ['bb-2021']],
    ['prova de tecnologia do bb 2021', ['bb-2021-ti']],
    ['prova de 2021', []],
    ['bb', []],
    ['bb 1999', []],
    ['prova da caixa', []],
  ]
  it.each(casos)('"%s" → %j', (t, esperado) => expect(chaves(t)).toEqual(esperado))
})

describe('entidades juntas', () => {
  it('lê tudo o que a fala traz', () => {
    const e = extrairEntidades('treinar 15 questões de matemática financeira', ctx)
    expect(e).toMatchObject({ materia: 'Matemática Financeira', quantidade: 15 })
  })
  it('"essa prova" usa a última importada', () => {
    const ultima = { chave: 'bb-2025', rotulo: 'BB 2025 · Teste' }
    expect(extrairEntidades('treinar essa prova', { ...ctx, ultimaProva: ultima }).provas).toEqual([ultima])
    expect(extrairEntidades('treinar essa prova', ctx).provas).toBeUndefined()
  })
  it('"todas", "hoje" e "semana"', () => {
    expect(extrairEntidades('treinar todas as matérias', ctx).todas).toBe(true)
    expect(extrairEntidades('o que estudei hoje', ctx).tempo).toBe('hoje')
    expect(extrairEntidades('como foi a semana', ctx).tempo).toBe('semana')
  })
  it('espaço citado e nome de um espaço novo', () => {
    expect(extrairEntidades('trocar para direito penal', ctx).espaco?.id).toBe('dp')
    expect(extrairEntidades('criar espaço Direito Civil', ctx).nome).toBe('Direito Civil')
    expect(extrairEntidades('criar um espaço chamado Pesquisa Operacional', ctx).nome).toBe('Pesquisa Operacional')
    expect(extrairEntidades('criar um novo espaço', ctx).nome).toBeUndefined()
    expect(extrairEntidades('meus espaços', ctx).nome).toBeUndefined()
  })
})

describe('motor do diálogo (preencher o que falta)', () => {
  const simulado = (e = {}): Pedido => ({ acao: 'simulado', ...e })
  it('simulado sem nada: pergunta qual (com o do edital quando há regras)', () => {
    const p = proximoPasso(simulado(), ctx)
    expect(p).toMatchObject({ tipo: 'perguntar', slot: 'materia' })
    if (p.tipo === 'perguntar') { expect(p.opcoes[0].valor).toBe('edital'); expect(p.opcoes.map((o) => o.valor)).toContain('Matemática') }
  })
  it('sem regras de edital não oferece o simulado do edital', () => {
    const p = proximoPasso(simulado(), semRegras)
    if (p.tipo !== 'perguntar') throw new Error('devia perguntar')
    expect(p.opcoes.some((o) => o.valor === 'edital')).toBe(false)
    expect(p.texto).toBe('De qual matéria?')
  })
  it('simulado de matéria sem quantidade pergunta a quantidade', () => {
    const p = proximoPasso(simulado({ materia: 'Matemática' }), ctx)
    expect(p).toMatchObject({ tipo: 'perguntar', slot: 'quantidade' })
  })
  it('simulado com matéria e quantidade executa, e o do edital executa direto', () => {
    expect(proximoPasso(simulado({ materia: 'Matemática', quantidade: 20 }), ctx).tipo).toBe('executar')
    expect(proximoPasso(simulado({ materia: 'edital' }), ctx).tipo).toBe('executar')
  })
  it('simulado com a quantidade dita mas sem matéria não oferece o edital (que é sempre 70)', () => {
    const p = proximoPasso(simulado({ quantidade: 20 }), ctx)
    if (p.tipo !== 'perguntar') throw new Error('devia perguntar')
    expect(p.opcoes.some((o) => o.valor === 'edital')).toBe(false)
  })
  it('treino: sem nada pergunta a matéria; com qualquer coisa usa o padrão', () => {
    expect(proximoPasso({ acao: 'treinar' }, ctx)).toMatchObject({ tipo: 'perguntar', slot: 'materia' })
    expect(proximoPasso({ acao: 'treinar', materia: 'Matemática' }, ctx)).toMatchObject({ tipo: 'executar', pedido: { materia: 'Matemática', quantidade: 10 } })
    expect(proximoPasso({ acao: 'treinar', quantidade: 25 }, ctx)).toMatchObject({ tipo: 'executar', pedido: { materia: 'todas', quantidade: 25 } })
    expect(proximoPasso({ acao: 'treinar', provas: [provas[0]] }, ctx)).toMatchObject({ tipo: 'executar' })
  })
  it('preencher e responder em texto livre', () => {
    expect(preencher(simulado(), 'materia', 'Matemática').materia).toBe('Matemática')
    expect(preencher(simulado(), 'quantidade', 30).quantidade).toBe(30)
    expect(entenderResposta('materia', 'matemática', ctx)).toBe('Matemática')
    expect(entenderResposta('materia', 'o do edital', ctx)).toBe('edital')
    expect(entenderResposta('materia', 'o do edital', semRegras)).toBeUndefined()
    expect(entenderResposta('materia', 'todas', ctx)).toBe('todas')
    expect(entenderResposta('materia', 'sei lá', ctx)).toBeUndefined()
    expect(entenderResposta('quantidade', '20', ctx)).toBe(20)
    expect(entenderResposta('quantidade', 'vinte questões', ctx)).toBe(20)
    expect(entenderResposta('quantidade', 'banana', ctx)).toBeUndefined()
  })
  it('descreve o pedido em português', () => {
    expect(descrever({ acao: 'simulado', materia: 'Matemática', quantidade: 20 })).toBe('simulado de 20 questões de Matemática')
    expect(descrever({ acao: 'treinar', materia: 'todas', quantidade: 10 })).toBe('treino de 10 questões de todas as matérias')
    expect(descrever({ acao: 'simulado', materia: 'edital' })).toContain('edital')
    expect(descrever({ acao: 'treinar', quantidade: 10, provas: [provas[0]] })).toBe('treino de 10 questões da prova BB 2010')
  })
  it('pedidoDe junta o que foi dito', () => {
    expect(pedidoDe('treinar', { materia: 'Matemática', quantidade: 5 })).toEqual({ acao: 'treinar', materia: 'Matemática', quantidade: 5 })
    expect(pedidoDe('treinar', { todas: true })).toEqual({ acao: 'treinar', materia: 'todas' })
  })
})

describe('sugestões ao digitar', () => {
  const ids = (t: string) => sugerirDigitando(t, ACOES).map((s) => s.id)
  it('menos de duas letras não sugere nada', () => expect(ids('s')).toEqual([]))
  it('começo de palavra-chave sugere a ação', () => {
    expect(ids('simu')[0]).toBe('simulado')
    expect(ids('impor')[0]).toBe('prova')
    expect(ids('cart')).toContain('cartoes')
    expect(ids('trein')[0]).toBe('treinar')
    expect(ids('materi')).toContain('materiais')
  })
  it('texto que não combina com nada vira "procurar no material"', () => {
    const s = sugerirDigitando('inflação', ACOES)
    expect(s[s.length - 1]).toMatchObject({ tipo: 'busca' })
    expect(s[s.length - 1].rotulo).toContain('inflação')
  })
  it('no máximo 4 ações', () => expect(sugerirDigitando('a', ACOES).length).toBeLessThanOrEqual(0))
})
