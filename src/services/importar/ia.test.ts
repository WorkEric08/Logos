// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QuestaoLida } from '../../core/importar/prova'
import { MODELO_PADRAO, gravarChave, gravarModelo, iaLigada, lerChave, lerModelo, mensagemErroIA, relerComIA, testarChave, type ClienteIA } from './ia'

const questao: QuestaoLida = { numero: 3, materia: 'X', bloco: null, apoio: '', enunciado: 'Texto?', alternativas: { A: 'a', B: 'b' }, pagina: 1, regioes: [], avisos: ['só 2 alternativa(s) encontrada(s)'] }
const boa = JSON.stringify({ legivel: true, apoio: '', enunciado: 'Texto?', alternativas: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, observacao: '' })
const cliente = (resp: { stop_reason: string | null; content: { type: string; text?: string }[] }) => {
  const create = vi.fn(async () => resp), countTokens = vi.fn(async () => ({ input_tokens: 1 }))
  const c: ClienteIA = { beta: { messages: { create } }, messages: { countTokens } }
  return { c, create, countTokens, criar: async () => c }
}

beforeEach(() => localStorage.clear())

describe('IA opcional: chave e modelo ficam só no aparelho', () => {
  it('desligada por padrão; liga com uma chave; remove ao gravar vazio', () => {
    expect(iaLigada()).toBe(false); expect(lerModelo()).toBe(MODELO_PADRAO); expect(MODELO_PADRAO).toBe('claude-opus-5-5')
    gravarChave('  sk-ant-api03-abcdefghijklmnopqrstuvwxyz  '); expect(lerChave()).toBe('sk-ant-api03-abcdefghijklmnopqrstuvwxyz'); expect(iaLigada()).toBe(true)
    gravarChave(''); expect(iaLigada()).toBe(false)
  })
  it('modelo desconhecido volta ao padrão', () => { gravarModelo('claude-sonnet-5-5'); expect(lerModelo()).toBe('claude-sonnet-5-5'); localStorage.setItem('logos_ia_modelo', 'lixo'); expect(lerModelo()).toBe(MODELO_PADRAO) })
})

describe('IA opcional: reler uma questão', () => {
  it('manda imagem + texto, pede saída estruturada e devolve a sugestão', async () => {
    const { criar, create } = cliente({ stop_reason: 'end_turn', content: [{ type: 'text', text: boa }] })
    const s = await relerComIA({ chave: 'k'.repeat(30), modelo: 'claude-opus-5-5', questao, imagem: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), criar })
    expect(s.alternativas.E).toBe('e')
    const corpo = (create.mock.calls[0] as unknown[])[0] as { model: string; system: string; output_config: { format: { type: string } }; messages: { content: { type: string }[] }[]; fallbacks: string }
    expect(corpo.model).toBe('claude-opus-5-5'); expect(corpo.output_config.format.type).toBe('json_schema'); expect(corpo.fallbacks).toBe('default')
    expect(corpo.messages[0].content.map((b) => b.type)).toEqual(['image', 'text']); expect(corpo.system).toContain('NÃO resolva')
  })
  it('sem imagem manda só o texto', async () => {
    const { criar, create } = cliente({ stop_reason: 'end_turn', content: [{ type: 'text', text: boa }] })
    await relerComIA({ chave: 'k'.repeat(30), modelo: 'm', questao, imagem: null, criar })
    expect(((create.mock.calls[0] as unknown[])[0] as { messages: { content: unknown[] }[] }).messages[0].content).toHaveLength(1)
  })
  it('recusa, resposta cortada e resposta ruim viram erro claro (nada entra)', async () => {
    const o = (resp: Parameters<typeof cliente>[0]) => relerComIA({ chave: 'k'.repeat(30), modelo: 'm', questao, imagem: null, criar: cliente(resp).criar })
    await expect(o({ stop_reason: 'refusal', content: [] })).rejects.toThrow(/recusou/)
    await expect(o({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{' }] })).rejects.toThrow(/cortada/)
    await expect(o({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'não é json' }] })).rejects.toThrow(/não conseguiu transcrever/)
  })
  it('testar a chave só conta tokens (não gasta)', async () => {
    const { criar, countTokens, create } = cliente({ stop_reason: 'end_turn', content: [] })
    await testarChave('k'.repeat(30), 'claude-opus-5-5', criar)
    expect(countTokens).toHaveBeenCalledTimes(1); expect(create).not.toHaveBeenCalled()
  })
  it('mensagens de erro em português para o que a pessoa resolve', () => {
    expect(mensagemErroIA({ status: 401 })).toMatch(/chave foi recusada/); expect(mensagemErroIA({ status: 429 })).toMatch(/Limite/)
    expect(mensagemErroIA(new Error('credit balance is too low'))).toMatch(/sem crédito/); expect(mensagemErroIA(new TypeError('Failed to fetch'))).toMatch(/Sem internet/)
  })
})
