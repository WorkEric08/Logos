// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    expect(estado().pendente?.slot).toBe('materia'); expect(fala().texto).toMatch(/^De qual matéria\?/) // sem o do edital: a quantidade já foi dita
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

describe('assistente: cartões 2.0 (F3)', () => {
  const arquivo = (nome: string, texto: string) => new File([texto], nome, { type: 'text/markdown' })
  const RESUMO = ['Selic::Taxa básica de juros da economia', '', 'O Banco Central do Brasil (BACEN) regula o sistema financeiro nacional.', '', 'Os poderes da União:', '', '- Legislativo', '', '- Executivo', '', '- Judiciário', '', 'Isso: algo que ninguém sabe dizer direito aqui.'].join('\n')

  it('a prévia traz cartões da marcação, das siglas e das listas, e conta os barrados pela qualidade', async () => {
    await estado().lerCartoes(arquivo('resumo.md', RESUMO))
    const c = estado().cartoes!
    expect(c.sug.cartoes.map((x) => x.tipo)).toEqual(['sintaxe', 'sigla', 'sigla', 'lista', 'lista', 'lista'])
    expect(c.sug.descartados).toHaveLength(1)
    expect(estado().mensagens.find((m) => /barrado/.test(m.texto))?.texto).toMatch(/1 cartão foi barrado pelas regras de qualidade \(por exemplo: pronome solto/)
  })
  it('só o que foi barrado: explica o motivo em vez de dizer que não achou nada', async () => {
    await estado().lerCartoes(arquivo('ruim.md', 'Isso: algo que ninguém sabe dizer direito aqui.'))
    expect(estado().etapa).toBe('cartoes-arquivo'); expect(estado().mensagens.some((m) => /foram barrados pelas regras de qualidade/.test(m.texto) || /barrados/.test(m.texto))).toBe(true)
  })
  it('o cartão de uma questão ganha o trecho do material que fala do assunto (só do material, e só resposta completa)', async () => {
    const { trechoParaQuestao } = await import('../services/busca/consultar')
    await estado().guardarMaterial(arquivo('Moeda.md', '# Moeda\nA taxa Selic é a taxa básica de juros da economia brasileira, definida pelo Copom a cada 45 dias.'))
    expect(await trechoParaQuestao({ a: 'taxa Selic', t: 'Atualidades' })).toMatchObject({ fonte: expect.stringContaining('Moeda'), texto: expect.stringContaining('taxa básica de juros') })
    expect(await trechoParaQuestao({ a: 'xablaupfrt', t: 'Atualidades' })).toBeNull()
    expect(await trechoParaQuestao({ a: '', t: '' })).toBeNull()
  })
})

describe('assistente: caderno de erros e simulado da semana (F5)', () => {
  let app: typeof import('./app')
  let ev: typeof import('../core/sync/eventos')
  beforeEach(async () => { app = await import('./app'); ev = await import('../core/sync/eventos') })
  const sessao = () => app.useApp.getState().session
  /** Põe respostas ERRADAS (uma por questão) para as questões dadas, como se o app as tivesse registrado. */
  const errar = (ids: string[]) => loja.useAssistente.setState({ eventos: ids.map((id, i) => ev.resposta('d1', id, 'B', false, 1000 + i)) })
  const mat = (m: string, n: number) => app.BANK.filter((q) => q.m === m).slice(0, n).map((q) => q.id)

  it('caderno vazio: diz que está vazio (e que é bom sinal), sem abrir painel', () => {
    estado().enviar('caderno de erros')
    expect(fala().texto).toMatch(/caderno de erros está vazio/); expect(estado().etapa).toBe('inicio')
  })
  it('"caderno de erros" resume (total, onde mais erra) e abre as saídas', () => {
    errar([...mat('Matemática', 3), ...mat('Língua Portuguesa', 1)])
    estado().enviar('caderno de erros')
    expect(estado().etapa).toBe('caderno'); expect(fala().texto).toMatch(/4 questões: 4 erradas na última vez e 0 já acertadas/); expect(fala().texto).toMatch(/Matemática \(3\), Língua Portuguesa \(1\)/)
  })
  it('"rever erros de matemática" vai direto: só as do caderno naquela matéria, como treino (não simulado)', () => {
    errar([...mat('Matemática', 3), ...mat('Língua Portuguesa', 2)])
    estado().enviar('rever erros de matemática')
    expect(sessao()?.ids.sort()).toEqual(mat('Matemática', 3).sort()); expect(sessao()?.sim).toBe(false)
    expect(fala().texto).toMatch(/treino de 3 questões do seu caderno de erros de Matemática/)
  })
  it('as saídas do painel do caderno: rever tudo, só uma matéria, simulado só dos erros', () => {
    errar([...mat('Matemática', 3), ...mat('Língua Portuguesa', 2)])
    estado().enviar('meus erros'); expect(estado().etapa).toBe('caderno')
    estado().cadernoAcao('rever'); expect(sessao()?.ids).toHaveLength(5)
    app.useApp.getState().leave(); estado().voltarAoInicio()
    estado().cadernoAcao({ materia: 'Língua Portuguesa', rotulo: 'Português' }); expect(sessao()?.ids).toHaveLength(2)
    app.useApp.getState().leave(); estado().voltarAoInicio()
    estado().cadernoAcao('simulado'); expect(estado().pendente?.slot).toBe('quantidade')
    estado().responder({ rotulo: '10 questões', valor: 10 }); expect(sessao()?.sim).toBe(true); expect(sessao()?.ids).toHaveLength(5) // só tem 5 no caderno
  })
  it('"simulado de 30 com o que mais erro": simulado só do caderno; os que mais erraram vêm primeiro', () => {
    const [a, b, c] = mat('Matemática', 3)
    loja.useAssistente.setState({ eventos: [ev.resposta('d1', a, 'B', false, 1), ev.resposta('d1', b, 'B', false, 2), ev.resposta('d1', b, 'B', false, 3), ev.resposta('d1', c, 'B', false, 4)] })
    estado().enviar('simulado de 2 questões com o que mais erro')
    expect(sessao()?.sim).toBe(true); expect(sessao()?.ids[0]).toBe(b) // b errou 2 vezes
    expect(sessao()?.ids).toHaveLength(2)
  })
  it('3 acertos seguidos tiram a questão do caderno', () => {
    const [a] = mat('Matemática', 1)
    loja.useAssistente.setState({ eventos: [ev.resposta('d1', a, 'B', false, 1), ev.resposta('d1', a, 'A', true, 2), ev.resposta('d1', a, 'A', true, 3), ev.resposta('d1', a, 'A', true, 4)] })
    estado().enviar('caderno de erros'); expect(fala().texto).toMatch(/está vazio/)
  })
  it('a pergunta do simulado oferece "Simulado da semana" (sempre) e "Só dos meus erros" (se houver erros)', () => {
    estado().enviar('simulado'); expect(estado().pendente!.opcoes.map((o) => o.valor)).toContain('semana'); expect(estado().pendente!.opcoes.map((o) => o.valor)).not.toContain('erros')
    estado().cancelarPergunta()
    errar(mat('Matemática', 2))
    estado().enviar('simulado'); expect(estado().pendente!.opcoes.find((o) => o.valor === 'erros')?.rotulo).toBe('Só dos meus erros (2)')
  })
  it('"simulado da semana" pergunta só o tamanho; monta mistura de erros, fracas e novas e explica a mistura', () => {
    errar(mat('Matemática', 6))
    estado().enviar('simulado da semana'); expect(estado().pendente?.slot).toBe('quantidade')
    estado().responder({ rotulo: '20 questões', valor: 20 })
    expect(sessao()?.sim).toBe(true); expect(sessao()?.ids).toHaveLength(20); expect(new Set(sessao()!.ids).size).toBe(20)
    expect(fala().texto).toMatch(/^Montei o simulado da semana com 20 questões: 6 do seu caderno de erros/)
    expect(mat('Matemática', 6).every((id) => sessao()!.ids.includes(id))).toBe(true) // o caderno inteiro entrou
  })
})

describe('assistente: questões geradas do material (F4)', () => {
  let app: typeof import('./app')
  let esp: typeof import('./espacos')
  let RESUMO: string
  beforeEach(async () => { app = await import('./app'); esp = await import('./espacos'); RESUMO = (await import('../core/questoes/fixture')).RESUMO_TESTE })
  const arquivo = (texto: string) => new File([texto], 'Resumo SFN.md', { type: 'text/markdown' })
  const espacoComMaterial = async (usaBB = false) => {
    await esp.useEspacos.getState().iniciar()
    await esp.useEspacos.getState().criar('Meu espaço', usaBB)
    await estado().guardarMaterial(arquivo(RESUMO))
  }

  it('no espaço do Banco do Brasil explica e leva a criar um espaço seu', () => {
    estado().enviar('gerar questões do meu material')
    expect(estado().etapa).toBe('espaco-novo'); expect(estado().depois).toBe('questoes'); expect(fala().texto).toMatch(/espaços seus/)
  })
  it('sem material guardado, pede para guardar um', async () => {
    await esp.useEspacos.getState().iniciar(); await esp.useEspacos.getState().criar('Vazio', false)
    estado().enviar('gerar questões do material')
    await vi.waitFor(() => expect(estado().etapa).toBe('material-arquivo')); expect(fala().texto).toMatch(/preciso de um material seu/)
  })
  it('com um material: monta a prévia (nada entra antes de confirmar)', async () => {
    await espacoComMaterial()
    const antes = app.BANK.length
    estado().enviar('gerar questões do material')
    await vi.waitFor(() => expect(estado().etapa).toBe('questoes-previa'))
    const g = estado().geradas!
    expect(g.geracao.questoes.length).toBeGreaterThanOrEqual(20); expect(g.escolhidas).toHaveLength(g.geracao.questoes.length)
    expect(fala().texto).toMatch(/^Montei \d+ questões de "Resumo SFN"/); expect(app.BANK.length).toBe(antes)
  })
  it('confirmar adiciona como "geradas" (uma prova própria); desmarcar tira da lista; repetir não duplica', async () => {
    await espacoComMaterial()
    estado().enviar('gerar questões do material'); await vi.waitFor(() => expect(estado().etapa).toBe('questoes-previa'))
    const total = estado().geradas!.geracao.questoes.length
    estado().alternarGerada(0); estado().alternarGerada(1)
    await estado().confirmarGeradas()
    expect(estado().etapa).toBe('prova-pronta'); expect(estado().resultado?.n).toBe(total - 2)
    const ger = app.BANK.filter((q) => q.ger)
    expect(ger).toHaveLength(total - 2); expect(ger.every((q) => q.m === 'Do meu material' && q.fonte && q.s === estado().ultimaProva!.chave)).toBe(true)
    expect(fala().texto).toMatch(/Treine na aba Treinar/)
    // de novo: as mesmas questões (mesmos ids): só as duas desmarcadas entram
    estado().voltarAoInicio(); estado().enviar('gerar questões do material'); await vi.waitFor(() => expect(estado().etapa).toBe('questoes-previa'))
    await estado().confirmarGeradas()
    expect(app.BANK.filter((q) => q.ger)).toHaveLength(total); expect(fala().texto).toMatch(/2 questões entraram .* \(\d+ já estavam/)
  })
  it('as geradas nunca entram no simulado do edital', async () => {
    await espacoComMaterial(true) // espaço com as questões do BB + as suas
    estado().enviar('gerar questões do material'); await vi.waitFor(() => expect(estado().etapa).toBe('questoes-previa'))
    await estado().confirmarGeradas()
    expect(app.BANK.some((q) => q.ger)).toBe(true)
    app.useApp.getState().startSimulado()
    expect(app.useApp.getState().session!.ids.some((id) => app.BY_ID[id].ger)).toBe(false)
  })
  it('material sem padrão nenhum: diz o que faltou, não inventa questão', async () => {
    await esp.useEspacos.getState().iniciar(); await esp.useEspacos.getState().criar('Texto corrido', false)
    await estado().guardarMaterial(arquivo('Uma frase solta qualquer sem nenhum padrão reconhecível dentro dela para virar fato de estudo.'))
    estado().enviar('gerar questões do material')
    await vi.waitFor(() => expect(fala().texto).toMatch(/Não achei definições, siglas, números nem perguntas/)); expect(estado().geradas).toBeNull()
  })
})

describe('assistente: painel do dia e plano de estudo (F6)', () => {
  // as gravações do histórico são assíncronas: esperar o fim de cada teste evita que uma fala gravada tarde apareça no banco do teste seguinte
  afterEach(async () => { await new Promise((r) => setTimeout(r, 80)) })
  let app: typeof import('./app')
  let cards: typeof import('./cards')
  let cardsCore: typeof import('../core/cards')
  beforeEach(async () => { app = await import('./app'); cards = await import('./cards'); cardsCore = await import('../core/cards') })
  const sessao = () => app.useApp.getState().session
  const vencido = (id: string) => ({ ...cardsCore.criarCartao({ b: 'b', f: 'frente ' + id, v: 'verso' }, Date.now() - 9e8, id), estado: 'revisao' as const, due: Date.now() - 1000, ivl: 3, reps: 2 })

  it('ao abrir a aba: apresenta-se (1ª vez) e mostra o painel do dia, com a sugestão principal', async () => {
    await estado().abrirAba()
    const [oi, painel] = estado().mensagens
    expect(oi.texto).toMatch(/assistente do Logos/); expect(painel.tipo).toBe('painel')
    expect(painel.texto).toMatch(/^(Bom dia|Boa tarde|Boa noite|Boa madrugada)! Aqui está o seu dia:/); expect(painel.texto).toMatch(/Hoje ainda não estudou/); expect(painel.texto).toMatch(/Sugiro começar por: questões novas \(10\)/)
    expect(estado().painel?.sugestao.id).toBe('novas'); expect(estado().painelMsgId).toBe(painel.id); expect(estado().carregada).toBe(true)
  })
  it('o painel não se repete a cada visita: só depois de 3 horas', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date(2026, 10, 16, 9, 0))
      await estado().abrirAba(); const n = estado().mensagens.length
      vi.setSystemTime(new Date(2026, 10, 16, 10, 30)); await estado().abrirAba()
      expect(estado().mensagens).toHaveLength(n)
      vi.setSystemTime(new Date(2026, 10, 16, 12, 30)); await estado().abrirAba()
      expect(estado().mensagens).toHaveLength(n + 1); expect(estado().mensagens.at(-1)!.tipo).toBe('painel')
    } finally { vi.useRealTimers() }
  })
  it('com cartões vencidos e erros: o painel sugere os cartões e traz o caderno como alternativa', async () => {
    cards.useCards.setState({ cartoes: [vencido('c1'), vencido('c2')], pronto: true })
    const ev = await import('../core/sync/eventos')
    const ids = app.BANK.filter((q) => q.m === 'Matemática').slice(0, 3).map((q) => q.id)
    const db = await import('../services/db'), { HIST_VAZIO } = await import('../core/historico')
    for (const [i, id] of ids.entries()) await db.gravarResposta(id, { n: 1, c: 0, ok: false, last: 'B', t: 1000 + i }, HIST_VAZIO, ev.resposta('d1', id, 'B', false, 1000 + i)) // as respostas erradas ficam no registro, de onde o caderno é lido
    await estado().abrirAba()
    expect(estado().painel?.sugestao).toMatchObject({ id: 'cartoes', n: 2 }); expect(estado().painel?.alternativas[0]).toMatchObject({ id: 'erros', n: 3 })
    expect(estado().mensagens.at(-1)!.texto).toMatch(/Esperando por você: 2 cartões para estudar e 3 questões no caderno de erros/)
  })
  it('as sugestões do painel funcionam: questões novas começam um treino só de questões que nunca apareceram', async () => {
    await estado().abrirAba()
    estado().painelAcao(estado().painel!.sugestao)
    expect(sessao()?.ids).toHaveLength(10); expect(sessao()?.sim).toBe(false)
    expect(sessao()!.ids.every((id) => !app.useApp.getState().prog[id]?.n)).toBe(true)
  })
  it('"tenho 30 minutos": monta o plano (aqui só questões novas: não há cartões nem erros) e abre as saídas', () => {
    estado().enviar('tenho 30 minutos')
    expect(estado().etapa).toBe('plano'); expect(fala().texto).toMatch(/^Plano de 30 minutos:\n1\. 15 questões \(cerca de 30 min\): 15 novas/)
    expect(estado().plano?.questoes.ids).toHaveLength(15)
  })
  it('"plano de estudo" sem o tempo: mostra o dia e pergunta quanto tempo tem; escrever "meia hora" responde', () => {
    estado().enviar('plano de estudo')
    expect(estado().pendente?.slot).toBe('minutos'); expect(estado().pendente!.opcoes.map((o) => o.valor)).toEqual([15, 30, 45, 60, 90]); expect(fala().texto).toBe('Quanto tempo você tem hoje?')
    expect(estado().mensagens.some((x) => /Aqui está o seu dia/.test(x.texto))).toBe(true)
    estado().enviar('meia hora'); expect(estado().etapa).toBe('plano'); expect(estado().plano?.minutos).toBe(30)
  })
  it('o plano com cartões vencidos começa pelos cartões; "Fazer as questões" começa o treino do plano; "Outro tempo" pergunta de novo', () => {
    cards.useCards.setState({ cartoes: Array.from({ length: 10 }, (_, i) => vencido('c' + i)), pronto: true })
    estado().enviar('tenho 20 minutos')
    const pl = estado().plano!
    expect(pl.cartoes).toBe(10); expect(fala().texto).toMatch(/1\. 10 cartões \(cerca de 5 min\)\n2\. 7 questões/)
    estado().planoAcao('questoes'); expect(sessao()?.ids).toEqual(pl.questoes.ids); expect(sessao()?.sim).toBe(false)
    app.useApp.getState().leave(); estado().voltarAoInicio()
    estado().enviar('tenho 20 minutos'); estado().planoAcao('outro'); expect(estado().pendente?.slot).toBe('minutos')
  })
  it('"treinar questões novas" por escrito', () => {
    estado().enviar('treinar 5 questões novas'); expect(sessao()?.ids).toHaveLength(5); expect(fala().texto).toMatch(/treino de 5 questões de questões novas/)
  })
  it('"30 minutos" não é a quantidade de questões de um pedido', () => {
    estado().enviar('simulado de matemática em 30 minutos'); expect(estado().pendente?.slot).toBe('quantidade')
  })
})

describe('assistente: lembrete diário pelo chat', () => {
  // um Android de mentira: o que o app mandaria agendar fica registrado
  const trocas: unknown[][] = []
  let permissao: 'granted' | 'denied' | 'prompt' = 'granted'
  const porta = {
    permissao: async () => permissao,
    pedirPermissao: async () => permissao,
    substituir: async (a: unknown[]) => { trocas.push([...a]) },
    agendarUm: async () => {},
  }
  let lembrete: typeof import('./lembrete')
  const aposta = async (comPorta: boolean) => {
    vi.resetModules()
    vi.doMock('../services/native/notificacoes', () => ({ portaDeNotificacoes: () => (comPorta ? porta : null), aoTocarNaNotificacao: async () => () => {}, CANAL_LEMBRETE: 'lembrete-diario', paraOPlugin: (x: unknown) => x, portaCapacitor: porta }))
    loja = await import('./assistente'); lembrete = await import('./lembrete')
    await lembrete.useLembrete.getState().carregar()
  }
  beforeEach(() => { trocas.length = 0; permissao = 'granted' })
  afterEach(() => { vi.doUnmock('../services/native/notificacoes') })
  const cfg = () => lembrete.useLembrete.getState().config
  const ultimaFala = () => estado().mensagens.at(-1)!.texto

  it('"me lembre às 20h": liga o lembrete na hora dita, agenda e confirma com o próximo aviso', async () => {
    await aposta(true)
    estado().enviar('me lembre às 20h')
    await vi.waitFor(() => expect(ultimaFala()).toMatch(/^Pronto: lembrete diário às 20:00\./))
    expect(cfg()).toEqual({ ativo: true, hora: 20, minuto: 0, periodos: [] })
    expect(trocas.at(-1)!.length).toBeGreaterThanOrEqual(13)
    expect(ultimaFala()).toMatch(/Próximo aviso: (hoje|amanhã) às 20:00/)
  })
  it('"lembrete" sem hora pergunta; tocar num atalho liga naquela hora; depois "desligar o lembrete" desliga', async () => {
    await aposta(true)
    estado().enviar('lembrete')
    expect(estado().pendente?.slot).toBe('horario'); expect(ultimaFala()).toBe('Em que horário quer o lembrete diário?')
    estado().responder(estado().pendente!.opcoes.find((o) => o.valor === '07:30')!)
    await vi.waitFor(() => expect(ultimaFala()).toMatch(/^Pronto: lembrete diário às 07:30\./))
    expect(cfg().ativo).toBe(true)
    estado().enviar('lembrete')
    expect(ultimaFala()).toMatch(/ligado às 07:30/)
    estado().enviar('desligar o lembrete')
    await vi.waitFor(() => expect(ultimaFala()).toMatch(/Desliguei o lembrete diário/))
    expect(cfg().ativo).toBe(false); expect(trocas.at(-1)).toEqual([])
  })
  it('responder escrevendo ("20h30") também vale; "desligar o lembrete" quando já está desligado só avisa', async () => {
    await aposta(true)
    estado().enviar('lembrete'); estado().enviar('8 da noite')
    await vi.waitFor(() => expect(ultimaFala()).toMatch(/^Pronto: lembrete diário às 20:00\./))
    await lembrete.useLembrete.getState().desligar()
    estado().enviar('parar de lembrar')
    await vi.waitFor(() => expect(ultimaFala()).toBe('O lembrete diário já está desligado.'))
  })
  it('sem permissão do Android: não liga e explica onde liberar', async () => {
    permissao = 'denied'
    await aposta(true)
    estado().enviar('me lembre às 19h')
    await vi.waitFor(() => expect(ultimaFala()).toMatch(/Configurações do Android/))
    expect(cfg().ativo).toBe(false); expect(trocas.every((l) => l.length === 0)).toBe(true) // (nenhum aviso agendado; no máximo a limpeza do que sobrou)
  })
  it('no navegador (sem porta) diz que só existe no aplicativo do Android', async () => {
    await aposta(false)
    estado().enviar('me lembre às 20h')
    await vi.waitFor(() => expect(ultimaFala()).toMatch(/só funciona no aplicativo do Android/))
    expect(cfg().ativo).toBe(false)
  })
})

describe('assistente: plano de estudo acompanhado (cartões → questões)', () => {
  afterEach(async () => { await new Promise((r) => setTimeout(r, 80)) })
  let app: typeof import('./app')
  let cards: typeof import('./cards')
  let cardsCore: typeof import('../core/cards')
  let hist: typeof import('../core/historico')
  beforeEach(async () => { app = await import('./app'); cards = await import('./cards'); cardsCore = await import('../core/cards'); hist = await import('../core/historico') })
  const sessao = () => app.useApp.getState().session
  const vencido = (id: string) => ({ ...cardsCore.criarCartao({ b: 'b', f: 'frente ' + id, v: 'verso' }, Date.now() - 9e8, id), estado: 'revisao' as const, due: Date.now() - 1000, ivl: 3, reps: 2 })
  const comVencidos = (n: number) => cards.useCards.setState({ cartoes: Array.from({ length: n }, (_, i) => vencido('c' + i)), pronto: true })
  /** Estuda `n` cartões: o histórico do dia sobe e os cartões estudados saem da fila (voltam em dias). */
  const estudar = (n: number) => {
    const s = cards.useCards.getState()
    let h = s.hist; for (let i = 0; i < n; i++) h = hist.registrarResposta(h, true, Date.now())
    const feitos = new Set(s.cartoes.filter((c) => c.due < Date.now()).slice(0, n).map((c) => c.id))
    cards.useCards.setState({ hist: h, cartoes: s.cartoes.map((c) => (feitos.has(c.id) ? { ...c, due: Date.now() + 5 * 864e5 } : c)) })
  }
  /** Responde questões do plano (o registro de respostas é de onde o assistente lê). */
  const responder = async (ids: string[]) => {
    const ev = await import('../core/sync/eventos'), db = await import('../services/db')
    for (const [i, id] of ids.entries()) await db.gravarResposta(id, { n: 1, c: 1, ok: true, last: app.BY_ID[id].g, t: Date.now() + 5000 + i }, hist.HIST_VAZIO, ev.resposta('d1', id, app.BY_ID[id].g, true, Date.now() + 5000 + i))
  }
  const montar = async (venc = 10, min = 60) => { comVencidos(venc); await estado().abrirAba(); estado().enviar(`tenho ${min} minutos`); return estado().plano! }

  it('montar o plano guarda o andamento (cartões, questões e de onde contar) e promete acompanhar', async () => {
    const pl = await montar(10, 60)
    const a = estado().planoAtivo!
    expect(a).toMatchObject({ cartoes: pl.cartoes, minutos: 60, baseCartoes: 0 }); expect(a.questoes).toEqual(pl.questoes.ids); expect(a.dia).toBe(hist.diaDe(Date.now()))
    expect(fala().texto).toMatch(/Quando você voltar aqui, eu mostro o que ainda falta\. Se sair no meio, o treino fica salvo na aba Treinar por 1 hora; se você entrar nele, leva o tempo que precisar\.$/)
    expect(estado().statusPlano()).toMatchObject({ fase: 'cartoes', cartoesFaltam: pl.cartoes })
    const db = await import('../services/db'); expect(await db.lerPlanoGuardado()).toMatchObject({ cartoes: pl.cartoes })
  })
  it('"Começar pelos cartões" abre direto o estudo e marca que o plano está em curso', async () => {
    await montar(); estado().planoAcao('cartoes')
    expect(estado().planoEmCurso).toBe(true); expect(cards.useCards.getState().pedidoEstudo).toBe(true); expect(app.useApp.getState().tab).toBe('cartoes')
  })
  it('saiu dos cartões no meio: ao voltar, o assistente diz quantos faltam e o botão vira "Continuar os cartões"', async () => {
    const pl = await montar(10, 60) // 10 cartões no plano
    estado().planoAcao('cartoes'); estudar(7)
    await estado().abrirAba()
    expect(estado().planoEmCurso).toBe(false)
    expect(fala()).toMatchObject({ de: 'a', tipo: 'plano' }); expect(fala().texto).toBe(`Faltam ${pl.cartoes - 7} de ${pl.cartoes} cartões do seu plano (você já fez 7). Depois, ${pl.questoes.ids.length} questões.`)
    expect(estado().etapa).toBe('plano'); expect(estado().statusPlano()).toMatchObject({ fase: 'cartoes', cartoesFeitos: 7, cartoesFaltam: pl.cartoes - 7 })
  })
  it('voltar sem ter andado não repete o balão', async () => {
    await montar(); const n = estado().mensagens.length
    await estado().abrirAba(); await estado().abrirAba()
    expect(estado().mensagens).toHaveLength(n)
  })
  it('terminou os cartões e voltou: o balão passa para as questões (a posição em destaque muda)', async () => {
    const pl = await montar(10, 60)
    estudar(pl.cartoes); await estado().abrirAba()
    expect(fala().texto).toBe(`Cartões do plano concluídos! Agora as questões: ${pl.questoes.ids.length} questões.`)
    expect(estado().statusPlano()).toMatchObject({ fase: 'questoes', cartoesFaltam: 0 })
  })
  it('responder parte das questões: ao voltar mostra quantas faltam, e "continuar" começa só com as que faltam', async () => {
    const pl = await montar(4, 60); const q = pl.questoes.ids
    estudar(pl.cartoes); await responder(q.slice(0, 5)); await estado().abrirAba()
    expect(fala().texto).toBe(`Cartões do plano concluídos! Agora as questões: faltam ${q.length - 5} de ${q.length} questões.`)
    estado().planoAcao('questoes')
    expect(sessao()?.ids).toEqual(q.slice(5)); expect(sessao()?.sim).toBe(false); expect(fala().texto).toMatch(/do plano que ainda faltavam\. Bom treino!/)
  })
  it('tudo feito: o balão diz que o plano acabou e a saída é montar outro', async () => {
    const pl = await montar(4, 60)
    estudar(pl.cartoes); await responder(pl.questoes.ids); await estado().abrirAba()
    expect(fala().texto).toMatch(/^Plano de 60 minutos concluído: \d+ cartões e \d+ questões\. Bom trabalho! Quer montar outro\?$/)
    expect(estado().statusPlano()?.fase).toBe('fim')
    estado().planoAcao('questoes'); expect(fala().texto).toMatch(/Você já fez todas as questões do plano/); expect(sessao()).toBeNull()
  })
  it('os Cards avisam que os cartões do plano acabaram: vai direto às questões (com o recado) e o plano deixa de estar em curso', async () => {
    const pl = await montar(10, 60)
    estado().planoAcao('cartoes'); estudar(pl.cartoes)
    estado().concluirCartoesDoPlano()
    expect(estado().planoEmCurso).toBe(false); expect(sessao()?.ids).toEqual(pl.questoes.ids); expect(app.useApp.getState().toast?.text).toBe('Cartões feitos! Agora as questões.')
  })
  it('só entra nas questões quando o plano estava em curso (estudar cartões por conta própria não leva a lugar nenhum)', async () => {
    const pl = await montar(10, 60); estudar(pl.cartoes)
    estado().concluirCartoesDoPlano(); expect(sessao()).toBeNull()
  })
  it('sem questões sobrando, concluir os cartões leva de volta ao assistente', async () => {
    const pl = await montar(4, 60)
    estado().planoAcao('cartoes'); estudar(pl.cartoes); await responder(pl.questoes.ids); await estado().atualizarCaderno()
    app.useApp.getState().setTab('cartoes'); estado().concluirCartoesDoPlano()
    expect(app.useApp.getState().tab).toBe('assistente'); expect(sessao()).toBeNull()
  })
  it('um plano de ontem não vale hoje', async () => {
    await montar(); const a = estado().planoAtivo!
    loja.useAssistente.setState({ planoAtivo: { ...a, dia: '2020-01-01' } })
    expect(estado().statusPlano()).toBeNull(); const n = estado().mensagens.length; await estado().abrirAba(); expect(estado().mensagens).toHaveLength(n)
  })
  it('o plano guardado volta depois de fechar o app', async () => {
    const pl = await montar(10, 60)
    vi.resetModules(); loja = await import('./assistente'); app = await import('./app'); cards = await import('./cards')
    expect(estado().planoAtivo).toBeNull()
    cards.useCards.setState({ cartoes: Array.from({ length: 10 }, (_, i) => vencido('c' + i)), pronto: true })
    await estado().abrirAba()
    expect(estado().planoAtivo).toMatchObject({ cartoes: pl.cartoes }); expect(estado().statusPlano()?.fase).toBe('cartoes')
  })
  it('passar de 5 horas escrevendo: o plano sai de 5 horas e o assistente explica', async () => {
    estado().enviar('tenho 8 horas')
    expect(estado().plano?.minutos).toBe(300); expect(estado().mensagens.some((x) => /O máximo é 5 horas: é importante se esforçar, mas também precisamos descansar/.test(x.texto))).toBe(true)
  })
  it('as sugestões fixas não trazem mais "Perguntar ao meu material" nem "Ligar a ajuda de IA" (escrever o pedido continua valendo)', async () => {
    const { ACOES } = await import('../core/assistente')
    expect(ACOES.filter((a) => a.naLista === false).map((a) => a.id).sort()).toEqual(['ia', 'perguntar'])
    estado().enviar('configurar a IA'); expect(estado().etapa).toBe('ia')
  })
})

describe('assistente: treino do plano guardado na aba Treinar (prazo = o tempo que a pessoa tem)', () => {
  afterEach(async () => { vi.useRealTimers(); await new Promise((r) => setTimeout(r, 80)) })
  let app: typeof import('./app')
  let cards: typeof import('./cards')
  let cardsCore: typeof import('../core/cards')
  beforeEach(async () => { app = await import('./app'); cards = await import('./cards'); cardsCore = await import('../core/cards') })
  const sessao = () => app.useApp.getState().session
  const vencido = (id: string) => ({ ...cardsCore.criarCartao({ b: 'b', f: 'frente ' + id, v: 'verso' }, Date.now() - 9e8, id), estado: 'revisao' as const, due: Date.now() - 1000, ivl: 3, reps: 2 })
  /** Monta um plano só de questões (sem cartões vencidos) de `min` minutos, "agora". */
  const montar = async (min = 60) => { cards.useCards.setState({ cartoes: [vencido('x')].slice(0, 0), pronto: true }); await estado().abrirAba(); estado().enviar(`tenho ${min} minutos`); return estado().plano! }
  const MIN = 60_000

  it('o plano guarda o prazo: o tempo que a pessoa disse ter, a partir de agora; e o treino aparece pronto para continuar', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 17, 10, 0))
    const pl = await montar(120)
    expect(estado().planoAtivo!.validoAte).toBe(Date.now() + 120 * MIN)
    expect(estado().treinoDoPlano()).toEqual({ faltam: pl.questoes.ids.length, total: pl.questoes.ids.length, minutos: 120, restanteMs: 120 * MIN })
    expect(estado().mensagens.some((x) => /o treino fica salvo na aba Treinar por 2 horas; se você entrar nele, leva o tempo que precisar\.$/.test(x.texto))).toBe(true)
  })
  it('sem voltar até o fim do tempo: o treino some da aba Treinar e o plano é descartado (com aviso no assistente)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 17, 10, 0))
    await montar(60)
    vi.setSystemTime(new Date(2026, 10, 17, 10, 59)); expect(estado().treinoDoPlano()).not.toBeNull()
    vi.setSystemTime(new Date(2026, 10, 17, 11, 1)); expect(estado().treinoDoPlano()).toBeNull(); expect(estado().statusPlano()).toBeNull()
    await estado().abrirAba()
    expect(estado().planoAtivo).toBeNull(); expect(estado().mensagens.at(-1)!.texto).toBe('O plano de 1 hora passou do tempo combinado e o treino salvo foi descartado. Se quiser, montamos outro.')
    const db = await import('../services/db'); expect(await db.lerPlanoGuardado()).toBeNull()
  })
  it('entrou no treino: pode levar o tempo que precisar (o prazo não vale lá dentro)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 17, 10, 0))
    const pl = await montar(60)
    estado().continuarTreinoDoPlano()
    expect(sessao()?.ids).toEqual(pl.questoes.ids); expect(estado().sessaoDoPlano).toBe(true)
    vi.setSystemTime(new Date(2026, 10, 17, 14, 0)) // quatro horas depois, ainda dentro do treino
    expect(estado().treinoDoPlano()).not.toBeNull(); expect(estado().statusPlano()?.fase).toBe('questoes')
  })
  it('saiu do treino depois do prazo sem terminar: o que faltava continua salvo pelo tempo que as questões levam (2 min cada)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 17, 10, 0))
    const pl = await montar(30)
    estado().continuarTreinoDoPlano()
    vi.setSystemTime(new Date(2026, 10, 17, 13, 0))
    app.useApp.getState().leave()
    await vi.waitFor(() => expect(estado().sessaoDoPlano).toBe(false))
    const novo = estado().planoAtivo!.validoAte, esperado = new Date(2026, 10, 17, 13, 0).getTime() + pl.questoes.ids.length * 2 * MIN
    expect(novo).toBeGreaterThanOrEqual(esperado); expect(novo).toBeLessThan(esperado + 2000) // (o relógio de mentira anda um pouco enquanto o teste espera)
    expect(estado().treinoDoPlano()).not.toBeNull()
    vi.setSystemTime(novo + 1000); expect(estado().treinoDoPlano()).toBeNull() // e esse novo prazo também acaba
  })
  it('saiu do treino ANTES do prazo: vale o prazo original (o que a pessoa mesma disse; não estica)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 17, 10, 0))
    await montar(120); const antes = estado().planoAtivo!.validoAte
    estado().continuarTreinoDoPlano(); vi.setSystemTime(new Date(2026, 10, 17, 10, 10)); app.useApp.getState().leave()
    await vi.waitFor(() => expect(estado().sessaoDoPlano).toBe(false))
    expect(estado().planoAtivo!.validoAte).toBe(antes)
  })
  it('terminou todas as questões: não há mais treino salvo', async () => {
    const pl = await montar(60)
    const ev = await import('../core/sync/eventos'), db = await import('../services/db'), { HIST_VAZIO } = await import('../core/historico')
    for (const [i, id] of pl.questoes.ids.entries()) await db.gravarResposta(id, { n: 1, c: 1, ok: true, last: app.BY_ID[id].g, t: Date.now() + 5000 + i }, HIST_VAZIO, ev.resposta('d1', id, app.BY_ID[id].g, true, Date.now() + 5000 + i))
    await estado().atualizarCaderno(); expect(estado().treinoDoPlano()).toBeNull()
  })
  it('descartar apaga o plano e o treino salvo; "Desfazer" traz de volta', async () => {
    await montar(60); const antes = estado().planoAtivo!
    estado().descartarPlano()
    expect(estado().planoAtivo).toBeNull(); expect(estado().treinoDoPlano()).toBeNull(); expect(estado().plano).toBeNull()
    const toast = app.useApp.getState().toast!; expect(toast.text).toBe('Treino descartado.'); expect(toast.action?.label).toBe('Desfazer')
    toast.action!.run(); expect(estado().planoAtivo).toEqual(antes); expect(estado().treinoDoPlano()).not.toBeNull()
  })
  it('um plano novo substitui o treino salvo do anterior', async () => {
    const a = await montar(60); const idsA = estado().planoAtivo!.questoes
    app.useApp.getState().leave(); estado().voltarAoInicio(); estado().enviar('tenho 30 minutos')
    expect(estado().planoAtivo!.minutos).toBe(30); expect(estado().planoAtivo!.questoes).not.toEqual(idsA); expect(a.minutos).toBe(60)
  })
  it('pedir o "painel do dia e plano de estudo" de novo, com um plano em andamento: mostra onde ele está (e não pergunta o tempo)', async () => {
    const pl = await montar(60)
    estado().voltarAoInicio(); estado().escolher('plano')
    expect(estado().pendente).toBeNull(); expect(estado().etapa).toBe('plano')
    expect(fala().texto).toMatch(new RegExp(`^Você já tem um plano de 1 hora em andamento\\. Seu plano de hoje: ${pl.questoes.ids.length} questões?`.replace('Seu plano de hoje: ', 'Agora as questões do seu plano: ')))
    expect(fala().texto).toMatch(/O treino fica salvo na aba Treinar até \d\d:\d\d; entrando nele, você leva o tempo que precisar\./)
    estado().planoAcao('outro'); expect(estado().pendente?.slot).toBe('minutos') // "Outro tempo" pergunta de novo
  })
  it('sem plano (ou com plano acabado), "plano de estudo" continua perguntando o tempo', async () => {
    estado().escolher('plano'); expect(estado().pendente?.slot).toBe('minutos')
  })
})
