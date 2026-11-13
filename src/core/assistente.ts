// O "pseudo-agente": um chat com AÇÕES FIXAS (sem IA). Cada ação está descrita aqui, uma vez, e a tela, a ajuda e a documentação (docs/assistente.md)
// leem daqui. Acrescentar uma ação = acrescentar aqui, no fluxo (store/assistente.ts) e na tela (ui/Assistente.tsx); o teste confere que a documentação a cita.

export type IdAcao = 'prova' | 'cartoes' | 'simulado' | 'espaco' | 'resumo' | 'ia'

export interface Acao {
  id: IdAcao
  rotulo: string
  /** Uma frase: o que a ação faz. */
  resumo: string
  /** O que a pessoa precisa fornecer. */
  precisa: string
  /** O que sai disso. */
  gera: string
  /** O que NÃO funciona (sem IA) e como o assistente avisa. */
  limites: string
}

export const ACOES: Acao[] = [
  {
    id: 'prova', rotulo: 'Importar uma prova em PDF',
    resumo: 'Lê as questões de uma prova de concurso em PDF e, se você mandar, o gabarito.',
    precisa: 'O PDF da prova (com texto, não foto). O PDF do gabarito é opcional: sem ele você marca a resposta de cada questão na prévia.',
    gera: 'Questões no espaço de estudo ativo, com matéria, texto-base e, nas que têm figura ou tabela, a imagem recortada da página.',
    limites: 'Funciona melhor no formato das provas da Cesgranrio (número da questão sozinho na linha, alternativas "(A)" a "(E)", duas colunas). PDF escaneado (só imagem) não é lido sem IA. O que não deu para ler fica marcado na prévia e nunca entra com resposta inventada.',
  },
  {
    id: 'cartoes', rotulo: 'Criar cartões de um resumo',
    resumo: 'Transforma um resumo ou apostila (PDF, TXT ou MD) em cartões de estudo (frente e verso).',
    precisa: 'Um arquivo de texto: PDF com texto, .txt ou .md.',
    gera: 'Um baralho novo, com os cartões que você escolher na prévia.',
    limites: 'Só reconhece padrões claros: "Termo: definição", "Termo – definição", "Pergunta? Resposta", "X é …", título seguido de parágrafo e trecho em **negrito** (vira lacuna). O resto fica de fora, e o assistente diz quantos parágrafos não viraram cartão.',
  },
  {
    id: 'simulado', rotulo: 'Montar um simulado',
    resumo: 'Sorteia questões do espaço ativo e começa um simulado cronometrado.',
    precisa: 'Nada: usa as questões do espaço. Espaço com regras de edital faz o simulado do edital; os outros deixam escolher a matéria e a quantidade.',
    gera: 'Uma prova com cartão-resposta e nota (acertos, e pontos quando há regras do edital).',
    limites: 'Só sorteia entre as questões que já estão no espaço.',
  },
  {
    id: 'espaco', rotulo: 'Escolher ou criar um espaço de estudo',
    resumo: 'Um espaço reúne as questões, as matérias e as provas de um assunto. O Banco do Brasil vem pronto.',
    precisa: 'Para criar: um nome. Dá para começar vazio ou com as questões do BB.',
    gera: 'Um espaço novo e ativo; as telas passam a mostrar só o que é dele. O progresso das questões é guardado por questão e não se perde ao trocar.',
    limites: 'O espaço do Banco do Brasil não recebe arquivos: para somar provas novas, crie um espaço "com as questões do BB".',
  },
  {
    id: 'resumo', rotulo: 'Ver o que eu já tenho',
    resumo: 'Mostra quantas questões, matérias e provas o espaço ativo tem.',
    precisa: 'Nada: só o espaço ativo.', gera: 'Um resumo na conversa.', limites: 'Só mostra números do espaço ativo.',
  },
  {
    id: 'ia', rotulo: 'Ajuda de IA (opcional)',
    resumo: 'Liga uma IA (sua chave da Anthropic) para reler as questões que o leitor não conseguiu entender.',
    precisa: 'Uma chave de API da Anthropic (console.anthropic.com). Fica só neste aparelho.',
    gera: 'Na prévia da prova, as questões com aviso ganham o botão "Reler com IA".',
    limites: 'É opcional e desligada por padrão. Cada leitura usa a sua chave (e é cobrada por ela). A resposta da IA entra como sugestão e você confere antes de adicionar.',
  },
]

export const acaoPorId = (id: IdAcao): Acao => ACOES.find((a) => a.id === id)!
