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
    const p = planoDeRestauracao(c, ids({ espacos: ['e1'], questoes: ['q1', 'q2'], materiais: ['m1'], trechos: ['m1:0'] }))
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
    const tudo = ids({ espacos: ['e1', 'e2'], questoes: ['q1', 'q2', 'q3'], imagens: ['q1'], materiais: ['m1'], trechos: ['m1:0', 'm1:1'] })
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
