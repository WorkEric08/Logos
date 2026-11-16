// O "gold set" do diálogo: frases que uma pessoa escreveria de verdade, com o que o assistente DEVE entender (ação + detalhes). Ao mexer em conversa.ts ou entidades.ts,
// nenhuma destas pode piorar. Mede o que o store faz: entender() + entidades + ajuste.
import { describe, expect, it } from 'vitest'
import bank from '../../data/bank.json'
import { BB_EXTRA, BB_SUBJECTS } from '../subjects'
import { entender } from '../conversa'
import { ajustarPelasEntidades, pedidoDe, proximoPasso } from './dialogo'
import { extrairEntidades, type Contexto } from './entidades'

const materias = [...BB_SUBJECTS, ...BB_EXTRA].map((m) => ({ nome: m.n, curto: m.s }))
const provas = Object.entries(bank.sources as Record<string, string>).map(([chave, rotulo]) => ({ chave, rotulo }))
const ctx: Contexto = { materias, provas, espacos: [{ id: 'bb', nome: 'Banco do Brasil' }, { id: 'dp', nome: 'Direito Penal' }], espacoAtivo: 'bb', temRegras: true }

/** O que o assistente faz com a frase: o nome da ação (ou da intenção) e, para simulado/treino, o pedido já com o que foi dito. */
function ler(frase: string) {
  const e = extrairEntidades(frase, ctx)
  const i = ajustarPelasEntidades(entender(frase), e, frase)
  const quem = i.tipo === 'acao' ? i.id : i.tipo
  const pedido = i.tipo === 'acao' && (i.id === 'simulado' || i.id === 'treinar') ? pedidoDe(i.id, e) : undefined
  return { quem, pedido, e }
}

type Esperado = { quem: string; materia?: string; quantidade?: number; provas?: string[]; fonte?: 'erros' | 'semana' | 'novas'; falta?: 'materia' | 'quantidade' | 'nada' }
const SIMULADO_E_TREINO: [string, Esperado][] = [
  // simulado
  ['quero um simulado', { quem: 'simulado', falta: 'materia' }],
  ['montar simulado', { quem: 'simulado', falta: 'materia' }],
  ['simulado do edital', { quem: 'simulado', falta: 'materia' }],
  ['simulado de matemática', { quem: 'simulado', materia: 'Matemática', falta: 'quantidade' }],
  ['simulado de matemática com 20 questões', { quem: 'simulado', materia: 'Matemática', quantidade: 20, falta: 'nada' }],
  ['simulado de 30 questões de português', { quem: 'simulado', materia: 'Língua Portuguesa', quantidade: 30, falta: 'nada' }],
  ['quero um simulado de inglês com 10 questões', { quem: 'simulado', materia: 'Língua Inglesa', quantidade: 10, falta: 'nada' }],
  ['simulado com 20 questões', { quem: 'simulado', quantidade: 20, falta: 'materia' }],
  ['montar um simulado de conhecimentos bancários', { quem: 'simulado', materia: 'Conhecimentos Bancários', falta: 'quantidade' }],
  ['simulado de matemática financeira 15 questões', { quem: 'simulado', materia: 'Matemática Financeira', quantidade: 15, falta: 'nada' }],
  ['simulado de informática', { quem: 'simulado', materia: 'Conhecimentos de Informática', falta: 'quantidade' }],
  ['simulado só de vendas com 40 questões', { quem: 'simulado', materia: 'Vendas e Negociação', quantidade: 40, falta: 'nada' }],
  ['simulado de atualidades 10 questões', { quem: 'simulado', materia: 'Atualidades do Mercado Financeiro', quantidade: 10, falta: 'nada' }],
  ['simulado da prova do bb 2021', { quem: 'simulado', provas: ['bb-2021'], falta: 'quantidade' }],
  ['simulado com 20 questões da prova do bb 2018', { quem: 'simulado', quantidade: 20, provas: ['bb-2018'], falta: 'nada' }],
  ['simulado cronometrado', { quem: 'simulado', falta: 'materia' }],
  ['quero fazer um simulado de estatística', { quem: 'simulado', materia: 'Estatística', falta: 'quantidade' }],
  // treino
  ['quero treinar', { quem: 'treinar', falta: 'materia' }],
  ['treinar', { quem: 'treinar', falta: 'materia' }],
  ['praticar', { quem: 'treinar', falta: 'materia' }],
  ['treinar matemática', { quem: 'treinar', materia: 'Matemática', falta: 'nada' }],
  ['treinar 15 questões de matemática', { quem: 'treinar', materia: 'Matemática', quantidade: 15, falta: 'nada' }],
  ['treinar 5 de português', { quem: 'treinar', materia: 'Língua Portuguesa', quantidade: 5, falta: 'nada' }],
  ['quero treinar inglês', { quem: 'treinar', materia: 'Língua Inglesa', falta: 'nada' }],
  ['treinar a prova do bb 2021', { quem: 'treinar', provas: ['bb-2021'], falta: 'nada' }],
  ['treinar bb 2018', { quem: 'treinar', provas: ['bb-2018'], falta: 'nada' }],
  ['quero fazer a prova da caixa 2024', { quem: 'treinar', provas: ['caixa-2024'], falta: 'nada' }],
  ['fazer questões de informática', { quem: 'treinar', materia: 'Conhecimentos de Informática', falta: 'nada' }],
  ['resolver questões de legislação', { quem: 'treinar', materia: 'Legislação', falta: 'nada' }],
  ['treinar todas as matérias', { quem: 'treinar', materia: 'todas', falta: 'nada' }],
  ['treinar 20 questões', { quem: 'treinar', quantidade: 20, falta: 'nada' }],
  ['treinar vendas', { quem: 'treinar', materia: 'Vendas e Negociação', falta: 'nada' }],
  ['treinar a prova do banese 2025', { quem: 'treinar', provas: ['banese-2025'], falta: 'nada' }],
  ['treino de ética', { quem: 'treinar', materia: 'Ética', falta: 'nada' }],
  ['exercitar matemática financeira', { quem: 'treinar', materia: 'Matemática Financeira', falta: 'nada' }],
  ['treinar bb 10/2015', { quem: 'treinar', provas: ['bb-102015'], falta: 'nada' }],
  ['treinar questões novas', { quem: 'treinar', fonte: 'novas', falta: 'nada' }],
  ['treinar 5 questões inéditas de português', { quem: 'treinar', fonte: 'novas', materia: 'Língua Portuguesa', quantidade: 5, falta: 'nada' }],
  // F5: caderno de erros e simulado da semana
  ['treinar meus erros', { quem: 'treinar', fonte: 'erros', falta: 'nada' }],
  ['treinar 15 questões dos meus erros de matemática', { quem: 'treinar', fonte: 'erros', materia: 'Matemática', quantidade: 15, falta: 'nada' }],
  ['simulado de 30 com o que mais erro', { quem: 'simulado', fonte: 'erros', quantidade: 30, falta: 'nada' }],
  ['simulado só com as questões que errei', { quem: 'simulado', fonte: 'erros', falta: 'quantidade' }],
  ['simulado da semana', { quem: 'simulado', fonte: 'semana', falta: 'quantidade' }],
  ['quero o simulado da semana com 20 questões', { quem: 'simulado', fonte: 'semana', quantidade: 20, falta: 'nada' }],
  ['simulado da semana de 10', { quem: 'simulado', fonte: 'semana', quantidade: 10, falta: 'nada' }],
]

describe('simulado e treino: o que é entendido e o que falta perguntar', () => {
  it.each(SIMULADO_E_TREINO)('"%s"', (frase, esp) => {
    const r = ler(frase)
    expect(r.quem).toBe(esp.quem)
    expect(r.pedido?.materia).toBe(esp.materia)
    expect(r.pedido?.quantidade).toBe(esp.quantidade)
    expect(r.pedido?.provas?.map((p) => p.chave)).toEqual(esp.provas)
    expect(r.pedido?.fonte).toBe(esp.fonte)
    const passo = proximoPasso(r.pedido!, ctx)
    expect(passo.tipo === 'executar' ? 'nada' : passo.slot).toBe(esp.falta)
  })
})

const OUTRAS: [string, string][] = [
  // continuam sendo o que eram (nada do F2 pode piorar o F1)
  ['importar prova', 'prova'], ['quero importar uma prova em pdf', 'prova'], ['adicionar o gabarito', 'prova'], ['subir o pdf da prova', 'prova'], ['enviar a prova do bb 2021 em pdf', 'prova'],
  ['criar cartões', 'cartoes'], ['flashcards do meu resumo', 'cartoes'], ['transformar apostila em cartão', 'cartoes'],
  ['meus espaços', 'espaco'], ['trocar de espaço', 'espaco'], ['criar um novo espaço', 'espaco'],
  ['o que eu já tenho?', 'resumo'], ['quantas questões tenho', 'resumo'], ['status', 'resumo'],
  ['ligar a IA', 'ia'], ['colocar a minha chave', 'ia'],
  ['o que é Copom?', 'perguntar'], ['onde fala de inflação', 'perguntar'], ['explique juros compostos', 'perguntar'], ['procure consignado', 'perguntar'],
  ['meus materiais', 'materiais'], ['guardar uma apostila', 'materiais'],
  ['caderno de erros', 'caderno'], ['meu caderno', 'caderno'], ['rever erros', 'caderno'], ['revisar os erros', 'caderno'], ['rever erros de português', 'caderno'], ['quero ver o que eu errei', 'caderno'],
  ['gerar questões do meu material', 'questoes'], ['criar questões do resumo', 'questoes'], ['gerar questões da apostila', 'questoes'], ['quero questões do meu resumo', 'questoes'], ['transformar o material em questões', 'questoes'],
  ['plano de estudo', 'plano'], ['tenho 30 minutos', 'plano'], ['só tenho meia hora hoje', 'plano'], ['painel do dia', 'plano'], ['como estou hoje', 'plano'], ['o que estudar hoje', 'plano'], ['por onde começar', 'plano'], ['tenho 1 hora para estudar', 'plano'], ['o que estudei hoje', 'plano'], ['minha sequência', 'plano'],
  ['ajuda', 'ajuda'], ['o que você sabe fazer?', 'ajuda'], ['menu', 'ajuda'],
  ['cancelar', 'cancelar'], ['voltar', 'cancelar'], ['deixa pra lá', 'cancelar'],
  ['oi', 'oi'], ['bom dia', 'oi'], ['obrigado', 'obrigado'], ['valeu', 'obrigado'],
  // novos comandos
  ['desfazer', 'desfazer'], ['volta atrás', 'desfazer'], ['foi sem querer', 'desfazer'], ['desfaz isso', 'desfazer'],
  ['limpar conversa', 'limpar'], ['apagar conversa', 'limpar'], ['recomeçar', 'limpar'], ['começar de novo', 'limpar'],
  // espaço com nome/alvo
  ['trocar para direito penal', 'espaco'], ['criar espaço Direito Civil', 'espaco'], ['criar um espaço chamado Pesquisa', 'espaco'],
  // contagem com detalhe
  ['quantas questões de matemática eu tenho?', 'resumo'], ['quantas questões tem a prova do bb 2021', 'resumo'],
  // texto sem comando
  ['qual a capital da frança', 'nao-entendi'], ['asdfgh', 'nao-entendi'], ['   ', 'vazio'],
]

describe('o resto do que se escreve continua entendido (e os comandos novos)', () => {
  it.each(OUTRAS)('"%s" → %s', (frase, quem) => expect(ler(frase).quem).toBe(quem))
})

describe('detalhes que não podem virar ação errada', () => {
  it('"fazer a prova do bb 2021" é treino; "importar a prova do bb 2021" continua importar', () => {
    expect(ler('fazer a prova do bb 2021').quem).toBe('treinar')
    expect(ler('importar a prova do bb 2021').quem).toBe('prova')
    expect(ler('adicionar o pdf do bb 2021').quem).toBe('prova')
  })
  it('dúvida real entre importar e cartões continua perguntando', () => {
    expect(ler('quero cartões da prova').quem).toBe('ambigua')
  })
  it('o ano e o número da questão não viram quantidade', () => {
    expect(ler('treinar bb 2021').pedido?.quantidade).toBeUndefined()
    expect(ler('simulado da questão 12').pedido?.quantidade).toBeUndefined()
  })
})
