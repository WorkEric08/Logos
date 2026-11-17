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
| Assistente | Balão à esquerda, com um **bico** no canto de cima apontando para a esquerda (sem ícone ao lado: o espaço vai para o balão, que é mais comprido). Erro: balão avermelhado que treme uma vez. Sucesso: balão verde-claro |
| Pessoa | Balão à direita, cor de destaque |
| Sugestões | Pílulas no fim da conversa; as "principais" (por exemplo, as duas opções de uma dúvida) vêm destacadas |
| Caixa de mensagem | Presa no pé da tela, como nos apps de mensagem: campo que cresce com o texto (até 5 linhas) + botão redondo só com o ícone de enviar, fixo à direita (Enter também envia; sem emoji). Aparece nos estados de menu (início e depois de concluir uma tarefa) e enquanto o assistente espera uma resposta. As sugestões acima dela se filtram enquanto a pessoa digita |
| O que o assistente pede | Painel dentro da conversa (escolher arquivos, nome do espaço, prévia…), com "Voltar/Cancelar" |

## O que a pessoa pode escrever (e como é entendido)

`core/conversa.ts` (puro, sem IA): tira acento/maiúscula e pontua palavras-chave de cada ação; aceita **erro de digitação de uma letra** ("importr prova"); duas ações empatadas viram pergunta.

| Intenção | Exemplos |
|---|---|
| Importar prova | "importar prova", "quero importar uma prova em pdf", "adicionar o gabarito" |
| Criar cartões | "criar cartões", "flashcards do meu resumo", "transformar apostila em cartão" (o resumo pode trazer a sua marcação: `Pergunta::Resposta`, `Termo:::Definição`, `==lacuna==`) |
| Simulado | "montar um simulado", "quero um simulado", "prova simulada"; com detalhes: "simulado de matemática com 20 questões", "simulado da prova do bb 2021" |
| Treinar | "quero treinar", "treinar 15 de matemática", "treinar a prova do bb 2021", "fazer questões de informática", "treinar meus erros" |
| Caderno de erros | "caderno de erros", "meus erros" (painel com resumo); "rever erros de português", "simulado de 30 com o que mais erro" (direto) |
| Simulado da semana | "simulado da semana", "o simulado da semana com 20 questões" |
| Gerar questões | "gerar questões do meu material", "criar questões do resumo", "transformar o material em questões" |
| Lembrete diário | "me lembre às 20h", "lembrete 8 da noite", "avise às 7h30", "desligar o lembrete", "parar de lembrar" |
| Painel e plano de estudo | "painel do dia", "como estou", "o que estudei hoje", "tenho 30 minutos", "meia hora", "plano de estudo"; também treinar "questões novas" |
| Desfazer | "desfazer", "volta atrás", "foi sem querer" |
| Limpar a conversa | "limpar conversa", "apagar conversa", "recomeçar" |
| Espaços | "meus espaços", "trocar de espaço", "criar um novo espaço"; com nome: "trocar para direito penal", "criar espaço Direito Civil" |
| O que tenho | "o que eu já tenho?", "quantas questões tenho", "status"; com detalhe: "quantas questões de matemática eu tenho?" |
| IA | "ligar a IA", "colocar a minha chave", "usar o claude" |
| Perguntar ao material | "o que é Copom?", "onde fala de inflação", "explique juros compostos", "procure consignado" (vira busca nos materiais, questões e cartões) |
| Materiais | "meus materiais", "guardar uma apostila", "adicionar material" |
| Ajuda | "ajuda", "o que você sabe fazer?", "como funciona", "menu" |
| Cancelar | "cancelar", "voltar", "deixa pra lá" |
| Cumprimento / agradecimento | "oi", "bom dia", "obrigado", "valeu" |
| Dúvida entre duas ações | "quero cartões da prova" → "Quer criar cartões de um resumo ou importar uma prova em PDF?" |
| Não entendeu | texto que não é comando: se for o nome de algo que a pessoa guardou, responde com o que achou (como a busca de uma paleta de comandos); senão, convite com exemplos |

Cobertura: `src/core/conversa.test.ts` (52 casos), `src/core/dialogo/corpus.test.ts` (87 frases com detalhes) e `src/store/assistente.test.ts`; de ponta a ponta em `scripts/e2e-assistente.mjs` e `scripts/e2e-assistente-dialogo.mjs`.

## Ritmo e movimento

Tudo em `core/ritmo.ts` (números) e `ui/movimentoChat.tsx` (comportamento). **"Reduzir movimento" do aparelho desliga tudo**: nada anima, nada espera, o assistente responde na hora.

| Momento | O que acontece |
|---|---|
| Entrar na aba | A tela sobe de leve (movimento de troca de aba já existente); o assistente "digita" (3 pontinhos) e só então a primeira fala entra; as sugestões entram em cascata depois dela |
| Voltar à aba | O que já foi mostrado aparece **de uma vez**, sem refazer a conversa |
| Fala do assistente | Pontinhos por 450–1.400 ms (320 ms + 12 ms por letra) e o balão entra (sobe 8 px e cresce de .97 a 1). Várias falas seguidas entram uma depois da outra |
| Tocar numa sugestão | A pílula escolhida **voa** e as outras recolhem (170 ms); só então a ação roda e a fala da pessoa entra à direita |
| Painel que o assistente pede | Entra de baixo (280 ms); **sai** (170 ms) ao tocar em Voltar/Cancelar e só depois a conversa volta ao menu |
| Lendo o PDF | Barra de progresso com brilho e esqueleto da prévia |
| Prévia | As 12 primeiras questões entram em cascata; desmarcar esmaece e encolhe de leve; o aviso pulsa uma vez; a sugestão da IA abre suave |
| Erro | Balão avermelhado que treme uma vez |
| Sucesso | O "visto" se desenha, o número de itens **sobe contando** (700 ms) e as próximas sugestões entram |
| Trocar de aba pela barra | A tela atual **sai** (140 ms) antes de a nova entrar (vale para todas as telas) |

Só `transform` e `opacity`. Testado em `scripts/e2e-assistente-movimento.mjs` (movimento ligado e com "reduzir movimento"): cada animação acima é conferida pelo nome e nada fica animando depois.

## A caixa de mensagem e a regra do teclado

**Exceção à regra do teclado (2026-11-16, pedido do dono):** a caixa é a ÚNICA coisa do app que sobe com o teclado. Como nos apps de mensagem (WhatsApp), ela fica **presa no pé da tela** (`position:sticky; bottom: var(--teclado)`, `.as-composer`) e, com o teclado aberto, pousa **logo acima dele**, de onde quer que a pessoa toque. O resto do app continua só coberto pelo teclado (regra de `CLAUDE.md`).
- **Campo:** `<textarea>` de uma linha que cresce com o texto até 144 px (5 linhas), depois rola por dentro; a altura vem do JS (layout, não animação). Sem ícone de emoji. Enter envia (uma linha só: quebras viram espaço); o teclado do celular que só insere a quebra também envia.
- **Botão:** redondo, só o ícone de enviar (avião), **fixo à direita e alinhado à base do campo** (acompanha o campo quando ele cresce), laranja com texto escuro; apagado enquanto não há texto. Tocar nele **não tira o foco** do campo: o teclado continua aberto.
- **A "câmera" com o teclado** (`core/rolagem.ts` + `services/teclado.ts` `aoMudarTeclado`): quando o teclado abre ou o campo cresce e a caixa passaria a cobrir o fim da conversa, a tela rola só o necessário (suave; sem rolar com "reduzir movimento") para o fim ficar acima da caixa. **Só rola se a pessoa estava vendo o fim da conversa**: quem subiu para reler algo fica onde estava (a caixa sobe sozinha, presa acima do teclado).
- **Teste:** `regraCaixaDoChat` em `scripts/_teclado.mjs` (usada no cenário `#as-msg` de `scripts/e2e-teclado.mjs`, nos 4 celulares) e `scripts/e2e-assistente-layout.mjs`.

## Para onde a tela olha (2026-11-16)
Quando o assistente responde, a tela vai para o **início da resposta dele** (a primeira fala da última sequência dele; `inicioDaResposta` em `core/rolagem.ts`), com as sugestões logo abaixo, para ler de cima para baixo mesmo nas respostas de vários balões e nas listas longas de prévia. Enquanto a resposta não chega, a fala da pessoa fica no alto. Se a pessoa rolou a tela por conta própria, a câmera não a puxa de volta (só volta a agir numa resposta nova). A posição vem do layout (`offsetTop`), não da tela: a fala que entra anima (desliza e cresce) e mediria uns pixels fora do lugar.

## Balões e bico (2026-11-16)
O ícone de conversa ao lado da fala do assistente saiu. Quem fala agora se distingue por um **bico** pequeno no canto de cima, à esquerda, apontando para a esquerda (`.as-msg.a::before/::after`: dois triângulos, o da cor da borda e, por cima, o da cor do fundo, para a borda do balão continuar pelo bico; as cores vêm de `--as-bg`/`--as-bd`, que os balões de erro e de sucesso trocam). O canto de cima à esquerda do balão é reto. O bico fica na margem de 16 px da tela, fora do balão. Os balões (do assistente e da pessoa) ocupam até 96 % da largura (máx. 720 px); a fala da pessoa encosta na borda direita (o limite de largura vale para o contêiner, nunca em porcentagem dentro dele: foi um defeito de 4 px achado na medição). As sugestões, o aviso de sucesso e a caixa de mensagem usam a largura toda, sem o recuo que havia para o ícone.

## Sugestões no celular (2026-11-16)
As sugestões **curtas** (até 24 letras, `core/pilulas.ts`) ficam **em duplas**, lado a lado em duas colunas iguais; as longas ocupam a linha toda; a curta que sobrasse sozinha numa linha também ocupa a linha (sem buraco). Nada é reordenado e nada encosta no recuo das laterais. Só abaixo de 700 px de largura; em tela larga continuam em fila que quebra linha.

## Respostas com achados (F1)
A resposta de uma pergunta é um balão do assistente **com os achados dentro**: até 3 cartões com o tipo (Material, Questão, Cartão), a fonte e o trecho com a palavra em destaque; entram em cascata (70 ms entre eles). Detalhes e números da busca em `docs/assistente.md`.

## Perguntas do que falta (F2)
Um pedido incompleto vira uma conversa curta: o assistente **pergunta só o que falta** e mostra as respostas possíveis como pílulas (mais "Cancelar"); a pessoa toca **ou escreve** a resposta ("vinte questões", "o do edital", "português"). Ex.: "Montar um simulado" → "Qual simulado? O do edital (com nota e regras) ou de uma matéria?" → [Simulado do edital, Todas, Vendas, Informática…] → "Quantas questões?" → [10, 20, 30, 40] → "Pronto: simulado de 20 questões de Matemática. Boa prova!" e a prova começa. Resposta que não faz sentido repete a pergunta (sem perder o que já foi dito); outro pedido no meio troca de assunto.

## Sugestões enquanto se digita (F2)
A partir de 2 letras a lista de pílulas se filtra pelo que foi escrito (a mais parecida primeiro); texto que não é comando vira "Procurar “…” no meu material". Apagar o texto devolve a lista normal.

## Histórico, desfazer e limpar (F2)
- A conversa **fica guardada no aparelho** (as últimas 300 falas) e volta de uma vez ao reabrir o app; só se apaga com "Limpar a conversa" (pede confirmação; não toca em materiais, questões nem cartões).
- "Desfazer: …" desfaz **a última coisa** feita pelo assistente (criar espaço, guardar/apagar material, criar cartões). Importar prova não se desfaz.

## O assistente chega com o painel do dia (F6)
Ao abrir a aba o assistente **fala primeiro**: "Bom dia! Aqui está o seu dia:" (o que já estudou, sequência, o que espera, onde mais erra) com a **sugestão principal** em destaque à frente das pílulas. No máximo uma vez a cada 3 horas. Dizer "tenho 30 minutos" (ou tocar em "Painel do dia e plano de estudo") monta o plano.

## Estados da conversa

`etapa` em `store/assistente.ts`: `inicio` (menu), `espaco-novo`, `prova-arquivos`, `lendo`, `prova-previa`, `prova-pronta`, `cartoes-arquivo`, `cartoes-previa`, `cartoes-pronto`, `pergunta` (o assistente espera a resposta de um pedido), `caderno` (resumo do caderno de erros e as saídas), `plano` (o plano de estudo e as saídas), `lembrete` (liga, muda a hora ou desliga o lembrete diário), `questoes-material` (qual material), `questoes-previa` (as questões geradas, antes de entrar), `limpar` (confirmação), `espacos`, `materiais`, `material-arquivo`, `material-pronto`, `ia`. A caixa de mensagem existe em `inicio`, `pergunta` e nos `*-pronta`; nos demais o painel tem os seus próprios botões (e "Voltar/Cancelar").

## Próximos passos da conversa (não feitos)
- Entender frases com mais de um pedido ("importar a prova e depois criar cartões").
- Desfazer em mais de um passo e desfazer importação de prova.
- Lembrar de "o que a pessoa estudou hoje/na semana" (as entidades `hoje`/`semana` já são lidas; o painel do dia é a F6).
