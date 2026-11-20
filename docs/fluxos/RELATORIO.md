# Relatório de fluxos (testador) — Logos

Testado em 390x844 e 360x780, tema escuro e claro, Chrome (Playwright), `npm run dev` na porta 5391. Scripts em `scripts/fluxo/`; capturas em `docs/fluxos/capturas/`.
Legenda: OK / PROBLEMA. Estado de cada problema: aberto, enviado ao corretor, corrigido e verificado, decisão do dono.

## Problemas

### F-01 (média) "Mais 10 por peso" do resultado do treino ignora o treino que acabou — CORRIGIDO E VERIFICADO (2026-11-18: agora "Mais como este"; Português continua Português)
- Tela: Treinar → Resultado.
- Passos: Treinar, marcar matéria Português, Começar, responder as 10, "Ver resultado". Tocar "Mais 10 por peso".
- Esperado: mais questões do mesmo tipo (Português). Obtido: 10 questões de outra matéria (veio Informática). O rótulo "por peso" não diz que o filtro some.
- Suspeito: `src/ui/Question.tsx` (`Resultado`, `startByWeight`), `src/store/app.ts`.

### F-02 (baixa, decisão do dono) Sair/voltar de um treino começado em Treinar leva ao Início — DECISÃO DO DONO: aprovada a opção "voltar à aba de origem" — CORRIGIDO E VERIFICADO (2026-11-18: Treinar, Início e Assistente, incluindo plano e "Continuar o treino", voltam à origem por Sair e pelo voltar do aparelho; o voltar seguinte vai ao Início; o resultado do treino do Treinar oferece "Treinar" no lugar de "Início"; `24-reverificar-f04-f02.mjs`, `25-origem-plano.mjs`)
- Passos: Treinar, filtro, Começar, "Sair" (ou voltar do aparelho). Esperado (natural): voltar ao Treinar. Obtido: Início (filtros ficam guardados). README diz que é assim ("voltar da questão ... volta ao Início"), mas o Resultado também só oferece "Início".
- Suspeito: `store/app.ts` `leave`/`sair`.

### F-03 (baixa, decisão do dono) Treino em andamento não retoma — aberto, DECISÃO DO DONO
- Passos: treino de 10, responder 2, sair. As 2 ficam no progresso, mas a sessão (posição, lista) some; não há "continuar treino". Só o plano do assistente é guardado.

### F-04 (média, decisão do dono) "Entregar prova" entrega sem aviso mesmo com questões em branco — DECISÃO DO DONO: aprovado o aviso — CORRIGIDO E VERIFICADO (aviso central "Entregar mesmo assim? Você deixou 67 questões em branco…", foco em "Voltar à prova", voltar do aparelho e Esc fecham só o aviso, com todas respondidas entrega direto). O `scripts/e2e-simulado.mjs` foi ajustado pelo corretor e roda de novo: 25 OK, exit 0.
- Passos: Simulado de 70, responder 2, ir até a 70, "Entregar prova". Entrega na hora (nota 1,5), sem "faltam 68 em branco" e sem desfazer. Não existe um painel de navegação entre questões do simulado (só Anterior/Próxima).
- Suspeito: `Question.tsx` (botão `finish`), `store/app.ts` `finish`.

### F-05 (média) Revisão do simulado entregue deixa responder questão em branco e muda o cartão-resposta, mas não a nota — CORRIGIDO E VERIFICADO (alternativas travadas, "Em branco. Gabarito: X")
- Passos: simulado, entregar com a maioria em branco, no cartão-resposta tocar numa célula em branco, escolher alternativa.
- Obtido: aparece "Errou. Gabarito: E", a resposta entra no progresso/histórico (Início passou a "3 vistas" com 2 do simulado + 1 da revisão) e a célula vira vermelha/verde; a nota continua a mesma (0,0). Placar e cartão-resposta se contradizem e o histórico ganha resposta que não é da prova.
- Suspeito: `store/app.ts` `answer` (só trava quando `s.sim && !s.done`), `Question.tsx` (`disabled={reveal && !!a}`).

### F-06 (média) Revisão pelo cartão-resposta no celular não tem "Voltar ao resultado" (só na última questão) — CORRIGIDO E VERIFICADO (pé: Anterior / Resultado / Próxima)
- Passos: resultado do simulado/treino, tocar a célula 11. O pé mostra "Anterior / Próxima"; o botão "Voltar ao resultado" só existe na última questão. O "Sair" do topo vai ao Início e perde o resultado. (O voltar do aparelho foi corrigido em C-2.)
- Suspeito: `Question.tsx` pé (`s.review` só na última).

### F-07 (média) Voltar do aparelho no assistente: perguntas com opções saem da aba; painéis ficavam abertos — CORRIGIDO E VERIFICADO (10 ações: 1º voltar fecha a pergunta e fica no Assistente, 2º sai; `scripts/fluxo/09-voltar-assistente.mjs`). Nota: na descrição original eu disse que os painéis "fechavam"; na verdade só não saíam da aba e continuavam abertos.
- Passos: aba Assistente, tocar "Simulado da semana" (ou "Montar um simulado", "Treinar questões", "Importar uma prova em PDF", "Criar cartões de um resumo") e, com a pergunta/opções na tela, usar o voltar do aparelho.
- Obtido: vai ao Início. Com "Painel do dia e plano", "Lembrete diário", "Meus materiais", "Meus espaços", "Gerar questões" o mesmo voltar só fecha o painel e fica no Assistente. Mesmo gesto, dois comportamentos; os que têm botão "Cancelar"/"Voltar" na tela deveriam fechar só a pergunta.
- Suspeito: `src/ui/Assistente.tsx` (camadas `useBackLayer` por painel), `src/store/assistente.ts`.

### F-08 (baixa) "Rever erros (N)" conta todos os erros mas a sessão tem no máximo 20 — CORRIGIDO E VERIFICADO (tela mostra "Rever erros (20 de 32)")
- `store/app.ts` `startErrors` faz `.slice(0, 20)`; o Início/Desempenho mostram o total. Esperado: rótulo "Rever erros (20 de N)" ou sem limite.

### F-09 (média) Tocar numa matéria (Desempenho/Início largo) mantém prova e situação de antes: Treinar fica com 0 questões — CORRIGIDO E VERIFICADO (só a matéria fica marcada, Começar habilitado)
- Tela: Desempenho (cartão da matéria) → Treinar. Passos: Treinar, escolher "BB 2010" e "Marcadas"; ir a Desempenho e tocar "Vendas".
- Obtido: Treinar abre com "Vendas / BB 2010 / Marcadas · 0 questões" e "Começar · 0 questões" desabilitado. Quem tocou uma matéria querendo treiná-la fica num beco sem saída aparente (o botão não faz nada e o motivo está em filtros escondidos de antes). O toque numa prova (Início) já limpa matéria e situação; o da matéria não limpa prova nem situação.
- Suspeito: `src/ui/Views.tsx` `CartaoMateria` (só `setMatFilter`; falta `setFilter('ano','')` e `setFilter('status','')`). Captura: `capturas/treinar-via-materia.png`.

### F-10 (média) Espaço de estudo vazio: telas sem orientação e botões que prometem o que não existe — CORRIGIDO E VERIFICADO (Início/Treinar/Desempenho mostram "Este espaço ainda não tem questões", nome do espaço e "Importar uma prova")
- Passos: Assistente > Meus espaços de estudo > Novo espaço > "Criar vazio". Ir ao Início.
- Obtido: Início com "Simulado de 0" (ativo), "Treino rápido: 10 questões…", lista "Bancos" vazia; tocar Treino rápido ou Simulado volta com o aviso "Nenhuma questão nesses filtros." (não há filtro nenhum). Treinar mostra todos os grupos vazios e só "Começar · 0 questões" desabilitado; Desempenho tem "POR MATÉRIA" sem itens e gráfico vazio. Nenhuma tela diz que o espaço está vazio nem leva a "Importar uma prova" no Assistente. Nenhuma tela fora do Assistente mostra em que espaço a pessoa está.
- Esperado: no espaço vazio, um estado vazio com texto e botão "Importar uma prova" (abre o Assistente); tiles de treino/simulado desabilitados ou com aviso certo ("Este espaço ainda não tem questões").
- Suspeito: `src/ui/Views.tsx` (Inicio, Treinar, Desempenho), `src/store/app.ts` (`begin` usa AVISOS.semQuestoes), `core/avisos.ts`. Capturas: `capturas/espaco-vazio-*.png`.

### F-11 (baixa) Voltar do aparelho com formulário aberto em Cards sai da tela em vez de fechar só o formulário — CORRIGIDO E VERIFICADO (Novo baralho, Renomear e Excluir: o voltar só cancela e fica no baralho/Cards)
- Passos: Cards > "Novo baralho" (digite um nome) > voltar do aparelho. Obtido: vai ao Início (o texto digitado se perde). Cards > baralho > "Renomear" (ou "Excluir este baralho" com a pergunta aberta) > voltar: sai do baralho para a lista, fechando o formulário junto. Mesma lógica do F-07: o "Cancelar" existe na tela, o voltar deveria só cancelar.
- Suspeito: `src/ui/Cards.tsx` (formulários sem `useBackLayer`). "Zerar tudo" em Mais tem a mesma característica (voltar com a confirmação aberta vai ao Início), mas ali não perde nada.

### F-12 (média) "Desfazer: criar o espaço" continua na conversa depois de importar prova e estudar, e apaga o espaço (com as questões importadas) em um toque — CORRIGIDO E VERIFICADO (importar solta o desfazer; `18-desfazer-espaco.mjs` agora mostra "pílulas Desfazer na conversa: []")
- Passos: Assistente > criar espaço vazio > importar uma prova em PDF > "Adicionar 8 questões" > treinar e responder 2 > voltar ao Assistente. A pílula "Desfazer: criar o espaço "Meu espaço"" ainda está lá; tocar nela responde "Desfiz: criar o espaço" sem pergunta: o espaço some e as 8 questões importadas com ele (o progresso fica guardado por id; reimportar o PDF recupera). O Treinar volta a mostrar o BB.
- Esperado: o desfazer só vale para a ÚLTIMA coisa feita (docs/assistente.md); importar uma prova mudou o espaço e não é desfazível, então a pílula de "criar o espaço" deveria sumir (ou o desfazer do import apagar só as questões que entraram), e desfazer algo que apaga questões já usadas deveria pedir confirmação (ConfirmarAcao, como "Apagar espaço").
- Suspeito: `src/store/assistente.ts` (registro do "desfazer": não é limpo ao importar/treinar), `src/store/espacos.ts`. Script: `scripts/fluxo/18-desfazer-espaco.mjs`.

### F-13 (baixa) Prévia de importação: reimportar o mesmo PDF não avisa que as questões já existem; voltar descarta a prévia sem perguntar — CORRIGIDO E VERIFICADO (prévia diz "já estão neste espaço"; voltar abre "Descartar esta prévia?" e o 2º voltar fecha só o aviso)
- A prévia da 2ª importação do mesmo arquivo mostra "Adicionar 8" como se fossem novas; só depois de adicionar diz "(8 já estavam: não duplicou)". O voltar do aparelho na prévia (onde a pessoa pode ter corrigido gabaritos e nomes) cancela tudo na hora, igual ao botão Cancelar, sem confirmação.
- Suspeito: `src/ui/Assistente.tsx` (prévia), `src/store/assistente.ts`.

### F-14 (baixa) No navegador o assistente pergunta o horário do lembrete e só depois diz que não funciona — CORRIGIDO E VERIFICADO (1ª fala já explica que só funciona no app Android, sem opções de horário; `19-lembrete-web.mjs` falha de propósito: esperava as 4 opções)
- Passos (web): Assistente > "Lembrete diário" > pergunta "Em que horário quer o lembrete diário?" com 4 opções > tocar "Manhã (07:30)" > resposta: o lembrete só funciona no app Android ("o navegador não consegue avisar com o app fechado"). Beco sem saída leve: 2 toques para ouvir que não dá. Esperado: dizer isso já na primeira resposta (sem as opções), ou não oferecer a pílula "Lembrete diário" fora do app. Mais não tem o cartão Lembrete no navegador (coerente).
- Suspeito: `src/store/assistente.ts` (ação lembrete), `services/native`. Script: `19-lembrete-web.mjs`.

### F-15 (média, texto + decisão do dono) "Cópia de segurança" diz que o progresso "fica na conta Google" mesmo sem estar conectado — CORRIGIDO E VERIFICADO quanto ao texto ("Sem entrar na conta Google, … ficam só neste aparelho e este arquivo não os leva"); backup do progresso em arquivo = DECISÃO DO DONO
- Passos: Mais, sem entrar com Google: o cartão diz "Seu progresso, histórico e cartões ficam na conta Google". Sem conta, ficam SÓ no aparelho e não existe nenhum jeito de exportá-los (o backup em arquivo saiu do app; "Salvar cópia" só leva espaços/provas importadas/materiais e fica desabilitado quando não há nada disso).
- Risco: pessoa sem conta acha que o progresso está seguro e perde tudo ao trocar de celular/desinstalar.
- Esperado: texto condicional ("Se você entrar com a conta Google, …; sem conta, ficam só neste aparelho") e, de preferência, um aviso/atalho "Entrar com Google" nesse cartão. Se o dono quiser, a cópia em arquivo poderia voltar a incluir progresso e cartões (decisão do dono).
- Suspeito: `src/ui/Copia.tsx` (parágrafo `note`). Script: `22-copia-cards-tile.mjs`.

### F-16 (baixa) "Descartar" do Treino do plano apaga o plano na hora, sem pergunta nem desfazer — NÃO É PROBLEMA (o corretor mostrou e eu confirmei: "Treino descartado." com Desfazer por 8 s devolve o plano)
- Treinar > cartão "Treino do seu plano" > "Descartar": `descartarPlano` direto no clique (`src/ui/TreinoDoPlano.tsx`). CLAUDE.md pede confirmação em aviso central para apagar algo; aqui perde-se o plano montado (as respostas já dadas ficam). Sugestão: ConfirmarAcao ou aviso com "Desfazer".

### Observação (sem ID, baixa): no Assistente, enquanto o painel do plano está na tela ("Continuar as questões / Outro tempo / Mais sugestões") a caixa de mensagem some; ela volta com "Mais sugestões". É coerente com os outros painéis (a caixa só aparece nas etapas de menu/pergunta), só não há botão "Voltar" nesse painel. Não enviado.

### F-17 (média) A cópia de segurança (C-8) não leva as marcações ("Marcar para revisar") nem as anotações das questões — CORRIGIDO E VERIFICADO (a cópia leva `marks`; aparelho vazio + Restaurar: 1 marcada e anotação "nota do A"; resumo diz "1 questão marcada ou anotada"; `27-copia-c8.mjs` 12/12, `29-copia-desfazer.mjs`)
- Passos: estudar, tocar "Marcar" numa questão e escrever uma Anotação; Mais > Salvar cópia; num aparelho vazio (contexto novo), Restaurar. Obtido: progresso, histórico, baralhos e cartões voltam; Treinar > Marcadas conta 0 (era 1) e a anotação não existe. O texto da tela diz "O arquivo leva tudo o que é seu: espaços, provas e questões importadas, materiais, progresso, histórico…, baralhos e cartões": a lista não cita marcações/anotações, mas "tudo o que é seu" promete mais do que entrega. As anotações são trabalho da pessoa (README as põe na conta, junto dos cartões).
- Esperado: o arquivo (`estudo`) incluir `marks` (tem `u` por item: juntar pelo mais recente) ou o texto não dizer "tudo".
- Suspeito: `src/core/copia.ts` (`Estudo`: baralhos, cartoes, prog, hist, histCartoes; falta `marks`), `src/services/copia.ts`, `src/ui/Copia.tsx`. Script: `27-copia-c8.mjs`.

### F-18 (baixa) "Desfazer" do aviso "Progresso restaurado." desfaz só progresso e histórico; baralhos e cartões da cópia ficam — CORRIGIDO E VERIFICADO (aviso agora "Estudo restaurado." com um Desfazer que tira progresso, histórico, baralhos, cartões e marcações trazidos: aparelho vazio volta a 0 vistas, 0 cartões, 0 marcadas; num aparelho que já tinha estudo e baralho "Do C", o que era dele fica; `30-copia-desfazer-merge.mjs`). Espaços/questões/materiais restaurados não entram nesse desfazer (documentado pelo corretor)
- Passos: aparelho vazio > Mais > Restaurar a cópia nova > aviso "Progresso restaurado. Desfazer" > Desfazer. Obtido: Início volta a 0 vistas, mas Cards continua com "2 cartões em 2 baralhos" e o cartão diz "Restaurei 2 baralhos, 2 cartões, progresso…". Quem desfaz acha que a restauração toda foi revertida. Esperado: desfazer tudo o que a restauração acrescentou (como o C-9 faz com questões), ou o aviso dizer "Progresso desfeito (cartões ficam)". A cópia antiga (só espaço/questões) não mostra aviso nem desfazer (coerente).
- Suspeito: `src/store/app.ts` `restore` (desfazer só de prog/hist), `src/services/copia.ts` (`acrescentarCartoes` sem desfazer). Script: `29-copia-desfazer.mjs`.

## Duplicidades e inconsistências (para decisão)
- "Rever erros" (Início/Desempenho, última resposta errada), "Errei por último" (Treinar) e "Caderno de erros" do assistente (sai com 3 acertos seguidos) são três listas de erros com regras diferentes. README registra isso como decisão; fica o aviso.
- Três caminhos para treino: "Treino rápido" (Início, 10 por peso), Treinar (filtros), assistente "Treinar questões". Rótulos e resultados diferentes (ver F-01).

## Reverificação das correções do corretor (2026-11-18)
- C-1 (simulado parcial do assistente não entra em Desempenho > Simulados): OK. "Montar um simulado > Matemática > 10", entregue; a lista continua com 1 linha (o simulado de 70). Resultado do parcial só tem "Início".
- C-2 (voltar de revisão → Resultado): OK.
- C-3 (dois toques rápidos na barra: vale o último): OK com intervalos 0, 30 e 80 ms.
- C-4 ("Treinar agora" após importar prova): OK. Deixei Português + "Errei por último" no Treinar, importei um PDF de prova (gerado pelo Chrome, 8 questões) num espaço novo e toquei "Treinar agora": abre Treinar com só a prova nova marcada, matéria Todas, "Começar · 8 questões" (`17-importar-treinar.mjs`).
- C-6 = F-07: OK.

## Fluxos que passaram
- Tour das 6 abas em 390x844 escuro/claro: sem erro de script, sem texto cortado nas capturas.
- Treino rápido: responder 2 e usar o voltar do aparelho volta ao Início, progresso gravado (2 vistas, 50 %, 1 para rever).
- Simulado: tocar outra aba abre "Encerrar o simulado?"; "Continuar" mantém a questão 3/70.
- Treino: terminar, resultado com cartão-resposta e botões Início/Mais 10 por peso.
- Assistente: abre falando (painel do dia), 14 pílulas tocadas sem erro de script; "Caderno de erros" vazio responde com mensagem útil.
- Zerar progresso (com confirmação, desfazer na hora, desfazer depois de responder mais, recarregar): estado final sempre coerente (`07-zerar-desfazer.mjs`).
- Tema Claro persiste após recarregar; Mais não perde a aba.
- Cards: criar baralho, "Salvar e criar outro" limpa os campos, Estudar fica desabilitado em baralho vazio, estudo sair/retomar, excluir baralho com confirmação; flashcard da questão cria o baralho "Das questões" e Cards passa a mostrá-lo.
- Marcar questão e anotação: preservadas ao voltar à questão; filtro Marcadas conta e habilita Começar.
- Plano de estudo (30 min): cartões primeiro, ao terminar leva sozinho às questões; sair no meio guarda "Treino do seu plano" em Treinar com "Continuar o treino (13)" e "Descartar".
- Texto cortado e rolagem horizontal (função `textoCortado`): 11 telas em 360x780 e 390x844, claro e escuro, sem problema (`11-visual.mjs`).
- Importar prova: espaço novo, ler, voltar durante a leitura (a leitura termina por trás e a prévia está lá ao voltar ao Assistente), "Treinar agora", treino no espaço novo (resultado: Início / Mais como este), Início do espaço com a prova e progresso.
- Voltar nas abas: Treinar/Cards/Desempenho/Mais/Assistente → Início; no Início "Toque em voltar de novo para sair"; o aviso volta depois do prazo; dois voltar seguidos saem do app (`15-sair-app.mjs`).
- Início > Provas: banco > cargo > prova abre o Treinar já filtrado; voltar do aparelho reabre as provas no nível onde estava; tocar o ícone Início recomeça nos Bancos.
- Chat por escrito: lixo e espaços respondem sem erro, "simulado de matemática com 10 questões" abre o simulado, voltar pergunta "Encerrar?", "limpar conversa" confirma antes (`13-chat-texto.mjs`).
- Simulado, todas as saídas (`20-simulado-saidas.mjs`): Sair, voltar e outra aba perguntam; Esc fecha só o aviso; "Encerrar" não grava nada e vai ao destino pedido; recarregar no meio volta ao Início sem sobra; entregar grava a nota e o tempo em Desempenho.
- Flashcard da questão: 1º toque cria, 2º toque diz "Esta questão já tem um flashcard"; o cartão leva a anotação.
- Regressão: `node scripts/e2e-voltar.mjs http://localhost:5391/` (27 verificações OK, exit 0) e `node scripts/e2e-simulado.mjs http://localhost:5391/` (20 OK, exit 0).
- Reverificação final (F-12..F-16): ver estados acima; `23-reverificar-2.mjs` (F-13, F-14, F-16).

## Resumo final
- 16 problemas (F-01..F-16): corrigidos e verificados F-01, F-05, F-06, F-07, F-08, F-09, F-10, F-11, F-12, F-13, F-14, F-15 (texto); F-16 não era problema; decisão do dono: F-03 (fica como está); F-02 e F-04 (= C-5) aprovados pelo dono e já corrigidos e verificados e exportar progresso em arquivo (parte do F-15). Também verificados C-1, C-2, C-3, C-4, C-6 do corretor.
- Regressão no 5391: e2e-voltar 27 OK e e2e-simulado 20 OK, rodados de novo depois de todas as correções (nenhum FALHOU).

## Atualização: F-02 e F-04 aprovados e verificados
- F-04: verificado (10 checagens em `24-reverificar-f04-f02.mjs`). F-02: verificado em Treinar, Início, Assistente (plano) e "Continuar o treino".
- Regressão: `e2e-voltar.mjs http://localhost:5391/` 39 OK, 0 falhas. `e2e-simulado.mjs` falhou em `entregar` (o aviso novo não era tratado); o corretor ajustou o script e ele passa: 25 OK, exit 0.
- F-03 (treino não retoma): fica como está por decisão do dono.

## Reverificação de C-8 e C-9 (2026-11-18)
- C-8 OK: Salvar cópia (versão 2: baralhos, cartões, progresso, histórico, histórico dos cards). Aparelho "sem dados" (contexto novo) + Restaurar: mesmas vistas/acertos (6, 67 %), mesmos baralhos (Das questões, Meu baralho), mesmo gráfico do mês; restaurar de novo diz "Nada novo" e não duplica; recarregar mantém. Aparelho com dados diferentes (3 respostas e baralho "Do C"): nada some e nada diminui (9 vistas; 3 baralhos). Cópia ANTIGA (v1, sem estudo; gerada do formato do commit HEAD em `scripts/fluxo/dados/copia-antiga.json`): aceita em aparelho vazio e em aparelho com dados, sem tocar no que existe. Falhas: F-17 (marcações/anotações) e F-18 (Desfazer parcial). Observação: no merge o gráfico do mês usa "maior número do dia" (3 + 6 respostas mostram 6 no mês, com 9 questões vistas) — é a regra documentada do corretor, só avisando.
- C-9 OK (`28-desfazer-c9.mjs`, 12 checagens): em espaço "Com as questões do BB" (1168) com 3 respostas, baralho e material guardado, importar a prova mostra "Desfazer: importar a prova"; a pílula sobrevive a trocar de aba; desfazer devolve 1176 para 1168 e deixa progresso, baralho e material intactos; depois não sobra pílula; o voltar do aparelho fecha o painel; adicionar questões geradas de um glossário (9) mostra "Desfazer: adicionar as questões geradas" e desfazer tira só elas (1177 → 1168). O `18-desfazer-espaco.mjs` agora mostra a pílula "Desfazer: importar a prova".

## Fechamento C-8, C-9, F-17, F-18
- Todos corrigidos e verificados. Regressão no 5391: e2e-voltar 39 OK (uma 1ª execução caiu por lentidão do servidor enquanto o corretor rodava o `verificar`; a repetição passou) e e2e-simulado 25 OK, exit 0.
- Resumo geral: 18 problemas F-01..F-18 + C-1..C-9. Em aberto só: F-03 (decisão do dono: fica como está). Backup do progresso em arquivo, antes "decisão do dono", agora feito (C-8).

---

# F6 — sincronização de espaços, questões e materiais (rodada de 2026-11-20)

Método: dois "aparelhos" = dois contextos de navegador, emuladores do Firebase (Auth 9099, Firestore 8080) e login falso (`localStorage.logos_emulador`, ver `scripts/_emulador.mjs`). NUNCA o Firebase real. Banco v7 realista: `scripts/fluxo/31-gerar-banco-v7.mjs` gerou `scripts/fluxo/dados/banco-v7.json` (IndexedDB v70: 2 espaços importados, 17 questões, 1 imagem, 2 materiais, 16 trechos, 52 respostas, 3 cartões em 2 baralhos, simulado entregue, marcações, 34 falas da conversa, 53 eventos); `_idb.mjs` despeja/restaura o IndexedDB. IDs desta seção: S-01, S-02…

## C-10 (hotfix antes da F6.2) — enunciado perdido ao gravar questão importada: VERIFICADO
- `34-c10-enunciado.mjs` (6 checagens OK): importar prova (8 enunciados inteiros), RECARREGAR, abrir de novo: os mesmos 8; questões geradas idem (10 no espaço); cópia de segurança salva, aparelho novo (contexto limpo), restaurar, recarregar: 10 enunciados inteiros.
- Banco v7 com linhas antigas (sem `enun`, gerado ANTES do hotfix, 17 questões sem enunciado): `35-linhas-antigas-sem-enun.mjs`: toast "Há questões importadas sem enunciado.", fala do assistente explicando, e recado na própria questão. `36-reimportar-conserta.mjs`: reimportar o mesmo PDF conserta as 8 da prova (prévia diz "8 já estão neste espaço"); as geradas só voltam a ter enunciado se forem GERADAS de novo (confirmado: 0 vazias depois).

## F6.0 — a sincronização que já existia, com dois aparelhos e o emulador: VERIFICADO
`38-f60-sync-base.mjs` (e-mail único por teste, sem limpar o emulador), 8 checagens OK: os dois entram na mesma conta e ficam "Sincronizado"; baralho e cartão do A chegam ao B; 4 respostas do A chegam ao B; baralho apagado no A some do B; B offline estuda 3 questões (situação "Sem internet: o que você fizer fica guardado aqui e sobe quando voltar."), volta online e o A passa a ver (6 vistas nos dois); "Zerar tudo" no A zera o B; "Desfazer" devolve o progresso nos dois; sem erros de script.

## F6.2 — Dexie v8 (migração do banco v7): VERIFICADO (prévia, com o código que estava no dev server em 2026-11-20)
- `32-migracao-v8.mjs` (41 checagens, 0 falhas): banco v7 realista restaurado (IndexedDB 70) e aberto pelo app novo (80, mesmo nome `treino-bb`): TODAS as linhas antigas continuam presentes e iguais em `prog` (52), `eventos` (53), `decks`/`cards` (2/3), `meta`, `sinc`, `conversa` (34), `espacos` (2), `questoes` (17), `imagens` (1, blob idêntico), `materiais` (2), `trechos` (16); Início mostra as mesmas vistas, Cards os 2 baralhos e 3 cartões, os 2 espaços aparecem, treino abre e responde nos dois espaços, busca "Copom" acha no material migrado, o simulado entregue continua em Desempenho, simulado novo abre; 2ª abertura mantém tudo.
- `42-f62-pos-migracao.mjs` (14 checagens, 0 falhas): `questoesE` tem as 17 questões (cada `[e+id]`), `imagensE` a imagem com o mesmo blob, tabelas antigas intactas; apagar um espaço o tira de `espacos`, `questoesE`, `materiais`, `trechos` e ele NÃO volta depois de recarregar; "Meu BB" e o progresso do BB iguais; importar prova nova em Meu BB (1176 questões) e recarregar; cópia v1, v2 e a de enunciados restauram no banco v8; a cópia exportada do v8 continua `versao 2`.
- `40-f62-casos.mjs` e `41-f62-ordem-contraria.mjs`: a mesma prova importada em dois espaços, apagar um (nas duas ordens) não tira as questões do outro; progresso de questões de um espaço apagado ("fantasma"): Início, Desempenho, Rever erros, caderno, painel do dia, "o que eu já tenho?" e Treino rápido sem erro.
- Linhas antigas sem enunciado (C-10) migram como estavam (com o aviso do hotfix). Falta ainda: reconferir tudo quando o corretor avisar que fechou a F6.2.

### S-02 (baixa) Apagar um espaço deixa as questões nas tabelas antigas `questoes` e `imagens`
- Depois de apagar "Concurso X" no banco migrado, `questoesE` fica sem as 17 linhas, mas a tabela antiga `questoes` ainda guarda as 17 (e `imagens` a imagem). Não ressuscitam (testado com recarregar), mas é conteúdo "apagado" que continua no aparelho e ocupa espaço; é a "cópia de segurança do que existia" do plano. Sugestão: documentar, ou limpar as tabelas antigas numa versão futura depois de um tempo.

### S-03 (baixa, já existia antes da F6) "Meu BB · 0 questões" na lista de espaços
- Um espaço criado "Com as questões do BB" aparece em "Meus espaços de estudo" como "Meu BB · 0 questões", mas o Treinar tem 1168. A contagem da lista só soma as questões próprias do espaço. Sugestão: somar as do BB quando `usaBB` ("1168 questões") ou escrever "usa as do BB + N".

## F6.3a / F6.3 / F6.4 / F6.5 — dois aparelhos + emulador (2026-11-20, dev server 5391, emuladores 9099/8080; nada contra o Firebase real)
Scripts: `_dois.mjs`, `_espacos.mjs` (helpers), `39`, `43` (c1..c7), `44`, `45`, `46`, `47`, `48`, `49`, `50`. Conta falsa com e-mail único por teste (não limpa o emulador de ninguém).

### Passou
- **Espaço importado/criado no A chega ao B** (`39`, `43 c1`): espaço, 8 questões com enunciado inteiro, material pesquisável ("o que é Copom?"); trocar para o espaço e treinar no B.
- **Desfazer a importação no A tira as questões do B; importar de novo volta** (`43 c1`). **Se o B já respondeu**, o desfazer do A é recusado com explicação ("Não consegui desfazer: você já respondeu algumas…"), ninguém perde nada (`49`).
- **Apagar espaço no A some no B** e o BB abre sem erro (`39`, `43 c3`); **os dois apagam ao mesmo tempo**: some nos dois e não ressuscita (`43 c3`).
- **B offline ao receber** recebe tudo quando volta (`43 c2`); **A offline cria espaço e material** e o B recebe quando o A volta online (`48`).
- **Mesma prova em dois espaços diferentes** (um em cada aparelho): cada um vê os dois, 8 questões em cada; apagar um não tira as do outro (`43 c4`). **Mesma prova no mesmo espaço nos dois**: não duplica (8 em ambos) (`43 c5`).
- **Espaço apagado no A enquanto o B está no meio de um treino dele**: o B NÃO é puxado (mesma questão, mesmo enunciado, ainda responde); ao sair do treino o espaço some e o app segue (`43 c6`).
- **Material grande** (937 KB, vários pacotes): o B acha termo do fim do arquivo (`43 c7`). Apagar material no A: o B deixa de achar; "Desfazer" no A devolve (`49`).
- **Progresso de questão cujo espaço não chegou** (A estuda em espaço "Manter só aqui"): os 8 eventos chegam ao B (8 linhas de progresso), mas Início, Desempenho, Rever erros (0), caderno, painel do dia, simulado da semana, "Errei por último" e Treino rápido não quebram nem contam questão fantasma; quando o A libera o espaço o B recebe as questões JÁ com o progresso e a marcação (`45`).
- **F6.3a leitura incremental e "desfazer zerar"** (`46`): aparelho que "dorme" (cache do Firestore apagado) lê 11 eventos e 7 itens, não a conta toda, e mesmo assim recebe baralho novo, baralho apagado, respostas e o resultado de zerar+DESFAZER (evento `d`); zerar+desfazer com o C offline: ao voltar tem o mesmo progresso; zerar sem desfazer zera os dois; "Sincronizar tudo de novo" não apaga nada.
- **F6.4 regras:** `scripts/testar-regras.mjs` 20/20.
- **F6.5 aviso da 1ª subida** (`44`, 22 checagens): aparece ao criar o 1º espaço com conta ligada; foco em "Manter só aqui"; Esc, voltar do aparelho e tocar fora escolhem "Manter só aqui"; texto diz que o Google guarda em servidores (sem criptografia de ponta a ponta); "Manter só aqui": o B não recebe, selo "Só neste aparelho: nada dele vai para a conta"; chip "Só neste aparelho" LIGADO (aria-pressed); desligar o chip sobe o espaço, o B recebe e o selo vira "Na conta · 1 pacote"; o chip some depois que o espaço está na conta.
- **Andamento** (`50`): em Mais o B mostrou "Baixando espaços e materiais: 0 de 8 pacotes … 2 … 4 … 6 … 7" e terminou em "Espaços e materiais: 8 pacotes na sua conta (3,5 MB)"; selo final "Na conta · 8 pacotes".
- **Visual** (`47`, 48 checagens): aviso, Meus espaços (selos e chip) e Mais › Conta em 320x568, 360x780 e 390x844, claro e escuro: sem texto cortado, sem rolagem lateral, botões do aviso >= 44 px, aviso cabe na tela, botões da conta >= 44 px.
- Regressão: `32-migracao-v8.mjs` 41/41 e `42-f62-pos-migracao.mjs` 14/14 de novo com o código final da F6.2 (S-02 e S-03 corrigidos: apagar espaço limpa as cópias antigas; "Meu BB · 1168 questões").

### Problemas e observações
- **S-04 (média)** Selo mente com o aparelho offline: um espaço criado/alterado SEM internet (nada subiu ainda) mostra "Na conta." (sem número) ao lado do chip "Só neste aparelho"; só depois de voltar online vira "Na conta · 1 pacote". Esperado: "Aguardando conexão / Enviando…". Passos: A offline > Novo espaço > Meus espaços. Suspeito: `ui/Assistente.tsx` (selo), estado do pacote `subir`. Capturas: `capturas/selo-offline.png` (via `scripts/fluxo` debug).
- **S-05 (baixa)** O aviso "O que sobe para a sua conta" aparece de surpresa para um aparelho que só RECEBEU espaços e depois apaga um (ou importa algo): a primeira "subida" dele é a lápide/importação. Aceitável (é a 1ª subida), mas logo depois de tocar "Apagar" o diálogo novo confunde. Sugestão: não perguntar por lápide, só por conteúdo.
- **S-06 (baixa)** Mais › andamento: a barra de progresso fica COLADA no botão "Sincronizar tudo de novo" (sem margem) e o texto mostra "(< 1 de 3,5 MB)". Captura: `capturas/f65-mais-baixando.png`.
- **S-07 (baixa)** Mais › Cópia de segurança: "Progresso, histórico e cartões também ficam na conta Google…; o resto só neste aparelho" está desatualizado: espaços, provas e materiais agora também vão para a conta (exceto os mantidos só aqui).
- **S-08 (baixa)** "Enviar para a conta" no aviso usa o estilo vermelho de botão perigoso (`warn`); é uma ação normal. Sugestão: estilo comum.
- Observação: no B, enquanto o espaço do A não chegou, Desempenho diz "8 respostas no mês · acerto 13 %" mas "0 de 1168 questões vistas": coerente com o desenho (histórico vem dos eventos), só pode confundir.
- **Não verificado:** conta Google real e Firestore real; imagens (F6.6 não implementada); "Pausar"/"dados móveis" (adiados de propósito); regras do Firestore PUBLICADAS no projeto real (só no emulador); aparelho real/APK; bateria e custo real de leituras/escritas; cota de 25 MB/100 MB (só leitura do código, o teste ficou pequeno); relógio muito errado entre aparelhos (janela de 7 dias).

### Reverificação S-04..S-08 (`51-reverificar-s04-s08.mjs`, `50`, `44`, `47`)
- **S-05 corrigido e verificado:** apagar num aparelho que só recebeu espaços não abre mais o aviso "O que sobe…"; quem cria/importa conteúdo continua sendo avisado.
- **S-06 corrigido e verificado:** barra com margem e "Baixando espaços e materiais: 1 de 8 pacotes (442 KB de 3,5 MB)".
- **S-07 corrigido e verificado:** a Cópia diz que espaços, provas e materiais também ficam na conta, "menos o que você mantiver só neste aparelho".
- **S-08 corrigido e verificado:** "Enviar para a conta" é botão normal (classe `btn`, sem `warn`).
- **S-04 PARCIAL (reaberto):** espaço vazio diz "Sem provas nem materiais ainda: nada para enviar." e online vira "Na conta · 2 pacotes" (OK), mas OFFLINE com 2 materiais guardados o selo continua "Sem provas nem materiais ainda: nada para enviar." (falso; esperado "Aguardando envio: faltam 2 pacotes (sobem quando houver internet)"). Provável causa: os pacotes por subir só passam a existir com conexão. Enviado ao corretor; sem resposta antes do fechamento.
- Regressão depois das correções: `44` 22/22, `47` 48/48, `50` 4/4, `e2e-voltar` 39 OK, `e2e-simulado` 25 OK.

### Resumo F6 (testador)
Passou: F6.0, F6.2 (migração, 2 rodadas), F6.3a, F6.3 (sete casos difíceis), F6.4 (regras 20/20 no emulador), F6.5 (aviso, selos, chip, andamento, 320/360/390 claro/escuro), C-10. Corrigidos e verificados: S-02, S-03, S-05, S-06, S-07, S-08. Aberto: S-04 (selo offline com conteúdo). Não verificado: Firebase real, imagens (F6.6), regras publicadas, APK/aparelho, custo real, cotas de 25/100 MB, relógio muito errado.
