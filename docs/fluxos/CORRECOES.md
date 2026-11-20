# Correções de fluxo (dono: corretor)

Cada ID tem: causa, arquivos, teste, estado. O `RELATORIO.md` (testador) não é editado aqui. IDs `C-n` = achados pelo corretor lendo o código; `F-n` = enviados pelo testador.

Estados: corrigido · aguardando verificação · não-problema · decisão do dono.

## C-1 — Simulado parcial do assistente entrava em "Simulados" como "Não passou" (média)
- **Causa:** `finish()` (`store/app.ts`) gravava toda sessão `sim` na lista de simulados, com a nota calculada pelas regras do edital. Um simulado montado pelo assistente (ex.: 20 questões de Matemática, "da semana", "só dos erros") tinha ~3 pontos de 100 e "Não passou", e entrava no "melhor nota", "passou em N" do Desempenho.
- **Correção:** `Session.edital` (só `startSimulado` marca). Só ele grava `Sim` no histórico e o evento `s`. O parcial continua contando respostas, progresso e dia (cada resposta já é gravada no `finish`).
- **Arquivos:** `src/store/app.ts`. **Teste:** `src/store/app.test.ts` ("simulado parcial … NÃO entra na lista de simulados"). **Estado:** corrigido (aguardando verificação do testador).
- **Reverificar:** pelo Assistente peça "simulado de matemática com 10 questões", entregue e abra Desempenho: a lista de Simulados não ganha linha. Pelo Início, "Simulado de 70" entregue continua aparecendo.

## C-2 — Voltar na revisão de uma questão do resultado ia ao Início (baixa/média)
- **Causa:** a camada do voltar da sessão (`ui/App.tsx`) sempre chamava `sair` (vai ao Início), inclusive com uma questão do cartão-resposta aberta, onde existe o botão "Voltar ao resultado".
- **Correção:** com `done && review`, o voltar do aparelho/Esc faz `backToResult`; do resultado ou da prova, continua saindo. O botão "Sair" não mudou.
- **Arquivos:** `src/ui/App.tsx`. **Teste:** `scripts/e2e-voltar.mjs` (bloco "Resultado do treino", rodado contra o dev server: passa). **Estado:** corrigido, aguardando verificação do testador.

## C-3 — Dois toques rápidos em ícones da barra terminavam na PRIMEIRA aba (baixa)
- **Causa:** `aoSelecionar` (`ui/App.tsx`) agenda a troca em 110 ms (animação de saída); um 2º toque trocava na hora, mas o `setTimeout` do 1º ainda disparava depois e levava à 1ª aba.
- **Correção:** guarda o temporizador numa ref e cancela ao novo toque (vale o último ícone).
- **Arquivos:** `src/ui/App.tsx`. **Estado:** aguardando verificação.

## C-4 — "Treinar agora" depois de importar uma prova abria o Treinar com os filtros de antes (baixa)
- **Causa:** o botão (`ui/Assistente.tsx`, componente `Pronto`) só fazia `setTab('treinar')`. Com matéria/prova/situação filtradas de antes, a prova recém-importada (ou "Geradas: …") podia nem aparecer no sorteio.
- **Correção:** antes de abrir, limpa matéria e situação e filtra pela prova que entrou (`ultimaProva.chave`), igual a tocar numa prova no Início.
- **Arquivos:** `src/ui/Assistente.tsx`. **Teste:** sem teste automático (precisa importar PDF; coberto só pela leitura do código e tsc). **Estado:** aguardando verificação do testador.

## C-5 — "Entregar prova" no simulado entrega na hora, mesmo com questões em branco (média) — DECISÃO DO DONO
- **O que acontece:** na última questão do simulado, "Entregar prova" chama `finish()` direto. Não há aviso de quantas ficaram em branco, não há desfazer (entregue é entregue) e dentro da prova não existe um jeito de ir a uma questão em branco sem tocar "Anterior" várias vezes (o cartão-resposta só existe depois de entregar, de propósito: o resultado não aparece antes).
- **Opções:** (a) manter como está; (b) ao entregar com N em branco, abrir um aviso central (padrão `ConfirmarSaida`/`ConfirmarAcao`: "Você deixou N questões em branco. Entregar mesmo assim?" com "Voltar à prova" como foco inicial); (c) (b) + um cartão-resposta SÓ com "respondida/em branco" durante a prova. Recomendo (b): é pequeno, não revela nada da nota e evita perder um simulado inteiro por um toque. Aguardando decisão; não implementado.

## C-6 — Voltar do aparelho com um painel aberto no Assistente saía da aba (média)
- **Causa:** os painéis do chat (Meus materiais, Meus espaços, prévia da prova, pergunta do que falta, Caderno, Plano…) são `etapa` do store e não entravam na pilha do voltar. O voltar ia direto ao Início e o painel ficava aberto, esperando quando a pessoa voltasse à aba (estado preso).
- **Correção:** `Chat` (`ui/Assistente.tsx`) registra uma camada **leve** (não trava o deslize que abre a barra) enquanto `etapa` não é `inicio`/`lendo` e não está `ocupado`: o voltar faz `voltarAoInicio` (o mesmo do botão Cancelar/Voltar do painel) e mostra as sugestões; o voltar seguinte sai da aba. Durante a leitura do PDF e gravações o voltar segue saindo (cancelar no meio deixaria a tarefa terminar por trás).
- **Arquivos:** `src/ui/Assistente.tsx`. **Teste:** `scripts/e2e-voltar.mjs` (bloco "Assistente: painel aberto"). **Estado:** corrigido, aguardando verificação do testador.

## F-01 — "Mais 10 por peso" no resultado ignorava o treino que acabou (média) — corrigido
- **Causa:** `Resultado` (`ui/Question.tsx`) sempre chamava `startByWeight` (10 questões do banco todo, por peso), qualquer que fosse a origem da sessão.
- **Correção:** a sessão guarda `origem` (`filtros` com os filtros do Treinar, `peso`, `erros`) e o resultado chama `maisDoMesmo`: "Mais como este" (mesmos filtros; não repete as questões que acabou de fazer, se houver outras), "Mais 10 por peso" (Treino rápido), "Mais erros" (Rever erros) ou "Novo simulado" (só o do espaço). **Treino montado pelo assistente e simulado parcial não têm botão "Mais…"** (só "Início"): repetir "por peso" seria o mesmo erro.
- **Arquivos:** `src/store/app.ts`, `src/ui/Question.tsx`, `src/ui/Views.tsx` (o botão Começar passa a chamar `startFromFilters()` sem argumento). **Testes:** `src/store/app.test.ts` (F-01), `scripts/fluxo/_corretor-f01-05-06.mjs`. **Estado:** corrigido, aguardando verificação.

## F-05 — Simulado entregue: questão em branco podia ser respondida na revisão (média) — corrigido
- **Causa:** `answer` só travava `sim && !done`; entregue, caía no caminho do treino e gravava progresso/histórico. A tela também deixava as alternativas ativas.
- **Correção:** `answer` ignora qualquer resposta em sessão `sim`; na tela, questão em branco do simulado entregue mostra o gabarito marcado e "Em branco. Gabarito: X" (alternativas desativadas).
- **Arquivos:** `src/store/app.ts`, `src/ui/Question.tsx`. **Testes:** `src/store/app.test.ts` (F-05), script acima. **Estado:** corrigido, aguardando verificação. (Treino comum: responder uma questão pulada na revisão continua valendo, é treino.)

## F-06 — Revisão pelo cartão-resposta sem "Voltar ao resultado" fora da última questão (média) — corrigido
- **Correção:** na revisão, o pé tem **Anterior · Resultado · Próxima** (na última, como antes, "Voltar ao resultado"). "Sair" do topo continua indo ao Início (como o README e `e2e-simulado` registram).
- **Arquivos:** `src/ui/Question.tsx`. **Teste:** script acima (390 e 320 px, sem texto cortado no pé). **Estado:** corrigido, aguardando verificação.

## F-07 — Voltar no assistente: pergunta saía da aba, painel fechava (média) — corrigido pelo C-6
- Foi a mesma causa do C-6: nenhum painel do chat estava na pilha do voltar. Medi nas 7 ações (Simulado, Treinar, Importar prova, Cartões, Painel e plano, Materiais) com `scripts/fluxo/_corretor-f07.mjs`: o voltar fecha só a pergunta/painel e fica no Assistente. "Caderno de erros" sem erros não abre painel (só responde), então o voltar sai, como em qualquer tela sem camada. **Estado:** corrigido, aguardando reverificação (recarregue o dev server).

## F-08 — "Rever erros (N)" contava todos mas a sessão leva 20 (baixa) — corrigido
- **Correção:** `rotuloErros` (`core/filters.ts`): "Rever erros (20 de 45)" quando passa de 20; o limite virou `LIMITE_ERROS`. Início (celular e monitor) e Desempenho.
- **Arquivos:** `src/core/filters.ts`, `src/store/app.ts`, `src/ui/Views.tsx`. **Teste:** `src/core/core.test.ts`. **Estado:** corrigido, aguardando verificação.

## F-02, F-03, F-04 — decisão do dono (não alterados)
- **F-02 (sair do treino do Treinar vai ao Início):** opções (a) manter (README, `e2e-voltar` e `e2e-movimento` assumem Início); (b) guardar a aba de origem na sessão e voltar a ela (Treinar, Assistente, Início): coerente com "voltar volta de onde veio", mexe nos testes citados. Recomendo (b) só para Treinar e Assistente.
- **F-03 (treino em andamento não retoma):** opções (a) manter (as respostas já ficam no progresso); (b) guardar a sessão e oferecer "Continuar treino" no Treinar, no molde do "Treino do plano". Custo médio (persistência + tela).
- **F-04 = C-5 (entregar prova com questões em branco):** ver C-5; recomendo (b), aviso central com "Voltar à prova" em foco.

## F-09 — Matéria tocada no Desempenho/Início largo mantinha prova e situação de antes (média) — corrigido
- **Causa:** `CartaoMateria` (`ui/Views.tsx`) só chamava `setMatFilter`; o Treinar abria com "Vendas / BB 2010 / Marcadas · 0 questões" e "Começar" desabilitado.
- **Correção:** limpa prova e situação antes de filtrar pela matéria (como `abrirProva` do Início já fazia).
- **Arquivos:** `src/ui/Views.tsx`. **Teste:** `scripts/fluxo/_corretor-f09-10.mjs`. **Estado:** corrigido, aguardando verificação.

## F-10 — Espaço de estudo vazio: Início/Treinar/Desempenho sem orientação (média) — corrigido
- **Causa:** as três telas desenhavam grupos vazios e botões ("Simulado de 0", "Treino rápido") que só davam "Nenhuma questão nesses filtros."; nada dizia em que espaço a pessoa estava nem levava a importar.
- **Correção:** com `BANK` vazio, Início, Treinar e Desempenho mostram um cartão "Este espaço ainda não tem questões" com o nome do espaço e o botão **Importar uma prova**, que abre o Assistente já na etapa de escolher o PDF (`EspacoVazio` em `ui/Views.tsx`). O aviso `semQuestoes` continua para filtros que não casam.
- **Arquivos:** `src/ui/Views.tsx`. **Teste:** `scripts/fluxo/_corretor-f09-10.mjs` (cria um espaço vazio pela interface, confere as 3 telas e o botão). **Estado:** corrigido, aguardando verificação. (A aba Cards não depende do espaço e segue igual.)

## F-11 — Voltar com formulário aberto em Cards saía em vez de cancelar (baixa) — corrigido
- **Causa:** "Novo baralho", "Renomear" e a pergunta "Excluir este baralho" eram estado local sem camada no voltar (mesma raiz do F-07/C-6).
- **Correção:** cada um registra uma camada **leve** (`useBackLayer(..., true)`): o voltar fecha só o formulário/pergunta (o texto digitado se perde, como no botão Cancelar).
- **Arquivos:** `src/ui/Cards.tsx`. **Teste:** `scripts/e2e-voltar.mjs` (bloco "Cards: formulários e perguntas abertos"). **Estado:** corrigido, aguardando verificação.

## F-12 — "Desfazer: criar o espaço" sobrevivia à importação e apagava o espaço com as questões (média) — corrigido
- **Causa:** o registro do "desfazer" do assistente (`acaoDesfazer`) só era trocado por outra ação desfazível; importar prova e gerar questões não o limpavam, e a função apagava o espaço sem conferir se ainda era o ativo nem se tinha conteúdo.
- **Correção:** `soltarDesfazer()` ao importar uma prova e ao adicionar questões geradas (o desfazer vale só para a ÚLTIMA coisa); e o desfazer de "criar o espaço" só roda enquanto aquele espaço é o ativo (senão diz "Não consegui desfazer: você já trocou de espaço…"). Importar/gerar não tem "desfazer" próprio (apagar as questões entradas seria uma função nova): proponho como melhoria se o dono quiser.
- **Arquivos:** `src/store/assistente.ts`. **Testes:** `src/store/assistente.test.ts` (F-12); `scripts/fluxo/18-desfazer-espaco.mjs` agora mostra `pílulas Desfazer na conversa: []`. **Estado:** corrigido, aguardando verificação.

## F-13 — Prévia: "Adicionar 8" sem avisar que já estavam; voltar descartava a prévia sem perguntar (baixa) — corrigido
- **Correção:** (1) a prévia diz "· N já estão neste espaço (não duplicam)" (conta os ids por conteúdo contra as questões do espaço: `montarQuestoes` puro). (2) O voltar do aparelho numa prévia (prova, cartões ou questões geradas) abre "Descartar esta prévia?" (`ConfirmarAcao`, foco em Cancelar); o voltar com o aviso aberto fecha só o aviso. Isso muda o C-6 só para prévias (os outros painéis continuam fechando direto).
- **Arquivos:** `src/ui/Assistente.tsx`. **Teste:** `scripts/fluxo/_corretor-f13.mjs` (passa). **Estado:** corrigido, aguardando verificação.

## F-14 — Lembrete diário no navegador perguntava o horário antes de dizer que não funciona (baixa) — corrigido
- **Correção:** a ação `lembrete` (pílula) no navegador diz já na 1ª resposta que só funciona no app Android, sem as opções de horário (`store/assistente.ts`, texto `SEM_LEMBRETE`, o mesmo do pedido escrito). A pílula continua na lista (explica; no APK funciona).
- **Arquivos:** `src/store/assistente.ts`. **Teste:** `e2e-assistente-dialogo.mjs` (pedido escrito, já existia); `scripts/fluxo/19-lembrete-web.mjs` do testador espera as 4 opções e passa a falhar de propósito: atualizar. **Estado:** corrigido, aguardando verificação.

## F-15 — "Cópia de segurança" dizia que o progresso fica na conta Google mesmo sem conta (média, texto) — corrigido
- **Correção:** o parágrafo é condicional: conectado, o texto de antes; sem conta, "Sem entrar na conta Google, seu progresso, histórico e cartões ficam só neste aparelho e este arquivo não os leva: entre em "Conta e sincronização" para guardá-los na conta." (`ui/Copia.tsx`, lê `useConta().estado`). **Decisão do dono (não feita):** incluir progresso/histórico/cartões no arquivo de cópia (hoje só espaços, provas, materiais).
- **Arquivos:** `src/ui/Copia.tsx`. **Teste:** `scripts/e2e-copia.mjs` (passa, inclusive 320 px sem texto cortado). **Estado:** corrigido (texto); backup do progresso em arquivo = decisão do dono.

## F-16 — "Descartar" do treino do plano apagaria sem confirmação nem desfazer (baixa) — não é problema
- `descartarPlano` (`store/assistente.ts`) mostra o aviso "Treino descartado." com o botão **Desfazer** (`AVISOS.treinoDescartado`, 8 s) e o desfazer devolve o plano (`guardarPlano(p)`). Padrão do app para ação reversível (como excluir cartão/baralho): sem confirmação central, com desfazer. Para reverificar: Treinar > Descartar: aparece o aviso com "Desfazer" e o cartão volta ao tocá-lo.

## F-04 (= C-5) — Entregar prova com questões em branco (média) — corrigido (decisão do dono: opção b)
- **Correção:** "Entregar prova" com questões em branco abre o aviso central **"Entregar mesmo assim?"** ("Você deixou N questões em branco. Depois de entregue, não dá para responder nem desfazer."), com **"Voltar à prova"** em foco, e "Entregar" em vermelho; Esc, tocar fora e o voltar do aparelho fecham só o aviso. Sem questões em branco entrega direto. `ConfirmarAcao` ganhou a prop opcional `cancelar` (rótulo do botão seguro). O aviso é um diálogo fixo no meio da tela (como "Encerrar o simulado?"): aparece inteiro por construção, então não usa `aoAparecer` (que é para elementos que crescem dentro da página).
- **Arquivos:** `src/ui/Question.tsx`, `src/ui/ConfirmarAcao.tsx`. **Testes:** `scripts/e2e-simulado.mjs` (seção 10) e `scripts/e2e-voltar.mjs`; os e2e que entregavam com branco (`e2e-simulado`, `e2e-historico`, `e2e-migracao`, `e2e-sync-base`, `e2e.mjs`) passaram a confirmar o aviso. **Estado:** corrigido, verificado pelo testador (5391).

## F-02 — Sair/voltar de um treino começado em Treinar ou no Assistente leva à aba de origem (baixa) — corrigido (decisão do dono: opção b, só Treinar e Assistente)
- **Correção:** `Session.origemAba` (preenchida pela aba ativa quando é `treinar` ou `assistente`) e `destinoDaSessao`: "Sair", o voltar do aparelho e o botão do pé do resultado (agora com o nome do destino: Início/Treinar/Assistente) voltam a ela; o aviso do simulado em andamento também (`Encerrar` vai à origem). Início, Cards e Desempenho continuam saindo para o Início. O voltar seguinte, estando na aba, segue a regra normal (Início, depois "toque de novo para sair"). README atualizado (regra de 2026-11-08 "em outra aba volta ao Início" e bloco "Fluxos").
- **Arquivos:** `src/store/app.ts`, `src/ui/Question.tsx`. **Testes:** `src/store/app.test.ts` (2 testes), `scripts/e2e-voltar.mjs`, `scripts/e2e-movimento.mjs` (o botão do pé agora é "Treinar"). **Estado:** corrigido, verificado pelo testador.

## F-03 — Treino em andamento não retoma — decisão do dono: manter como está (não alterado)

## C-7 — Painel do plano de estudo sem "Voltar" (pedido do dono)
- **O que era:** o painel do plano (Assistente) só tinha a pílula "Mais sugestões" para sair; a caixa de mensagem some enquanto qualquer painel está aberto (padrão dos painéis do chat).
- **Correção:** no jeito dos painéis do chat (pílula que chama `voltarAoInicio`), a pílula do painel do plano passou a se chamar **"Voltar"** (nos dois casos: com plano e sem plano). O voltar do aparelho já fechava só o painel (C-6). Os outros painéis em pílulas (Caderno, perguntas…) seguem com "Mais sugestões": só o do plano foi pedido.
- **Arquivos:** `src/ui/Assistente.tsx`. **Testes:** `scripts/e2e-plano.mjs` (o rótulo e o caminho de volta), `scripts/fluxo/09-voltar-assistente.mjs` do testador. **Estado:** corrigido e verificado: `npm run verificar` completo (37 etapas, inclusive e2e-plano, e2e-assistente*, e2e-teclado e e2e-camera) passou no build com esta mudança.

## C-8 — Cópia de segurança leva também o estudo (fim do F-15) (pedido do dono)
- **O que mudou:** o arquivo (versão 2) leva, além de espaços/questões/imagens/materiais/trechos, o **progresso por questão, o histórico (dias e simulados), os baralhos, os cartões e o histórico dos cards**. O texto da tela diz o que o arquivo contém (e, sem conta Google, que tudo fica só no aparelho até salvar a cópia).
- **Restaurar junta e nunca diminui:** baralhos/cartões por id (o que existe fica como está); progresso: por questão fica o registro com mais respostas; histórico: maior número do dia + união dos simulados; restaurar duas vezes não muda nada. Cópia antiga (versão 1, sem o estudo) restaura como antes. Sem tabela nova e sem mexer nas chaves (`treino-bb` segue na v7). O progresso/histórico juntados passam por `useApp.restore` (refaz os eventos de sincronização e dá "Desfazer"); baralhos e cartões entram por `acrescentarCartoes` (com o carimbo da sincronização).
- **Arquivos:** `src/core/copia.ts`, `src/services/copia.ts`, `src/services/db.ts` (`acrescentarCartoes`), `src/ui/Copia.tsx`; docs `docs/assistente.md` e README.
- **Testes:** `src/core/copia.test.ts` (ida e volta, cópia antiga, itens estragados, juntar progresso/histórico/cartões, restaurar duas vezes), `src/services/copia.test.ts` (exportar → apagar → restaurar → conferir, restauração em aparelho com estudo maior, cópia v1), `scripts/e2e-copia.mjs` (seção 5b no navegador, IndexedDB de verdade). **Estado:** corrigido, aguardando verificação do testador.
- **Não verificado:** a folha de compartilhar do Android; cópia com milhares de cartões no celular (memória da WebView; o limite de 50 MB continua); a junção de progresso com várias contas/aparelhos sincronizados (só testada com um aparelho).

## C-9 — "Desfazer" próprio para importar prova e gerar questões (pedido do dono)
- **O que mudou:** depois de **importar uma prova** ou **adicionar questões geradas**, a pílula na conversa é "Desfazer: importar a prova" / "Desfazer: adicionar as questões geradas" (no lugar do "criar o espaço", como no F-12). Desfazer tira **só as questões (e imagens) que aquela ação trouxe** e devolve o espaço ao que era (fontes, bancos, matérias); materiais, cartões e as questões que já existiam ficam. Guardar material e criar cartões já tinham o seu desfazer.
- **Vale só enquanto faz sentido:** no mesmo espaço; enquanto nenhuma dessas questões foi respondida (senão recusa e aponta "Meus espaços" para apagar o espaço); e some ao começar um treino/simulado. Se nada entrou (as questões já estavam), não há desfazer. Sem confirmação extra: é a última ação, com a pílula visível, no padrão do "Desfazer" do assistente (sem alert/confirm; nada novo na tela, então câmera/teclado/voltar não mudam).
- **Arquivos:** `src/store/assistente.ts`, `src/store/espacos.ts` (`adicionar` devolve `ids` e `antes`; novo `retirar`), `src/services/db.ts` (`removerQuestoesDoEspaco`).
- **Testes:** `src/store/espacos.test.ts` (retirar), `src/store/assistente.test.ts` (C-9: desfaz, recusa depois de responder, some ao começar treino), `scripts/fluxo/_corretor-c9.mjs` (importa um PDF de verdade, desfaz, reimporta, treino faz a pílula sumir). **Estado:** corrigido, aguardando verificação do testador.

## F-17 — A cópia não levava marcações nem anotações (média) — corrigido (continuação do C-8)
- **Causa:** o `Estudo` da cópia só tinha progresso, histórico, baralhos e cartões; o texto dizia "tudo o que é seu".
- **Correção:** `Estudo.marks` (marcações e anotações): sai na cópia, volta na restauração (junta pela alteração mais recente `t` de cada questão; a do aparelho nunca é trocada por uma mais velha), entra no resumo ("N questões marcadas ou anotadas") e no texto da tela. `services/copia.ts` grava com `saveMarks` (carimbo da sincronização) e a tela recarrega as marcas da loja.
- **Arquivos:** `src/core/copia.ts`, `src/services/copia.ts`, `src/ui/Copia.tsx`. **Testes:** `core/copia.test.ts` (F-17), `services/copia.test.ts`, `scripts/e2e-copia.mjs` (a marcação com anotação vai e volta pelo IndexedDB). **Estado:** corrigido, aguardando verificação.

## F-18 — "Progresso restaurado. Desfazer" não desfazia baralhos e cartões restaurados (baixa) — corrigido
- **Causa:** o aviso era o da loja (`useApp.restore`) e só devolvia progresso e histórico.
- **Correção:** a Cópia mostra o seu aviso **"Estudo restaurado."** com UM Desfazer que desfaz tudo o que o estudo trouxe: progresso e histórico (a loja agora devolve a função `desfazer`; `restore(..., { silencioso: true })`), e baralhos, cartões, histórico dos cards e marcações acrescentados (`EstudoRestaurado.desfazer`, só o que aquela restauração trouxe; baralho/cartão que a pessoa já tinha fica). **Não entram nesse desfazer** (dito no doc): espaços, questões, imagens e materiais restaurados. Sem mudança no aviso "Progresso restaurado." das outras origens (continua igual).
- **Arquivos:** `src/store/app.ts`, `src/core/avisos.ts` (`estudoRestaurado`), `src/services/copia.ts`, `src/ui/Copia.tsx`. **Testes:** `services/copia.test.ts` (F-18), `scripts/e2e-copia.mjs` (seção 5c: toque no Desfazer esvazia o estudo no IndexedDB). **Estado:** corrigido, aguardando verificação.
- **Observação do testador (regra mantida):** ao juntar o histórico vale o maior número do dia (3 + 6 respostas no mesmo dia aparecem como 6): decisão deliberada para restaurar duas vezes nunca duplicar; está documentada.

## C-10 — Questão importada perdia o ENUNCIADO ao gravar (alta) — hotfix antes da F6.2
- **Causa:** `Question.e` é o enunciado, mas a tabela `questoes` usa `e` como id do espaço (índice). `salvarEspaco` fazia `{...q, e: row.id}` (sobrescrevia o enunciado) e `lerEspaco` descartava `e`: ao fechar e abrir o app, a questão importada ou gerada voltava SEM enunciado (alternativas e gabarito ficavam). Na sessão da importação aparecia certo (estava na memória); os e2e só olhavam logo depois. A cópia de segurança levava as linhas já sem enunciado.
- **Correção (sem mudar o esquema do Dexie):** o enunciado vai num campo próprio da linha, `enun` (`paraLinha`/`deLinha` em `services/db.ts`), gravado e lido por `salvarEspaco`/`lerEspaco` e pela cópia (`lerConteudoDoAparelho`/`acrescentarConteudoDoAparelho` levam a linha como está). Linha ANTIGA (sem `enun`) é lida sem quebrar, com enunciado vazio, e conta em `contarSemEnunciado()`. Importar a prova de novo conserta (o id é por conteúdo: o progresso volta a casar, nada duplica; as geradas se regeneram do material).
- **Aviso, sem alert/confirm:** na abertura, aviso curto "Há questões importadas sem enunciado." (`AVISOS.semEnunciado`); o assistente explica numa fala (uma vez por abertura): quantas e "importe a prova de novo"; na tela da questão sem enunciado, um recado (`warnbox`) no topo.
- **Arquivos:** `src/services/db.ts`, `src/store/espacos.ts`, `src/store/assistente.ts`, `src/ui/Question.tsx`, `src/core/avisos.ts`. **Testes:** `src/services/db.test.ts` (3: salvar→fechar→ler, linha antiga, cópia), `scripts/e2e-enunciado.mjs` (importa um PDF, RECARREGA a página e confere o enunciado; linha antiga avisa; entrou no `npm run verificar`). **Estado:** corrigido, aguardando verificação do testador (reabrir o app depois de importar).
- **O que o dono precisa saber:** questões que ele JÁ importou antes deste conserto estão sem enunciado no banco e não há como recuperar; basta importar a prova de novo (o progresso e as marcações são mantidos). Cartões, materiais e o banco do BB não foram afetados.
