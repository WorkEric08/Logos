import { beforeEach, describe, expect, it, vi } from 'vitest'

const writeFile = vi.fn(async (_o?: unknown) => ({ uri: 'file:///cache/backup.json' }))
const share = vi.fn(async (_o?: unknown) => ({}))
let nativo = true
vi.mock('@capacitor/filesystem', () => ({ Filesystem: { writeFile: (o: unknown) => writeFile(o) }, Directory: { Cache: 'CACHE' }, Encoding: { UTF8: 'utf8' } }))
vi.mock('@capacitor/share', () => ({ Share: { share: (o: unknown) => share(o) } }))
vi.mock('./index', () => ({ ehNativo: () => nativo }))
import { salvarArquivo } from './arquivos'

beforeEach(() => { vi.clearAllMocks(); nativo = true })

describe('salvar arquivo (backup, lista de cartões)', () => {
  it('no APK: grava no cache do app (sem permissão) e abre a folha de compartilhar com o arquivo', async () => {
    const r = await salvarArquivo('treino-bb-backup.json', '{"v":3}', 'application/json')
    expect(r).toBe('compartilhado')
    expect(writeFile).toHaveBeenCalledWith({ path: 'treino-bb-backup.json', data: '{"v":3}', directory: 'CACHE', encoding: 'utf8' })
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: ['file:///cache/backup.json'] }))
  })
  it('no APK: fechar a folha de compartilhar sem escolher não é erro', async () => {
    share.mockRejectedValueOnce(new Error('Share canceled'))
    expect(await salvarArquivo('a.json', '{}', 'application/json')).toBe('cancelado')
  })
  it('no APK: erro de verdade (disco cheio) sobe para a tela avisar', async () => {
    writeFile.mockRejectedValueOnce(new Error('sem espaço'))
    await expect(salvarArquivo('a.json', '{}', 'application/json')).rejects.toThrow('sem espaço')
  })
  it('no navegador: não usa o plugin; baixa o arquivo (<a download>) quando não dá para compartilhar', async () => {
    nativo = false
    const clique = vi.fn(); const orig = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = clique
    URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn()
    expect(await salvarArquivo('a.txt', 'oi', 'text/plain')).toBe('baixado')
    expect(clique).toHaveBeenCalled(); expect(writeFile).not.toHaveBeenCalled(); expect(share).not.toHaveBeenCalled()
    HTMLAnchorElement.prototype.click = orig
  })
})
