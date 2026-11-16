// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// A conversa do assistente: o que ele responde ao que a pessoa escreve ou toca. (Os arquivos e o movimento têm os seus próprios testes: e2e-assistente*.mjs.)
type Loja = typeof import('./assistente')
let loja: Loja
beforeEach(async () => { await Dexie.delete('treino-bb'); vi.resetModules(); loja = await import('./assistente') })

const estado = () => loja.useAssistente.getState()
const fala = (i = -1) => estado().mensagens.at(i)!
const dela = () => estado().mensagens.filter((m) => m.de === 'a')

describe('assistente: conversa por escrito', () => {
  it('a primeira vez ele se apresenta (uma vez só)', async () => {
    await estado().iniciarConversa(); await estado().iniciarConversa()
    expect(estado().mensagens).toHaveLength(1); expect(fala().de).toBe('a'); expect(fala().texto).toMatch(/assistente do Logos/)
  })
  it('mensagem vazia não faz nada', () => { estado().enviar('   '); expect(estado().mensagens).toEqual([]) })
  it('um pedido escrito vira a fala da pessoa e leva ao mesmo fluxo da sugestão', () => {
    estado().enviar('quero importar uma prova')
    expect(estado().mensagens[0]).toMatchObject({ de: 'v', texto: 'quero importar uma prova' })
    expect(estado().etapa).toBe('espaco-novo') // o espaço do BB não recebe arquivos: pede um espaço seu
    expect(estado().depois).toBe('prova'); expect(fala().texto).toMatch(/espaço seu/)
  })
  it('tocar na sugestão e escrever dão o mesmo resultado', () => {
    estado().escolher('cartoes'); const a = estado().etapa
    estado().voltarAoInicio(); estado().enviar('criar cartões')
    expect(estado().etapa).toBe(a); expect(a).toBe('cartoes-arquivo')
  })
  it('pedido que pode ser duas coisas: pergunta qual e guarda as duas opções', () => {
    estado().enviar('quero cartões da prova')
    expect(fala().texto).toMatch(/Quer .* ou .*\?/); expect(estado().desambiguar.sort()).toEqual(['cartoes', 'prova']); expect(estado().etapa).toBe('inicio')
    estado().escolher('prova'); expect(estado().desambiguar).toEqual([]) // escolher limpa a pergunta (o voltarAoInicio também)
  })
  it('o que não entende não inventa: convida a tentar e nada muda', async () => {
    estado().enviar('qual a capital da França')
    await vi.waitFor(() => expect(fala().texto).toMatch(/Não entendi/)); expect(estado().etapa).toBe('inicio')
  })
  it('cumprimento, agradecimento, cancelar e ajuda têm resposta própria', () => {
    estado().enviar('bom dia'); expect(fala().texto).toMatch(/^Oi!/)
    estado().enviar('obrigado'); expect(fala().texto).toMatch(/De nada/)
    estado().enviar('cancelar'); expect(fala().texto).toMatch(/não há nada em andamento/)
    estado().enviar('o que você sabe fazer?'); expect(fala().texto).toMatch(/Importar uma prova em PDF/)
  })
  it('"o que eu já tenho?" responde com os números do espaço', () => {
    estado().enviar('o que eu já tenho?'); expect(fala().texto).toMatch(/1168 questões/)
  })
  it('limita o tamanho do que é escrito', () => {
    estado().enviar('importar prova ' + 'x'.repeat(500)); expect(estado().mensagens[0].texto.length).toBeLessThanOrEqual(200)
  })
  it('erros e sucessos têm tipo (o balão muda de cor e de movimento); conversa normal não tem', () => {
    estado().enviar('ajuda'); expect(dela().every((m) => m.tipo === undefined)).toBe(true)
  })
})

describe('assistente: o que a tela já mostrou', () => {
  it('a contagem de mensagens mostradas só sobe', () => {
    estado().marcarVistas(3); estado().marcarVistas(1); expect(estado().vistas).toBe(3); estado().marcarVistas(5); expect(estado().vistas).toBe(5)
  })
})

describe('assistente: materiais e perguntas (F1)', () => {
  const arquivo = (nome: string, texto: string) => new File([texto], nome, { type: 'text/markdown' })
  const RESUMO = ['# Política monetária', 'A taxa Selic é a taxa básica de juros da economia, definida pelo Copom a cada 45 dias.', 'O Copom é o Comitê de Política Monetária do Banco Central.', 'A inflação é o aumento generalizado dos preços.'].join('\n\n')

  it('guardar um material mostra um balão de sucesso e a lista; guardar o mesmo de novo avisa e não duplica', async () => {
    await estado().guardarMaterial(arquivo('Resumo moeda.md', RESUMO))
    expect(fala().tipo).toBe('ok'); expect(fala().texto).toMatch(/Guardei "Resumo moeda"/); expect(estado().etapa).toBe('material-pronto'); expect(estado().materiais).toHaveLength(1)
    await estado().guardarMaterial(arquivo('outro nome.md', RESUMO))
    expect(fala().texto).toMatch(/já estava guardado/); expect(estado().materiais).toHaveLength(1)
  })
  it('perguntar acha o trecho certo no material guardado, com a fonte', async () => {
    await estado().guardarMaterial(arquivo('Resumo moeda.md', RESUMO))
    await estado().perguntar('o que é Copom?')
    const f = fala()
    expect(f.texto).toMatch(/Achei/); expect(f.achados?.length).toBeGreaterThan(0)
    expect(f.achados![0]).toMatchObject({ tipo: 'material', titulo: 'Resumo moeda' }); expect(f.achados![0].trecho.destaques.length).toBeGreaterThan(0)
  })
  it('escrever uma pergunta usa a mesma busca; sem resultado diz que não achou', async () => {
    await estado().guardarMaterial(arquivo('Resumo moeda.md', RESUMO))
    estado().enviar('onde fala de inflação?'); await vi.waitFor(() => expect(fala().achados?.length).toBeGreaterThan(0))
    estado().enviar('o que é xablaupfrt?'); await vi.waitFor(() => expect(fala().texto).toMatch(/Não achei "xablaupfrt"/))
  })
  it('texto que não é comando mas é o nome de algo guardado também responde (como a busca de uma paleta de comandos)', async () => {
    await estado().guardarMaterial(arquivo('Resumo moeda.md', RESUMO))
    estado().enviar('comite politica monetaria'); await vi.waitFor(() => expect(fala().achados?.length).toBeGreaterThan(0))
  })
  it('apagar o material tira os trechos: a mesma pergunta deixa de achar', async () => {
    await estado().guardarMaterial(arquivo('Resumo moeda.md', RESUMO))
    await estado().apagarMaterial(estado().materiais[0].id)
    expect(estado().materiais).toEqual([]); expect(fala().texto).toMatch(/Apaguei "Resumo moeda"/)
    await estado().perguntar('selic')
    expect(fala().achados?.every((a) => a.tipo !== 'material') ?? true).toBe(true)
  })
  it('arquivo sem texto não vira material e a conversa explica', async () => {
    await estado().guardarMaterial(arquivo('vazio.md', '   \n\n  '))
    expect(fala().tipo).toBe('erro'); expect(fala().texto).toMatch(/escaneado/); expect(estado().materiais).toHaveLength(0)
  })
})

describe('assistente: pedidos com detalhes e perguntas do que falta (F2)', () => {
  let app: typeof import('./app')
  beforeEach(async () => { app = await import('./app') })
  const sessao = () => app.useApp.getState().session

  it('"simulado de matemática com 20 questões" não pergunta nada: monta direto', () => {
    estado().enviar('simulado de matemática com 20 questões')
    expect(estado().pendente).toBeNull(); expect(sessao()?.ids).toHaveLength(20); expect(sessao()?.sim).toBe(true)
    expect(sessao()!.ids.every((id) => app.BY_ID[id].m === 'Matemática')).toBe(true)
    expect(fala().tipo).toBe('ok'); expect(fala().texto).toMatch(/simulado de 20 questões de Matemática/)
  })
  it('"simulado" sozinho pergunta qual (edital ou matéria); tocar na matéria pergunta a quantidade; tocar na quantidade monta', () => {
    estado().enviar('quero um simulado')
    expect(estado().etapa).toBe('pergunta'); expect(estado().pendente?.slot).toBe('materia'); expect(fala().texto).toMatch(/Qual simulado/)
    expect(estado().pendente!.opcoes[0].valor).toBe('edital')
    estado().responder({ rotulo: 'Matemática', valor: 'Matemática' })
    expect(estado().pendente?.slot).toBe('quantidade'); expect(fala().texto).toBe('Quantas questões?')
    estado().responder({ rotulo: '10 questões', valor: 10 })
    expect(estado().pendente).toBeNull(); expect(estado().etapa).toBe('inicio'); expect(sessao()?.ids).toHaveLength(10)
  })
  it('o que foi dito não é perguntado de novo, e as respostas escritas valem como as tocadas', () => {
    estado().enviar('simulado com 15 questões')
    expect(estado().pendente?.slot).toBe('materia'); expect(fala().texto).toBe('De qual matéria?') // sem o do edital: a quantidade já foi dita
    estado().enviar('português')
    expect(estado().pendente).toBeNull(); expect(sessao()?.ids).toHaveLength(15)
    expect(sessao()!.ids.every((id) => app.BY_ID[id].m === 'Língua Portuguesa')).toBe(true)
  })
  it('"o do edital" monta o simulado do edital', () => {
    estado().enviar('simulado'); estado().enviar('o do edital')
    expect(estado().pendente).toBeNull(); expect(sessao()?.ids).toHaveLength(70); expect(fala().texto).toMatch(/edital/)
  })
  it('resposta que não faz sentido repete a pergunta sem perder o pedido; "cancelar" desiste', () => {
    estado().enviar('simulado de matemática')
    expect(estado().pendente?.slot).toBe('quantidade')
    estado().enviar('banana'); expect(fala().texto).toMatch(/Não entendi essa resposta\. Quantas questões\?/); expect(estado().pendente?.slot).toBe('quantidade')
    estado().enviar('cancelar'); expect(estado().pendente).toBeNull(); expect(estado().etapa).toBe('inicio'); expect(sessao()).toBeNull()
  })
  it('escrever outro pedido no meio da pergunta troca de assunto', () => {
    estado().enviar('simulado'); estado().enviar('criar cartões')
    expect(estado().pendente).toBeNull(); expect(estado().etapa).toBe('cartoes-arquivo')
  })
  it('treinar: sem nada pergunta a matéria; com a matéria usa 10 questões; com a prova usa as dela', () => {
    estado().enviar('quero treinar'); expect(estado().pendente?.slot).toBe('materia')
    estado().responder({ rotulo: 'Matemática', valor: 'Matemática' })
    expect(sessao()?.ids).toHaveLength(10); expect(sessao()?.sim).toBe(false)
    app.useApp.getState().leave(); estado().voltarAoInicio()
    estado().enviar('treinar a prova do bb 2021')
    const ids = sessao()!.ids
    expect(ids.length).toBeGreaterThan(0); expect(ids.every((id) => app.BY_ID[id].s === 'bb-2021')).toBe(true)
  })
  it('"quantas questões de matemática tenho?" conta no espaço', () => {
    estado().enviar('quantas questões de matemática eu tenho?')
    const n = app.BANK.filter((q) => q.m === 'Matemática').length
    expect(fala().texto).toContain(`${n} questões de Matemática`)
  })
  it('"criar espaço Y" por escrito; criar se desfaz e volta ao espaço de antes', async () => {
    const { useEspacos } = await import('./espacos')
    await useEspacos.getState().iniciar()
    estado().enviar('criar espaço Direito Penal')
    await vi.waitFor(() => expect(useEspacos.getState().lista.some((e) => e.nome === 'Direito Penal')).toBe(true))
    await vi.waitFor(() => expect(estado().desfazivel).toMatch(/Direito Penal/))
    expect(useEspacos.getState().ativo).not.toBe('bb')
    estado().enviar('desfazer')
    await vi.waitFor(() => expect(fala().texto).toMatch(/Desfiz: criar o espaço "Direito Penal"/))
    expect(useEspacos.getState().lista.some((e) => e.nome === 'Direito Penal')).toBe(false); expect(useEspacos.getState().ativo).toBe('bb')
  })
})

describe('assistente: desfazer, histórico e limpar (F2)', () => {
  const arquivo = (nome: string, texto: string) => new File([texto], nome, { type: 'text/markdown' })
  const TEXTO = '# Moeda\nA taxa Selic é a taxa básica de juros da economia brasileira, definida pelo Copom.\nO Copom se reúne a cada 45 dias.'

  it('desfazer sem nada a desfazer explica', () => {
    estado().enviar('desfazer'); expect(fala().texto).toMatch(/nada para desfazer/)
  })
  it('guardar um material se desfaz; apagar um material se desfaz e a busca volta a achar', async () => {
    await estado().guardarMaterial(arquivo('Moeda.md', TEXTO))
    expect(estado().desfazivel).toMatch(/guardar "Moeda"/)
    estado().desfazer(); await vi.waitFor(() => expect(fala().texto).toMatch(/Desfiz: guardar "Moeda"/))
    expect(estado().materiais).toHaveLength(0); expect(estado().desfazivel).toBeNull()
    await estado().guardarMaterial(arquivo('Moeda.md', TEXTO))
    await estado().apagarMaterial(estado().materiais[0].id)
    expect(estado().materiais).toHaveLength(0)
    estado().enviar('desfazer'); await vi.waitFor(() => expect(estado().materiais).toHaveLength(1))
    await estado().perguntar('o que é Copom?'); expect(fala().achados?.some((a) => a.tipo === 'material')).toBe(true)
  })
  it('só a última coisa se desfaz (desfazer duas vezes: a segunda não tem o que desfazer)', async () => {
    await estado().guardarMaterial(arquivo('Moeda.md', TEXTO))
    estado().enviar('desfazer'); await vi.waitFor(() => expect(fala().texto).toMatch(/Desfiz/))
    estado().enviar('desfazer'); await vi.waitFor(() => expect(fala().texto).toMatch(/nada para desfazer/))
  })
  it('a conversa fica guardada e volta na próxima abertura do app, de uma vez', async () => {
    await estado().iniciarConversa()
    estado().enviar('ajuda'); estado().enviar('oi')
    const antes = estado().mensagens.map((x) => x.texto)
    await new Promise((r) => setTimeout(r, 50))
    vi.resetModules(); loja = await import('./assistente') // "abrir o app de novo": o módulo começa do zero, o banco continua
    await estado().iniciarConversa()
    expect(estado().mensagens.map((x) => x.texto)).toEqual(antes)
    expect(estado().vistas).toBe(antes.length) // já vistas: nada refaz a animação da conversa
  })
  it('limpar a conversa pergunta antes; "Manter" não apaga; "Apagar" apaga só o histórico e recomeça', async () => {
    await estado().iniciarConversa(); estado().enviar('ajuda')
    estado().enviar('limpar conversa')
    expect(estado().etapa).toBe('limpar'); expect(fala().texto).toMatch(/Apagar toda a conversa/)
    estado().voltarAoInicio(); expect(estado().mensagens.length).toBeGreaterThan(3)
    const epoca = estado().epoca
    await estado().limparConversa()
    expect(estado().epoca).toBe(epoca + 1); expect(estado().mensagens).toHaveLength(1); expect(fala().texto).toMatch(/assistente do Logos/)
    await new Promise((r) => setTimeout(r, 50))
    vi.resetModules(); loja = await import('./assistente'); await estado().iniciarConversa()
    expect(estado().mensagens).toHaveLength(1) // o que foi apagado não volta
  })
  it('só ficam as últimas 300 falas', async () => {
    const { gravarConversa, lerConversa, LIMITE_CONVERSA } = await import('../services/db')
    await gravarConversa(Array.from({ length: LIMITE_CONVERSA + 40 }, (_, i) => ({ id: i + 1, de: 'a' as const, texto: 'fala ' + i })))
    const l = await lerConversa()
    expect(l).toHaveLength(LIMITE_CONVERSA); expect(l[0].texto).toBe('fala 40')
  })
})

describe('assistente: sugestões ao digitar (F2)', () => {
  it('o rascunho é limitado e zera ao enviar', () => {
    estado().digitar('x'.repeat(300)); expect(estado().rascunho).toHaveLength(200)
    estado().digitar('ajuda'); estado().enviar('ajuda'); expect(estado().rascunho).toBe('')
  })
  it('"Procurar … no meu material" pergunta de verdade e zera o rascunho', async () => {
    estado().digitar('inflacao'); estado().procurar('inflacao')
    expect(estado().rascunho).toBe(''); expect(estado().mensagens[0]).toMatchObject({ de: 'v', texto: 'inflacao' })
    await vi.waitFor(() => expect(estado().mensagens.length).toBeGreaterThan(1))
  })
})
