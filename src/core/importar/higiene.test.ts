import { describe, expect, it } from 'vitest'
import { ehCredito, ehReferencia, limparParagrafos } from './higiene'

const CORPO = [
  'O Transtorno do Espectro do Autismo (TEA) é um transtorno do desenvolvimento neurológico caracterizado por dificuldades de comunicação.',
  'A prevalência é maior em meninos do que em meninas, na proporção de cerca de 4:1.',
  'Quando é detectado qualquer atraso, a estimulação precoce é a regra e deve começar logo.',
  'O pediatra tem papel importante no encaminhamento e na articulação desses profissionais.',
  'Os pais também devem ser capacitados para trabalhar com a criança no âmbito domiciliar.',
  'O tratamento deve envolver a equipe de saúde, a equipe pedagógica e a família.',
]
const REFS = [
  '12. Bailey A, Le Couteur A, Gottesman I, Bolton P, Simonoff E, Yuzda E, et al. Autism as a strongly genetic disorder: evidence from a British twin study. Psychol Med. 1995;25(1):63–77.',
  '13. Sandin S, Lichtenstein P, Kuja-Halkola R, Larsson H, Hultman CM, Reichenberg A. The familial risk of autism. JAMA. 2014;311(17):1770–7.',
  '14. Mandy W, Lai M-C. Annual Research Review: The role of the environment in the developmental psychopathology of autism. J Child Psychol Psychiatry. 2016;57(3):271–92.',
  '25. Halpern R. Transtorno do espectro autista. In: Manual de Pediatria do Desenvolvimento e Comportamento. Barueri, SP: Manole; 2015. p. 455–70.',
  '56. Halpern R. Manual de pediatria do desenvolvimento e comportamento. Barueri, SP: Manole; 2014. 556 p.',
]
const CREDITOS = ['Presidente: Luciana Rodrigues Silva (BA)', 'Paulo Cesar Koch Nogueira (SP)', 'Emanuel Sávio Cavalcanti Sarinho (PE)', 'DIRETORIA DE PUBLICAÇÕES', 'Fábio Ancona Lopez (SP)', 'Joel Alves Lamounier (MG)']

describe('higiene do texto de estudo', () => {
  it('texto só de conteúdo passa inteiro', () => {
    const h = limparParagrafos(CORPO)
    expect(h.paragrafos).toEqual(CORPO)
    expect(h.ignorados).toBe(0)
    expect(h.motivos).toEqual([])
  })
  it('a lista de referências bibliográficas no fim fica de fora, e a tela é avisada do motivo', () => {
    const h = limparParagrafos([...CORPO, ...REFS])
    expect(h.paragrafos).toEqual(CORPO)
    expect(h.ignorados).toBe(REFS.length)
    expect(h.motivos[0]).toMatch(/referências bibliográficas/)
  })
  it('créditos e diretoria no fim (um nome com o estado entre parênteses em cada linha, mais títulos curtos) saem junto', () => {
    const h = limparParagrafos([...CORPO, ...REFS, ...CREDITOS])
    expect(h.paragrafos).toEqual(CORPO)
    expect(h.motivos.join(' ')).toMatch(/créditos e diretoria/)
  })
  it('referência solta no meio do texto também sai (duas pistas bastam)', () => {
    const ref = '1. American Psychiatric Association. Manual de diagnóstico e estatístico de transtornos mentais: DSM-V. 5. ed. Porto Alegre: Artmed; 2014. 848 p.'
    expect(ehReferencia(ref)).toBe(true)
    expect(limparParagrafos([...CORPO.slice(0, 3), ref, ...CORPO.slice(3)]).paragrafos).toEqual(CORPO)
  })
  it('uma frase comum NÃO é referência, nem uma que cita um ano ou "et al." uma vez só', () => {
    expect(ehReferencia(CORPO[0])).toBe(false)
    expect(ehReferencia('Em 2014 o estudo de Sandin et al. mostrou o risco familiar do autismo.')).toBe(false)
  })
  it('texto corrido com cidades e estados (sigla entre parênteses) não é crédito', () => {
    const p = 'As filiais ficam em São Paulo (SP), Rio de Janeiro (RJ), Belo Horizonte (MG) e Salvador (BA), e a matriz atende a todo o país.'
    expect(ehCredito(p)).toBe(false)
    expect(limparParagrafos([...CORPO, p]).paragrafos).toContain(p)
  })
  it('um parágrafo com muitos nomes e estados é crédito', () => {
    expect(ehCredito('Maria Souza (SP) João Lima (RJ) Ana Costa (MG) Pedro Reis (BA)')).toBe(true)
    expect(ehCredito('Paulo Cesar Koch Nogueira (SP)')).toBe(true)
  })
  it('endereços da internet saem do texto e a seta do PDF ("Æ") vira marcador', () => {
    const h = limparParagrafos(['Acesso à escala: http://www.mchatscreen.com Em estudo recente o M-CHAT-R identificou 85% das crianças.', 'Æ orientar os pais quanto à estimulação adequada Æ reavaliar em um mês'])
    expect(h.paragrafos[0]).toBe('Acesso à escala: Em estudo recente o M-CHAT-R identificou 85% das crianças.')
    expect(h.paragrafos[1]).toBe('• orientar os pais quanto à estimulação adequada • reavaliar em um mês')
  })
  it('um documento curto (menos de 4 trechos na metade final) não é cortado por engano', () => {
    const h = limparParagrafos([...CORPO, REFS[0]])
    expect(h.paragrafos).toEqual(CORPO)
    expect(h.ignorados).toBe(1)
  })
})
