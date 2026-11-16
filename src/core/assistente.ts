// O "pseudo-agente": um chat com AÇÕES FIXAS (sem IA). Cada ação está descrita aqui, uma vez, e a tela, a ajuda e a documentação (docs/assistente.md)
// leem daqui. Acrescentar uma ação = acrescentar aqui, no fluxo (store/assistente.ts) e na tela (ui/Assistente.tsx); o teste confere que a documentação a cita.

export type IdAcao = 'prova' | 'cartoes' | 'simulado' | 'treinar' | 'perguntar' | 'materiais' | 'espaco' | 'resumo' | 'ia'

export interface Acao {
  id: IdAcao
  rotulo: string
  /** Texto curto da sugestão no chat (e do balão da pessoa quando ela toca). */
  sugestao: string
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
    id: 'prova', rotulo: 'Importar uma prova em PDF', sugestao: 'Importar uma prova em PDF',
    resumo: 'Lê as questões de uma prova de concurso em PDF e, se você mandar, o gabarito.',
    precisa: 'O PDF da prova (com texto, não foto). O PDF do gabarito é opcional: sem ele você marca a resposta de cada questão na prévia.',
    gera: 'Questões no espaço de estudo ativo, com matéria, texto-base e, nas que têm figura ou tabela, a imagem recortada da página.',
    limites: 'Funciona melhor no formato das provas da Cesgranrio (número da questão sozinho na linha, alternativas "(A)" a "(E)", duas colunas). PDF escaneado (só imagem) não é lido sem IA. O que não deu para ler fica marcado na prévia e nunca entra com resposta inventada.',
  },
  {
    id: 'cartoes', rotulo: 'Criar cartões de um resumo', sugestao: 'Criar cartões de um resumo',
    resumo: 'Transforma um resumo ou apostila (PDF, TXT ou MD) em cartões de estudo (frente e verso).',
    precisa: 'Um arquivo de texto: PDF com texto, .txt ou .md.',
    gera: 'Um baralho novo, com os cartões que você escolher na prévia.',
    limites: 'Só reconhece padrões claros: "Termo: definição", "Termo – definição", "Pergunta? Resposta", "X é …", título seguido de parágrafo e trecho em **negrito** (vira lacuna). O resto fica de fora, e o assistente diz quantos parágrafos não viraram cartão.',
  },
  {
    id: 'simulado', rotulo: 'Montar um simulado', sugestao: 'Montar um simulado',
    resumo: 'Sorteia questões do espaço ativo e começa um simulado cronometrado.',
    precisa: 'Nada: usa as questões do espaço. Espaço com regras de edital faz o simulado do edital; os outros deixam escolher a matéria e a quantidade.',
    gera: 'Uma prova com cartão-resposta e nota (acertos, e pontos quando há regras do edital).',
    limites: 'Só sorteia entre as questões que já estão no espaço.',
  },
  {
    id: 'treinar', rotulo: 'Treinar questões', sugestao: 'Treinar questões',
    resumo: 'Começa um treino com questões do espaço, da matéria ou da prova que você pedir, na quantidade que quiser.',
    precisa: 'Nada, ou o que quiser dizer: "treinar 15 de matemática", "treinar a prova do BB 2021", "treinar português". O que faltar eu pergunto.',
    gera: 'Uma sessão de treino (com correção na hora) sorteada pelo peso da matéria e pelo que você mais erra.',
    limites: 'Só sorteia entre as questões que já estão no espaço. Sem dizer a quantidade, são 10.',
  },
  {
    id: 'perguntar', rotulo: 'Perguntar ao meu material', sugestao: 'Perguntar ao meu material',
    resumo: 'Procura nos seus materiais, questões e cartões e mostra o trecho certo, com a palavra em destaque e a fonte.',
    precisa: 'Uma pergunta ou palavra, por exemplo: "o que é Copom?", "onde fala de inflação", "juros compostos".',
    gera: 'Até 3 trechos com a palavra destacada e de onde vieram (qual material, qual questão ou cartão).',
    limites: 'Procura por palavras (aceita plural, sem acento e um erro de digitação), não por significado: se o material diz "taxa básica" e você pergunta "juro oficial", pode não achar. Só acha o que está no espaço ativo.',
  },
  {
    id: 'materiais', rotulo: 'Meus materiais de estudo', sugestao: 'Meus materiais',
    resumo: 'Guarda resumos, apostilas e anotações no seu espaço, para o assistente consultar; mostra e apaga o que já guardou.',
    precisa: 'Um arquivo de texto: PDF com texto, .txt ou .md.',
    gera: 'O material guardado no aparelho em trechos pesquisáveis. Criar cartões de um resumo também o guarda aqui.',
    limites: 'PDF escaneado (só imagem) não é lido (não há OCR). Cada material aceita até 4 milhões de letras e 20 mil trechos. Fica só neste aparelho (ainda não sincroniza pela conta).',
  },
  {
    id: 'espaco', rotulo: 'Escolher ou criar um espaço de estudo', sugestao: 'Meus espaços de estudo',
    resumo: 'Um espaço reúne as questões, as matérias e as provas de um assunto. O Banco do Brasil vem pronto.',
    precisa: 'Para criar: um nome. Dá para começar vazio ou com as questões do BB.',
    gera: 'Um espaço novo e ativo; as telas passam a mostrar só o que é dele. O progresso das questões é guardado por questão e não se perde ao trocar.',
    limites: 'O espaço do Banco do Brasil não recebe arquivos: para somar provas novas, crie um espaço "com as questões do BB".',
  },
  {
    id: 'resumo', rotulo: 'Ver o que eu já tenho', sugestao: 'O que eu já tenho?',
    resumo: 'Mostra quantas questões, matérias e provas o espaço ativo tem.',
    precisa: 'Nada: só o espaço ativo.', gera: 'Um resumo na conversa.', limites: 'Só mostra números do espaço ativo.',
  },
  {
    id: 'ia', rotulo: 'Ajuda de IA (opcional)', sugestao: 'Ligar a ajuda de IA',
    resumo: 'Liga uma IA (sua chave da Anthropic) para reler as questões que o leitor não conseguiu entender.',
    precisa: 'Uma chave de API da Anthropic (console.anthropic.com). Fica só neste aparelho.',
    gera: 'Na prévia da prova, as questões com aviso ganham o botão "Reler com IA".',
    limites: 'É opcional e desligada por padrão. Cada leitura usa a sua chave (e é cobrada por ela). A resposta da IA entra como sugestão e você confere antes de adicionar.',
  },
]

export const acaoPorId = (id: IdAcao): Acao => ACOES.find((a) => a.id === id)!
