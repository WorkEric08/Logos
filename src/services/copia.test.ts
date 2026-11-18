// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { Blob as BlobDoNode } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// (o Blob do jsdom não sobrevive ao banco de mentira nem tem arrayBuffer; o do Node, que o navegador de verdade imita, sim: por isso a imagem guardada vem de lá)

// Cópia de segurança de verdade: grava conteúdo no banco, salva, APAGA tudo, restaura e confere que voltou igual (inclusive as imagens), sem duplicar na 2ª vez.
const entregues: { nome: string; texto: string }[] = []
vi.mock('./native/arquivos', () => ({ salvarArquivo: async (nome: string, texto: string) => { entregues.push({ nome, texto }); return 'compartilhado' } }))

type Db = typeof import('./db')
type Cp = typeof import('./copia')
let db: Db, cp: Cp
beforeEach(async () => {
  await Dexie.delete('treino-bb'); vi.resetModules(); entregues.length = 0
  db = await import('./db'); cp = await import('./copia')
})

const espaco = { id: 'e1', nome: 'Direito', criado: 1, fontes: {}, bases: {}, materias: [], extras: [], bancos: [], simulado: null }
const questao = (id: string) => ({ id, y: 2026, s: 'ger-x-2026', n: 1, m: 'Do meu material', t: 'Resumo', a: 'x', e: `Enunciado ${id}`, b: '', o: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, g: 'A' as const, p: null, bp: null, f: 0 as const, ol: 0 as const })
const material = { id: 'm1', e: 'e1', nome: 'Resumo de juros', tipo: 'texto' as const, criado: 5, trechos: 2, caracteres: 30 }
const trechos = [{ id: 'm1:0', m: 'm1', e: 'e1', i: 0, t: 'Juros simples incidem só sobre o capital.' }, { id: 'm1:1', m: 'm1', e: 'e1', i: 1, t: 'Juros compostos rendem juros.' }]
async function popular() {
  await db.salvarEspaco(espaco, [questao('q1'), questao('q2')])
  await db.salvarMaterial(material, trechos)
  await db.gravarImagem('q1', 'e1', new BlobDoNode([new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70])], { type: 'image/jpeg' }) as unknown as Blob)
}
const apagarTudo = async () => { await Dexie.delete('treino-bb'); vi.resetModules(); db = await import('./db'); cp = await import('./copia') }

describe('cópia de segurança: ida e volta', () => {
  it('aparelho vazio: o resumo é zero e a cópia sai sem erro', async () => {
    expect(await cp.resumoDoAparelho()).toEqual({ espacos: 0, questoes: 0, imagens: 0, materiais: 0, trechos: 0 })
    const r = await cp.salvarCopia(1_700_000_000_000)
    expect(r.ok).toBe(true); expect(entregues[0].nome).toBe('logos-copia-2023-11-14.json')
  })
  it('salva, apaga tudo e restaura: espaço, questões, material, trechos e a imagem voltam iguais', async () => {
    await popular()
    expect(await cp.resumoDoAparelho()).toEqual({ espacos: 1, questoes: 2, imagens: 1, materiais: 1, trechos: 2 })
    const r = await cp.salvarCopia(1_700_000_000_000)
    if (!r.ok) throw new Error(r.erro)
    expect(r).toMatchObject({ ok: true, resumo: { espacos: 1, questoes: 2, materiais: 1 }, resultado: 'compartilhado' })
    expect(await db.lerUltimaCopia()).toBe(1_700_000_000_000)
    const arquivo = entregues[0].texto
    await apagarTudo()
    expect(await cp.resumoDoAparelho()).toMatchObject({ espacos: 0, questoes: 0, materiais: 0 })
    const rest = await cp.restaurarCopia(arquivo)
    expect(rest).toMatchObject({ ok: true, novos: { espacos: 1, questoes: 2, imagens: 1, materiais: 1, trechos: 2 }, jaExistiam: { espacos: 0, questoes: 0, imagens: 0, materiais: 0, trechos: 0 } })
    const e = await db.lerEspaco('e1')
    expect(e?.row.nome).toBe('Direito'); expect(e?.questoes.map((q) => q.id).sort()).toEqual(['q1', 'q2'])
    expect((await db.listarMateriais('e1'))[0].nome).toBe('Resumo de juros')
    expect((await db.trechosDoMaterial('m1')).map((t) => t.t)).toEqual(trechos.map((t) => t.t))
    expect(await db.lerImagem('q1')).not.toBeNull() // a imagem voltou
    expect(arquivo).toContain('"dados":"/9j/4AAQSkY="') // e foi na cópia como base64 dos mesmos bytes (o jsdom não guarda o conteúdo de um Blob no banco de mentira: os bytes de volta estão no teste abaixo)
  })
  it('imagem: ida e volta pelos bytes (base64), com o tipo', async () => {
    const bytes = [255, 216, 255, 224, 0, 16, 74, 70]
    const lerBytes = (b: Blob) => new Promise<number[]>((ok) => { const r = new FileReader(); r.onload = () => ok([...new Uint8Array(r.result as ArrayBuffer)]); r.readAsArrayBuffer(b) })
    const b64 = await cp.paraBase64(new BlobDoNode([new Uint8Array(bytes)], { type: 'image/jpeg' }) as unknown as Blob)
    expect(b64).toBe('/9j/4AAQSkY=')
    const volta = cp.deBase64(b64, 'image/jpeg')
    expect(volta.type).toBe('image/jpeg'); expect(volta.size).toBe(8)
    expect(await lerBytes(volta)).toEqual(bytes)
    const grande = new Uint8Array(200_000).map((_, i) => i % 251) // maior que um pedaço de 32 mil: sem estourar a pilha
    expect(await lerBytes(cp.deBase64(await cp.paraBase64(new BlobDoNode([grande]) as unknown as Blob), 'image/png'))).toEqual([...grande])
  })
  it('restaurar duas vezes não duplica: na 2ª nada é novo e tudo "já existia"', async () => {
    await popular(); await cp.salvarCopia(1); const arquivo = entregues[0].texto
    const r = await cp.restaurarCopia(arquivo)
    expect(r).toMatchObject({ ok: true, novos: { espacos: 0, questoes: 0, imagens: 0, materiais: 0, trechos: 0 }, jaExistiam: { espacos: 1, questoes: 2, imagens: 1, materiais: 1, trechos: 2 } })
    expect(await cp.resumoDoAparelho()).toEqual({ espacos: 1, questoes: 2, imagens: 1, materiais: 1, trechos: 2 })
  })
  it('restaurar num aparelho que já tem outras coisas só acrescenta (não apaga nem troca o que existe)', async () => {
    await popular(); await cp.salvarCopia(1); const arquivo = entregues[0].texto
    await apagarTudo()
    await db.salvarEspaco({ ...espaco, id: 'outro', nome: 'Outro espaço' }, [questao('q9')]) // o que a pessoa já tinha neste aparelho
    const r = await cp.restaurarCopia(arquivo)
    expect(r.ok).toBe(true)
    expect((await db.listarEspacos()).map((x) => x.nome).sort()).toEqual(['Direito', 'Outro espaço'])
    expect((await db.lerEspaco('outro'))?.questoes.map((q) => q.id)).toEqual(['q9'])
  })
  // C-8: o estudo (progresso, histórico, baralhos, cartões) vai na cópia e volta
  const baralho = { id: 'b1', nome: 'Siglas', criado: 1 }
  const cartao = (id: string) => ({ id, b: 'b1', f: 'Frente ' + id, v: 'Verso ' + id, estado: 'novo' as const, criado: 2, ult: 0, due: 0, ef: 2.5, iv: 0, lapsos: 0, reps: 0 })
  const prog = { q1: { n: 3, c: 2, ok: true as const, last: 'A' as const, t: 9 }, q2: { n: 1, c: 0, ok: false as const, last: 'B' as const, t: 5 } }
  const hist = { dias: { '2026-11-17': { n: 10, c: 7 } }, sims: [{ t: 100, p: 55, b: 20, e: 35, c: 40, n: 70, ok: true }] }
  const histCards = { dias: { '2026-11-16': { n: 4, c: 3 } }, sims: [] }
  const marks = { q1: { r: true, a: 'rever o gabarito', t: 50 } }
  async function estudar() {
    await db.saveBaralho(baralho as never); await db.saveCartoes([cartao('c1'), cartao('c2')] as never)
    await db.replaceAll(prog); await db.saveHist(hist); await db.saveFcHist(histCards); await db.saveMarks(marks)
  }
  it('C-8 ida e volta: salva com o estudo, apaga tudo, restaura e confere baralhos, cartões, progresso e histórico', async () => {
    await popular(); await estudar()
    const r = await cp.salvarCopia(1); if (!r.ok) throw new Error(r.erro)
    expect(r.estudo).toEqual({ baralhos: 1, cartoes: 2, questoesVistas: 2, diasEstudados: 1, simulados: 1, marcacoes: 1 })
    const arquivo = entregues[0].texto
    expect(JSON.parse(arquivo).versao).toBe(2)
    await apagarTudo()
    expect((await db.loadCards()).cartoes).toHaveLength(0); expect(await db.loadAll()).toMatchObject({ prog: {}, hist: { dias: {}, sims: [] } })
    const rest = await cp.restaurarCopia(arquivo)
    if (!rest.ok) throw new Error(rest.erro)
    expect(rest.estudo.novos).toEqual({ baralhos: 1, cartoes: 2, questoesVistas: 2, diasEstudados: 1, simulados: 1, marcacoes: 1 })
    expect(rest.estudo).toMatchObject({ mudouProgresso: true, mudouCards: true, prog, hist })
    const cards = await db.loadCards()
    expect(cards.baralhos.map((b) => b.id)).toEqual(['b1']); expect(cards.cartoes.map((c) => c.id).sort()).toEqual(['c1', 'c2']); expect(cards.hist).toEqual(histCards)
    // (o progresso e o histórico juntados são aplicados por quem chama, pela loja: aqui conferimos o que ela receberia)
    await db.replaceAll(rest.estudo.prog); await db.saveHist(rest.estudo.hist)
    const volta = await db.loadAll(); expect(volta.prog).toEqual(prog); expect(volta.hist).toEqual(hist)
    expect(volta.marks).toEqual(marks) // F-17: a marcação e a anotação voltaram (o service as grava direto)
  })
  it('F-18: o desfazer da restauração tira baralhos, cartões, histórico dos cards e marcações que ela acrescentou (e só eles)', async () => {
    await popular(); await estudar(); await cp.salvarCopia(1); const arquivo = entregues[0].texto
    await apagarTudo()
    await db.saveBaralho({ id: 'meu', nome: 'Meu baralho', criado: 1 } as never); await db.saveCartoes([cartao('meu1')].map((c) => ({ ...c, b: 'meu' })) as never) // o que a pessoa já tinha
    const r = await cp.restaurarCopia(arquivo)
    if (!r.ok) throw new Error(r.erro)
    expect((await db.loadCards()).cartoes.map((c) => c.id).sort()).toEqual(['c1', 'c2', 'meu1']); expect((await db.loadAll()).marks).toEqual(marks)
    await r.estudo.desfazer()
    const c = await db.loadCards()
    expect(c.baralhos.map((b) => b.id)).toEqual(['meu']); expect(c.cartoes.map((x) => x.id)).toEqual(['meu1']); expect(c.hist).toEqual({ dias: {}, sims: [] })
    expect((await db.loadAll()).marks).toEqual({})
  })
  it('C-8 restaurar de novo não muda nada, e num aparelho com estudo MAIOR nada diminui', async () => {
    await popular(); await estudar(); await cp.salvarCopia(1); const arquivo = entregues[0].texto
    const de_novo = await cp.restaurarCopia(arquivo)
    expect(de_novo).toMatchObject({ ok: true, estudo: { mudouProgresso: false, mudouCards: false, novos: { baralhos: 0, cartoes: 0, questoesVistas: 0, diasEstudados: 0, simulados: 0, marcacoes: 0 } } })
    // o aparelho estudou mais depois da cópia: a restauração não diminui nada
    await db.replaceAll({ ...prog, q1: { ...prog.q1, n: 9, c: 8 } }); await db.saveHist({ ...hist, dias: { '2026-11-17': { n: 50, c: 40 } } })
    const r = await cp.restaurarCopia(arquivo)
    if (!r.ok) throw new Error(r.erro)
    expect(r.estudo.prog.q1.n).toBe(9); expect(r.estudo.hist.dias['2026-11-17']).toEqual({ n: 50, c: 40 }); expect(r.estudo.mudouProgresso).toBe(false)
  })
  it('C-8 cópia antiga (versão 1, sem o estudo) restaura como antes, sem mexer no estudo do aparelho', async () => {
    await popular(); await cp.salvarCopia(1)
    const velha = { ...JSON.parse(entregues[0].texto), versao: 1 }; delete velha.estudo
    await estudar()
    const r = await cp.restaurarCopia(JSON.stringify(velha))
    expect(r).toMatchObject({ ok: true, estudo: { mudouProgresso: false, mudouCards: false } })
    expect((await db.loadCards()).cartoes).toHaveLength(2); expect((await db.loadAll()).prog).toEqual(prog)
  })
  it('arquivo que não é uma cópia: erro claro e nada muda', async () => {
    await popular()
    const r = await cp.restaurarCopia('{"qualquer":"coisa"}')
    expect(r).toEqual({ ok: false, erro: 'Este arquivo não é uma cópia do Logos.' })
    expect(await cp.resumoDoAparelho()).toMatchObject({ espacos: 1, questoes: 2 })
  })
  it('se a pessoa cancela a folha de compartilhar, a cópia NÃO conta como feita', async () => {
    vi.resetModules()
    vi.doMock('./native/arquivos', () => ({ salvarArquivo: async () => 'cancelado' }))
    db = await import('./db'); cp = await import('./copia')
    await popular()
    const r = await cp.salvarCopia(5)
    expect(r.ok && r.resultado).toBe('cancelado'); expect(await db.lerUltimaCopia()).toBeNull()
    vi.doUnmock('./native/arquivos')
  })
})
