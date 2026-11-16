// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { DocBusca } from '../../core/busca/documentos'
import { extrairConsulta } from '../../core/busca/consulta'
import { PERGUNTAS, TRECHOS } from './corpus-teste'
import { criarIndice } from './indice'

const docs = (): DocBusca[] => TRECHOS.map((t, i) => ({ id: `m:T:${i}`, tipo: 'material', titulo: 'Resumo de finanças', texto: t, fonte: `Resumo · trecho ${i + 1}` }))

describe('índice de busca: conjunto-ouro (meta do plano: ≥ 95 % com a resposta certa entre os 3 primeiros)', () => {
  it('encontra a resposta certa nos 3 primeiros para ≥ 95 % das 40 perguntas', async () => {
    const indice = await criarIndice(docs())
    const falhas: string[] = []
    for (const [pergunta, certos] of PERGUNTAS) {
      const top = indice.buscar(extrairConsulta(pergunta), 3).map((r) => Number(r.doc.id.split(':')[2]))
      if (!certos.some((c) => top.includes(c))) falhas.push(`"${pergunta}" → [${top.join(',')}] (esperado ${certos.join(' ou ')})`)
    }
    const taxa = 1 - falhas.length / PERGUNTAS.length
    expect(taxa, `acerto ${(taxa * 100).toFixed(1)} % — falhas: ${falhas.join(' | ')}`).toBeGreaterThanOrEqual(0.95)
  })

  it('a resposta certa é o 1º resultado na maioria (≥ 75 %): ranking, não só presença', async () => {
    const indice = await criarIndice(docs())
    let primeiros = 0
    for (const [pergunta, certos] of PERGUNTAS) { const r = indice.buscar(extrairConsulta(pergunta), 1)[0]; if (r && certos.includes(Number(r.doc.id.split(':')[2]))) primeiros++ }
    expect(primeiros / PERGUNTAS.length).toBeGreaterThanOrEqual(0.75)
  })

  it('pergunta sem nada a ver não devolve lixo', async () => {
    const indice = await criarIndice(docs())
    expect(indice.buscar(extrairConsulta('qual a capital da França'), 3).filter((r) => !r.parcial)).toEqual([])
    expect(indice.buscar('zzzxyzq', 3)).toEqual([])
  })

  it('quando nenhum trecho tem TODAS as palavras, completa com os que têm ALGUMAS (e marca como parcial)', async () => {
    const indice = await criarIndice(docs())
    const r = indice.buscar('selic poupança', 5)
    expect(r.length).toBeGreaterThan(1); expect(r.some((x) => x.parcial)).toBe(true)
  })

  it('material pesa mais que questão e cartão para a mesma pergunta', async () => {
    const mistos: DocBusca[] = [
      { id: 'q:1', tipo: 'questao', titulo: 'Prova · questão 1', texto: 'A taxa Selic é definida por qual órgão? Copom, CMN, CVM, BNDES ou Febraban.', fonte: 'Prova · questão 1', ref: '1' },
      { id: 'c:1', tipo: 'cartao', titulo: 'Siglas', texto: 'Selic Taxa básica de juros definida pelo Copom', fonte: 'Cartão', ref: '1' },
      { id: 'm:M:0', tipo: 'material', titulo: 'Resumo', texto: 'A taxa Selic é a taxa básica de juros definida pelo Copom a cada 45 dias.', fonte: 'Resumo' },
    ]
    const r = await (await criarIndice(mistos)).buscar('taxa selic copom', 3)
    expect(r[0].doc.tipo).toBe('material')
  })

  it('orçamento de tempo: construir o índice de 20 mil trechos e buscar leva poucos segundos (o índice não é guardado: é refeito quando precisa)', async () => {
    const muitos: DocBusca[] = Array.from({ length: 20000 }, (_, i) => ({ id: `m:X:${i}`, tipo: 'material', titulo: 'Apostila', texto: `Trecho ${i} sobre ${TRECHOS[i % TRECHOS.length]} ${'palavra '.repeat(40)} numero${i}`, fonte: 'Apostila' }))
    const t0 = performance.now()
    const indice = await criarIndice(muitos)
    const construcao = performance.now() - t0
    const t1 = performance.now()
    for (let i = 0; i < 20; i++) indice.buscar('taxa selic copom', 3)
    const busca = (performance.now() - t1) / 20
    expect(construcao, `construção ${construcao.toFixed(0)} ms`).toBeLessThan(15000)
    expect(busca, `busca ${busca.toFixed(0)} ms`).toBeLessThan(400)
  }, 60000)
})
