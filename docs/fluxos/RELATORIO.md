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
