# Plano — próximos passos do Assistente

> **Feito em 2026-11-13:** Parte A (animações do assistente, da entrada à saída, e a saída das telas na troca de aba), caixa de mensagem com comandos escritos (B2, sem o histórico) e o desenho da conversa (`docs/assistente-conversa.md`). **Decididos pelo dono:** nenhuma banca nova (só Cesgranrio), sem OCR por enquanto, sem plano Blaze (portanto sem sincronizar imagens), e ele mesmo testa no celular com mais uma pessoa. O resto deste plano continua valendo como lista do que falta.

Estado de partida (2026-11-13): aba Assistente em formato de chat; leitor de PDF sem IA (99,2 % das questões, 95,4 % das alternativas iguais nas 20 provas Cesgranrio); espaços de estudo; cartões por padrões; "Reler com IA" opcional; tudo só no aparelho. Nada deste plano foi feito ainda.

## Parte A — Animações, da entrada à saída

**Regras de ouro** (valem para tudo): só `transform` e `opacity` (nada de animar altura/largura em lista grande); durações e curvas em variáveis CSS (já existe `--ease-out`); respeitar "reduzir movimento" do aparelho (o app já tem essa regra: trocar por fade curto ou nada); nada fica animando para sempre; 60 quadros em celular médio.

| # | Momento | Animação proposta |
|---|---|---|
| A1 | **Entrar na aba** | A tela sobe de leve (já existe o movimento de troca de aba); o balão de boas-vindas aparece com o avatar "saltando" |
| A2 | **O assistente responde** | Indicador "digitando…" (3 pontinhos) por 400–700 ms (proporcional ao tamanho do texto) e só então o balão entra (fade + sobe 8 px). Várias falas seguidas entram em fila, uma depois da outra |
| A3 | **Sugestões** | Pílulas entram em cascata (60 ms entre cada). Ao tocar: a pílula "voa" para a direita e vira o balão da pessoa; as outras recolhem (fade + encolhem) |
| A4 | **Painel que o assistente pede** (arquivos, nome, prévia) | Abre expandindo de baixo do balão (clip-path/opacity, sem animar altura); ao concluir ou cancelar, recolhe |
| A5 | **Lendo o PDF** | Barra de progresso real (página a página) com contador; esqueleto (shimmer) da prévia enquanto lê |
| A6 | **Prévia** | Cartões de questão entram em cascata só nas ~12 primeiras visíveis (o resto aparece sem animar); marcar/desmarcar anima opacidade; o aviso pulsa uma vez; a sugestão da IA expande suave |
| A7 | **Sucesso** | Número de questões sobe contando, "visto" desenhado em SVG e a pílula "Treinar agora" ganha destaque |
| A8 | **Sair** | Trocar de aba: a tela sai com fade/deslize curto e a conversa fica guardada; fechar painel e recolher pílulas simétricos à entrada |
| A9 | **Erro / aviso** | Balão de erro com leve tremida horizontal (1×) e cor de alerta; nunca bloqueia |

**Como fazer:** fila de falas no estado (`filaDeFalas` em `store/assistente.ts`) com tempos injetáveis (testável com relógio falso); classes CSS por estado (`entrando`, `saindo`); reaproveitar `core/movimento.ts` (vocabulário "avança/recua").

**Testes:** estender `scripts/e2e-movimento.mjs` para o chat: (1) `document.getAnimations()` volta a zero ao terminar; (2) com "reduzir movimento" nada passa de ~150 ms; (3) nenhum deslocamento de layout (CLS = 0) durante as animações; (4) nenhuma tarefa longa (> 50 ms) na cascata (PerformanceObserver); (5) captura em vídeo/quadros para você olhar (Playwright `recordVideo`).

## Parte B — Melhorar o agente

**B1. Mais bancas e formatos (leitor)**
- Medir e ajustar para FCC, Cebraspe (certo/errado), VUNESP, FGV. Perfil por banca no leitor (`core/importar/`), com os mesmos números de medição (não pode piorar a Cesgranrio).
- Alternativas "A)", "a)", "A -" sem parênteses; questão que atravessa duas páginas; gabarito em tabela por colunas.
- Gabarito e PDF escaneados: OCR **local** opcional (Tesseract no navegador) com aviso de que é menos preciso.
- Ler o **edital** (PDF): matérias, quantidade de questões e pesos → regras do simulado do espaço (hoje só o BB tem).

**B2. Conversa**
- Caixa de digitar seguindo a regra do teclado, com `entender(texto)` puro e testável ("importar prova", "criar cartões…"). Decisão sua.
- Histórico da conversa guardado (opcional) e botão "limpar".

**B3. Montar o espaço sozinho (o sonho original)**
- Depois de importar, o assistente propõe a configuração da tela: bancos, matérias, pesos e plano de simulado derivados dos dados, e você confirma nos pontos-chave.
- Temas por classificador treinado nas 1.163 questões revisadas (hoje o tema é "Geral" nas importadas).

**B4. Cartões melhores**
- Lacunas automáticas por palavras-chave; cartões a partir das questões que você errou; "gerar cartões" em lote por matéria.

**B5. Sincronizar espaços e imagens pela conta Google**
- Tipos novos em `core/sync/nuvem.ts` (espaço, questão); imagens no Firebase Storage (exige plano Blaze); regras de segurança por usuário; cota de tamanho por usuário; exclusão de conta apaga tudo.

**B6. IA opcional, mais útil**
- Reler em lote com **estimativa de custo antes** e teto; explicar o gabarito sob demanda; classificar tema; modelo por tarefa; proteção contra instruções escondidas em PDF (já tratada no pedido, ampliar os testes).

**B7. Robustez e desempenho**
- Leitor em Web Worker (a tela não trava em PDF de 60 MB), cancelar leitura, limite de páginas e de tamanho, limpeza de imagens órfãs.

**B8. Android**
- Seletor de arquivos na WebView, "Abrir com o Logos" a partir de um PDF recebido (intent), recorte de imagem em aparelho fraco.

## Parte C — Testes reais

| # | Teste | Como |
|---|---|---|
| C1 | **App no celular de verdade, automático** | APK com a depuração da WebView ligada + `adb forward` + Playwright `connectOverCDP`: roda o mesmo roteiro do `e2e-assistente.mjs` no aparelho (ou no emulador do Android Studio) |
| C2 | **PDFs reais por banca** | `scripts/medir-extracao.mjs` vira porta de qualidade: falha se os números caírem abaixo de limites por banca (PDFs ficam fora do repositório, em pasta sua) |
| C3 | **API da Anthropic de verdade** | `npm run teste:ia` (opcional, com a sua chave em variável de ambiente, 2–3 questões, custo mostrado): confere formato da resposta, recusa e erro de chave |
| C4 | **Firebase de verdade (emulador)** | Firebase Emulator Suite + `@firebase/rules-unit-testing` (a F5 do README) e um e2e com dois navegadores no mesmo usuário conferindo a sincronização nos dois sentidos |
| C5 | **Acessibilidade** | axe-core no Playwright nas telas do chat (contraste, `aria-live`, foco, ordem do teclado) |
| C6 | **Visual** | `e2e-visual` incluindo o assistente (6 tamanhos × 2 temas) para pegar quebras de layout |
| C7 | **Desempenho** | Orçamentos medidos: tempo para ler 70 páginas, memória, quadros por segundo nas animações; Lighthouse já existe em `docs/lighthouse/` |
| C8 | **Pessoas de verdade** | Roteiro de 10 minutos com 2–3 pessoas (importar uma prova, criar cartões); medir o tempo até a primeira prova importada e onde travam |

## Ordem sugerida

1. **Base de confiança:** C1 (teste no celular real) + C5/C6 do chat + A1–A4 (entrada, fala digitando, sugestões, painel).
2. **Cara de produto:** A5–A9 + B3 (montar o espaço sozinho) + B7 (Web Worker).
3. **Cobertura:** B1 (outras bancas, edital, OCR) + C2.
4. **Conta:** B5 + C4.
5. **Conversa livre e IA:** B2 + B6 + C3.
6. **Android refinado:** B8 e a rodada com pessoas (C8).

## Decisões que preciso de você antes de executar
- Quais bancas além da Cesgranrio importam primeiro (FCC, Cebraspe, VUNESP, FGV)?
- OCR local para PDF escaneado: vale a pena (mais lento e menos preciso)?
- Caixa de digitar no chat: sim ou não (conflita com a regra do teclado, que adaptamos)?
- Sincronizar imagens exige plano Blaze do Firebase (cartão cadastrado): ok?
- Quantas pessoas conseguem testar com você no celular (C8)?
