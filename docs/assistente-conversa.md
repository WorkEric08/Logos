# Como o assistente e a pessoa conversam

O desenho da conversa do assistente (aba **Assistente**). O catálogo das ações está em `docs/assistente.md`; aqui é **como a troca acontece**: o que a pessoa pode fazer, o que o assistente responde, em que ritmo e com que movimento.

## Princípios

1. **Duas formas de falar, o mesmo resultado.** A pessoa toca numa sugestão (pílula) **ou** escreve o pedido na caixa de mensagem. Tocar vira, na conversa, a fala dela em um balão à direita; escrever também. As duas vias chamam a mesma função (`executar` em `store/assistente.ts`).
2. **Todo turno do assistente termina com um próximo passo.** Depois de responder, sempre há algo a tocar: as sugestões (menu) ou o painel que ele pediu (arquivo, nome, prévia). Nunca um beco sem saída.
3. **Sem adivinhar.** Se o pedido pode ser duas coisas, ele **pergunta qual** e destaca as duas opções. Se não entende, diz que não entendeu e oferece exemplos. Nunca executa uma ação por palpite.
4. **Nada importa sem confirmar.** Importar prova e criar cartões passam por uma **prévia** (a pessoa vê, corrige e escolhe) antes de gravar. Apagar espaço pede um segundo toque.
5. **Erro com saída.** Toda mensagem de erro diz o que fazer ("Mude o nome", "Marque as respostas na prévia", "Conecte-se online").
6. **Tom:** curto, simples, em português, na primeira pessoa ("Li 8 questões…"), sem jargão.
7. **O assistente nunca perde o que a pessoa fez:** a conversa fica guardada ao trocar de aba; arquivos só saem do aparelho na "Reler com IA" (opcional).

## Os papéis na tela

| Quem | Como aparece |
|---|---|
| Assistente | Balão à esquerda, com avatar (ícone de conversa). Erro: balão avermelhado que treme uma vez. Sucesso: balão verde-claro |
| Pessoa | Balão à direita, cor de destaque |
| Sugestões | Pílulas no fim da conversa; as "principais" (por exemplo, as duas opções de uma dúvida) vêm destacadas |
| Caixa de mensagem | Campo + "Enviar" logo abaixo da última fala (Enter envia). Só aparece nos estados de menu (início e depois de concluir uma tarefa) |
| O que o assistente pede | Painel dentro da conversa (escolher arquivos, nome do espaço, prévia…), com "Voltar/Cancelar" |

## O que a pessoa pode escrever (e como é entendido)

`core/conversa.ts` (puro, sem IA): tira acento/maiúscula e pontua palavras-chave de cada ação; aceita **erro de digitação de uma letra** ("importr prova"); duas ações empatadas viram pergunta.

| Intenção | Exemplos |
|---|---|
| Importar prova | "importar prova", "quero importar uma prova em pdf", "adicionar o gabarito" |
| Criar cartões | "criar cartões", "flashcards do meu resumo", "transformar apostila em cartão" |
| Simulado | "montar um simulado", "quero um simulado", "prova simulada" |
| Espaços | "meus espaços", "trocar de espaço", "criar um novo espaço" |
| O que tenho | "o que eu já tenho?", "quantas questões tenho", "status" |
| IA | "ligar a IA", "colocar a minha chave", "usar o claude" |
| Ajuda | "ajuda", "o que você sabe fazer?", "como funciona", "menu" |
| Cancelar | "cancelar", "voltar", "deixa pra lá" |
| Cumprimento / agradecimento | "oi", "bom dia", "obrigado", "valeu" |
| Dúvida entre duas ações | "quero cartões da prova" → "Quer criar cartões de um resumo ou importar uma prova em PDF?" |
| Não entendeu | qualquer outra coisa → convite com exemplos |

Cobertura: `src/core/conversa.test.ts` (40 casos) e `src/store/assistente.test.ts`; de ponta a ponta em `scripts/e2e-assistente.mjs`.

## Ritmo e movimento

Tudo em `core/ritmo.ts` (números) e `ui/movimentoChat.tsx` (comportamento). **"Reduzir movimento" do aparelho desliga tudo**: nada anima, nada espera, o assistente responde na hora.

| Momento | O que acontece |
|---|---|
| Entrar na aba | A tela sobe de leve (movimento de troca de aba já existente); o assistente "digita" (3 pontinhos) e só então a primeira fala entra; as sugestões entram em cascata depois dela |
| Voltar à aba | O que já foi mostrado aparece **de uma vez**, sem refazer a conversa |
| Fala do assistente | Pontinhos por 450–1.400 ms (320 ms + 12 ms por letra) e o balão entra (sobe 8 px e cresce de .97 a 1); o avatar "salta". Várias falas seguidas entram uma depois da outra |
| Tocar numa sugestão | A pílula escolhida **voa** e as outras recolhem (170 ms); só então a ação roda e a fala da pessoa entra à direita |
| Painel que o assistente pede | Entra de baixo (280 ms); **sai** (170 ms) ao tocar em Voltar/Cancelar e só depois a conversa volta ao menu |
| Lendo o PDF | Barra de progresso com brilho e esqueleto da prévia |
| Prévia | As 12 primeiras questões entram em cascata; desmarcar esmaece e encolhe de leve; o aviso pulsa uma vez; a sugestão da IA abre suave |
| Erro | Balão avermelhado que treme uma vez |
| Sucesso | O "visto" se desenha, o número de itens **sobe contando** (700 ms) e as próximas sugestões entram |
| Trocar de aba pela barra | A tela atual **sai** (140 ms) antes de a nova entrar (vale para todas as telas) |

Só `transform` e `opacity`. Testado em `scripts/e2e-assistente-movimento.mjs` (movimento ligado e com "reduzir movimento"): cada animação acima é conferida pelo nome e nada fica animando depois.

## A caixa de mensagem e a regra do teclado

A caixa **não fica presa no pé da tela** (isso a deixaria atrás do teclado). Ela vem logo abaixo da última fala, e a tela mostra a fala mais recente no alto: assim o campo fica acima do teclado sem nada se mexer. A regra do app (nenhum botão aparece acima do teclado; a página não rola ao abrir o teclado) está coberta no cenário `#as-msg` de `scripts/e2e-teclado.mjs`, nos 4 celulares.

## Estados da conversa

`etapa` em `store/assistente.ts`: `inicio` (menu), `espaco-novo`, `prova-arquivos`, `lendo`, `prova-previa`, `prova-pronta`, `cartoes-arquivo`, `cartoes-previa`, `cartoes-pronto`, `simulado`, `espacos`, `ia`. A caixa de mensagem existe em `inicio` e nos `*-pronta`; nos demais o painel tem os seus próprios botões (e "Voltar/Cancelar").

## Próximos passos da conversa (não feitos)
- Entender frases com mais de um pedido ("importar a prova e depois criar cartões").
- Histórico guardado entre aberturas do app (hoje só na memória).
- Comandos com argumento ("simulado de matemática com 20 questões").
