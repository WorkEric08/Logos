# Verificação da integração do banco novo — Logos (2026-11-06, atualizada após o sorteio em duas etapas e a conferência dos gabaritos)

**Veredito: PRONTO PARA PUBLICAR (uso pessoal): os dois bloqueios foram resolvidos (sorteio corrigido; 81 das 82 correções de gabarito conferidas à mão). Antes de abrir a versão nova no seu aparelho, exporte o backup da versão antiga (Mais → Salvar arquivo de backup); a migração nunca rodou com os seus dados reais. Pendências que não bloqueiam: conferir BB-2023-AC-ATU-23 na norma do Banco Central, e testar num celular real/PWA instalado.**

Tudo abaixo foi rodado por scripts e testes que ficam no projeto. Para repetir tudo de uma vez: `npm run verificar` (≈ 3 min, precisa do Chrome) — **as 10 etapas passaram na última execução**. Capturas: `docs/verificacao-capturas/` (80 imagens). Lighthouse: `docs/lighthouse/`.

## Os dois bloqueios da versão anterior

### Bloqueio 1 — sorteio distorcido → RESOLVIDO
**O que mudou** (`src/core/weights.ts`, função `pick`): o treino "por peso" agora sorteia em duas etapas. (1) a **matéria**, pelo peso do edital (Vendas 15, Informática 15, Português 10, Bancários 10, Mat. Financeira 5, Matemática 5, Inglês 5, Atualidades 5; fora do edital: Estatística 3, Ética 2, Legislação 2, Digitais 2), só entre as matérias que ainda têm questão no pool (a que acaba sai e o peso se redistribui); (2) a **questão** dentro da matéria, por (1 + frequência do tema) × situação (não vista 1,5 · errada 2,6 · certa 0,45) × idade (antiga 0,6; Vendas/Informática antigas 0,3). O pool já vem filtrado, então filtro por matéria ou prova é sempre respeitado. README atualizado (regra de peso).

**Evidência — 10.000 treinos de 10 questões (100.000 questões sorteadas), semente fixa** (`VITE_TABELA=1 npx vitest run src/core/sorteio.test.ts --reporter=verbose`):

| matéria | peso | **esperado pelo edital %** | **obtido %** | diferença (pontos) | antes (fórmula antiga) % |
|---|---|---|---|---|---|
| Vendas e Negociação | 15 | 19,0 | 19,0 | 0,0 | 21,8 |
| Conhecimentos de Informática | 15 | 19,0 | 19,0 | 0,0 | 8,4 |
| Língua Portuguesa | 10 | 12,7 | 12,7 | 0,0 | 14,6 |
| Conhecimentos Bancários | 10 | 12,7 | 12,6 | −0,1 | 47,3 |
| Matemática Financeira | 5 | 6,3 | 6,3 | 0,0 | 1,1 |
| Matemática | 5 | 6,3 | 6,3 | 0,0 | 2,2 |
| Língua Inglesa | 5 | 6,3 | 6,4 | +0,1 | 1,5 |
| Atualidades | 5 | 6,3 | 6,5 | +0,2 | 1,8 |
| Estatística | 3 | 3,8 | 3,8 | 0,0 | 0,7 |
| Ética | 2 | 2,5 | 2,5 | 0,0 | 0,4 |
| Legislação | 2 | 2,5 | 2,5 | 0,0 | 0,1 |
| Conhecimentos Digitais | 2 | 2,5 | 2,5 | 0,0 | 0,1 |

(esperado % = peso ÷ 79, a soma dos pesos das 12 matérias.) **A maior diferença é 0,2 ponto percentual** (Atualidades); nenhuma matéria ficou longe. As diferenças de 0,1–0,2 vêm do ruído de 100.000 sorteios e de o sorteio ser sem repetição dentro de cada treino. O teste exige diferença < 0,5 ponto em cada matéria. O teste que descrevia esse comportamento e falhava de propósito (`it.fails`) agora é um teste comum e **passa**.

**Testes novos/alterados** (`src/core/sorteio.test.ts`, 12 testes): fatores da fórmula; pesos 15/15/10/10/5/5/5/5 e 3/2/2/2; não repete e respeita n; matéria que acaba sai e o sorteio termina sem travar; com poucas matérias (filtro por prova) o peso se redistribui (Vendas 15 × Inglês 5 → 75%/25% ± 1 ponto); com filtro por matéria só sai aquela matéria; dentro da matéria a chance de cada questão segue o fator (errada 2,6 sai bem mais que certa 0,45); a tabela acima. **Provado por mutação**: trocando o peso da matéria por 1, 4 desses testes falham.

**Simulado não foi afetado** — evidência: (a) o simulado sorteia cada matéria sozinha (`pick` sobre as questões de uma matéria só): a etapa 1 não tem o que escolher e a etapa 2 usa o mesmo fator de antes, então a chance de cada questão é idêntica (teste "dentro de uma matéria…"); (b) 120 simulados sorteados no teste de estado: sempre 70 questões, composição do edital 10/5/5/5/5/10/15/15, nenhuma matéria fora do edital, sem repetida; (c) testes de pontuação inalterados e passando: 100 pontos = 32,5 básicos + 67,5 específicos, mínimos 50 / 16,25 / 33,75, nota zero elimina; (d) e2e: simulado de 70 entregue, 70 células no cartão, revisão mostra o gabarito.

**Efeito que continua (explicado, não é falha do pedido):** a etapa 2 usa, por pedido, o fator (1 + frequência do tema), que favorece o tema grande **dentro** da matéria. Como os temas do banco novo vêm de palavra-chave e muitas questões caem no tema padrão, esse efeito é forte: na 1ª questão de um treino, dentro de Português "Interpretação" tem 43% das questões e 75% da chance; em Vendas "Atendimento" 41% → 71%; em Bancários "Tesouraria" 38% → 53%. Isso não altera o % por matéria (tabela acima), só a mistura de temas dentro dela. Melhorar os temas (ou limitar esse fator) é o próximo ajuste, não bloqueia.

### Bloqueio 2 — gabaritos não conferidos → RESOLVIDO (81 de 82)
`banco/divergencias-gabarito.md` atualizado: **81 das 82 com ✔** (19 pela verificação + 62 pelo dono, todas com o banco novo certo). A única pendente é **BB-2023-AC-ATU-23 (Pix, período noturno)**, marcada "gabarito oficial, não conferido na norma do Banco Central". Evidência automática: `node scripts/verificar-dados.mjs` confere esse arquivo (81 ✔, pendente = ATU-23).

**Correção de um erro meu na versão anterior deste relatório:** eu tinha escrito que **BB 2010 Q3** era uma das divergências e estava sem conferência. Não é: ela só aparecia como divergente numa primeira conversão, que casava questões pelas alternativas ("I, apenas…") e juntou perguntas diferentes. Com o casamento atual (prova + número + texto), o gabarito antigo e o novo da BB 2010 Q3 são o mesmo (C); as 82 divergências são todas de BB 2018 (24) e BB 2023 (58). O script agora confere isso. Por isso são 81 das 82 (como você calculou), e não há uma "BB 2010 Q3" pendente.

Continuam sem conferência as **10 questões antigas sem par** (BB 2010 e 2012, Q26–30; gabarito antigo, marcadas "gabarito não conferido" na tela). Risco baixo: nas outras 373 questões pareadas de BB 2010, 2012, 2014, 2015 e 2021 o gabarito antigo coincide com o novo em 100% dos casos (0 divergências); as divergências só existem em 2018 e 2023.

## Premissas do pedido original que não batiam com o estado real
- **BB 2012 Q13**: no início da verificação o recorte ainda cortava a alternativa E; o arquivo foi substituído às 10:33 (agora 485×598 e mostra "(E) 25/36"). Confirmado por varredura de pixels e captura. OK.
- **"Imagem ampliada entra na pilha do voltar"**: a imagem ampliada é um **link que abre o PNG em outra aba**, não uma tela do app; não há camada para a pilha (o app continua na mesma questão, testado).
- **"Versão antiga"**: não há git e o código antigo não foi guardado. A "versão antiga" dos testes de atualização é o **código atual com o banco antigo e sem migração** (progresso gravado com os ids antigos). Prova a migração e a troca de service worker, não o visual antigo.

## Tabela de itens

Legenda: OK = verificado com evidência; FALHOU = falhou (e o que foi feito); NÃO TESTADO = não foi possível, com o motivo.

### A. Integridade dos dados (`node scripts/verificar-dados.mjs` → 43 OK, 0 FALHOU; saída em `docs/saida-verificar-dados.txt`)
| # | Item | Resultado | Evidência |
|---|---|---|---|
| A1 | Total 1.168 = 1.158 válidas do banco + 10 antigas sem par; por matéria/prova/origem | OK | 1.163 lidas, 1.158 válidas, 5 anuladas fora; ids idênticos ao banco (faltam 0, sobram 0). Única diferença por matéria: 21 questões que o banco novo chama de "Matemática" e o antigo de "Matemática Financeira" (valeu o antigo; README) |
| A2 | IDs únicos, campos obrigatórios, gabarito A–E, 5 alternativas ou só-imagem | OK | 0 vazios; 11 só-imagem, todas com imagem |
| A3 | Imagens: caminho existe, PNG válido, sem órfãos | OK | 400 referenciadas = 400 arquivos; assinatura/IHDR/IEND válidos; md5 idêntico a `banco/Imagens` |
| A4 | Textos-base resolvem | OK | 214 questões com texto, 30 textos, 0 faltando, 0 órfãos, igual ao banco |
| A5 | Gabarito do app = banco/*.json | OK | 1.158 de 1.158 idênticos; as 10 antigas mantêm o gabarito antigo, com `ant` e a etiqueta "gabarito não conferido" na tela |
| A6 | As 82 divergências com o gabarito novo | OK | as 82 batem com o app, o banco novo e o backup antigo; 81 conferidas à mão (ver Bloqueio 2) |
| A7 | id-map.json | OK | 478 ids: 468 mapeados + 10 mantidos; 0 para id inexistente; **0 casos de dois ids antigos → mesmo id novo**; cada par com mesmo ano e número |
| A8 | Duplicatas | OK | 0 prova+número repetidos; 0 questões com texto igual (3 grupos de alternativas iguais eram falsos positivos) |
| A9 | 40 questões no navegador | OK | `scripts/verificar-amostra.mjs`: 40 a 1440 px + 12 a 390 px = 52 conferências, 0 falhas (11 só-imagem, 10 página inteira, 25 com imagem, 15 sem, 2 antigas sem par, 12 matérias): enunciado, 5 alternativas, texto-base, imagem, tag e feedback ✓/✕ com o gabarito do JSON |
| A10 | Imagens cortadas/em branco | OK | `scripts/verificar-imagens.mjs`: 400 analisadas, 0 em branco, 0 cortadas; BB 2012 Q13 OK. 1 **conhecido**: BB 2018 INF 55 (sobra cortada embaixo; as 5 alternativas estão completas acima) |

### B. Migração do progresso
| # | Item | Resultado | Evidência |
|---|---|---|---|
| B1 | Progresso sintético cobrindo os casos | OK | `src/core/migracao.test.ts`: as 478 antigas com progresso, gabarito corrigido, sem par, id fora do mapa, dois→um, id novo já com progresso |
| B2 | Contagens antes/depois | OK | sem perda nem duplicação; só mudam `ok` e `c` das corrigidas (só a última resposta é reavaliada). Regra do dois-para-um (não ocorre nos dados reais, testada): soma `n` e `c`; `ok`/`last`/`t` da tentativa mais recente |
| B3 | Idempotência | OK | rodar de novo: 0 movidas, resultado idêntico |
| B4 | Falha no meio | OK | bug de código achado e corrigido (app preso na abertura; resposta nova podia ser apagada). Teste unitário (falha no código antigo, passa no novo, por mutação) e no Chrome real com erro de IndexedDB injetado: o app abre, avisa, o progresso antigo segue intacto, a cópia em `localStorage` existe, e na abertura seguinte a migração conclui |
| B5 | Fluxo real de atualização | OK | `scripts/e2e-migracao.mjs`: 78 questões vistas (72 com par, 6 sem par, 21 corrigidas) → aviso "Banco de questões atualizado: 72 respostas suas foram mantidas; 21 tiveram o gabarito corrigido."; IndexedDB registro a registro igual ao esperado; Σn 84 → 84; acertos 19 → 18 (esperado −1); cópia de segurança idêntica |
| B6 | Backup/restauração | OK | arquivo e texto, versão nova (ida e volta) e versão antiga (passa pelo mapa); cópia do localStorage restaura. "Compartilhar" do celular **NÃO TESTADO** (Chrome do teste sem `navigator.share` com arquivos) |
| B7 | Zerar + Desfazer | OK | Desfazer em < 8 s devolve tudo; sem clicar, some em 8,5 s |

### C. Regras do app
| # | Item | Resultado | Evidência |
|---|---|---|---|
| C0 | `npm test` / `tsc` / `build` / e2e | OK | **56 testes passam**, 0 falhas, 0 "falha esperada" (5 arquivos); tsc sem erros; build ok; `npm run verificar`: 10 de 10 etapas OK |
| C1 | Fórmula e pesos | OK | ver Bloqueio 1 |
| C1b | 10.000 sorteios | OK | tabela do Bloqueio 1 (maior diferença 0,2 ponto) |
| C2 | Simulado | OK | ver Bloqueio 1 |
| C3 | Filtros e "Rever erros" com ids novos | OK | testes de estado + e2e (tocar numa prova do Início abre o Treinar filtrado) |
| C4 | Temas por palavra-chave | OK (relatório) | `docs/relatorio-temas.txt` (inclui 30 amostras). Não existe tema "Geral": o equivalente é o tema padrão da matéria. Questões novas sem par no tema padrão: Informática 14%, Matemática 49%, Português 49%, Legislação 100% (um tema só), Atualidades 50%, Vendas 11%, Bancários 38%, Estatística 4%, Inglês 57%, Mat. Financeira 20%, Ética 57%, Digitais 73%. Nas 30 amostras: ~metade certa, ~6 claramente erradas, ~9 duvidosas. Classificação ruim: Bancários (principalmente), Ética, Atualidades, Digitais |
| C5 | Voltar | OK | testes de `backStack` (camada; Início; avisa; 2º toque em 2,5 s) + e2e. Imagem ampliada: N/A (outra aba) |
| C6 | Sem alert/confirm/prompt | OK | `grep` em `src/`: 0; navegador: 0 diálogos no e2e inteiro |
| C7 | Tema sem piscar | OK | e2e: tema salvo × aparelho (4 combinações): 1 só cor de fundo da 1ª pintura até o app abrir |

### D. Visual e imagens (`node scripts/e2e-visual.mjs` → 212 OK, 0 FALHOU; 80 capturas)
| # | Item | Resultado | Evidência |
|---|---|---|---|
| D1 | 320/360/390/768/1024/1440 px × claro/escuro: sem rolagem lateral e sem texto cortado | OK | Início, Treinar, Desempenho, Mais, questão sem imagem, com imagem, só-imagem, Resultado |
| D2 | Questão com imagem: acima no celular, painel direito em ≥ 1180 px; alternativas; ✓/✕ | OK | 12 combinações tamanho × tema |
| D3 | 32 recortes de página inteira: "toque para ampliar" | OK, com ressalva | bug real corrigido (o service worker devolvia o `index.html` em vez do PNG; `navigateFallbackDenylist`); abre o PNG em outra aba e o app continua na questão. Não é camada do app. **NÃO TESTADO** em celular real/PWA instalado |
| D4 | 11 só-imagem: só as letras A–E, gabarito certo | OK | e2e-visual + amostra |
| D5 | Capturas | OK | `docs/verificacao-capturas/` |

### E. PWA, offline e desempenho
| # | Item | Resultado | Evidência |
|---|---|---|---|
| E1 | Bundle / lazy-load | OK (avaliado, **não implementado**) | JS 1.398 kB (433 kB comprimido); o banco é 77% disso. Lazy-load: ganho pequeno (LCP 0,8 s no celular simulado) e risco de mexer no estado inteiro. Não vale agora |
| E2 | Imagens fora do precache; cache; espaço | OK | 0 PNG de questão no precache; a imagem vista entra em `questoes-img`; 16,1 MB após a 1ª visita; 400 imagens = 33,2 MB (pior caso ≈ 50 MB) |
| E3 | Offline | OK | Início, sorteio, resposta, progresso, simulado; questão com imagem já vista abre; nunca vista mostra aviso claro com "Tentar de novo" |
| E4 | Atualização do service worker sem perder dados | OK | 1ª abertura da versão nova serve a antiga; 1 recarga e a nova assume, sem perda |
| E5 | Lighthouse (celular simulado) | OK | Desempenho 100, Acessibilidade 100, Boas práticas 100, SEO 91 (só falta robots.txt). Lighthouse 13 não tem categoria PWA: manifesto, ícones e meta conferidos no e2e |

## Problemas encontrados

### Corrigidos (código)
1. **Grave** — "toque para ampliar" abria o app em vez da imagem com o service worker ativo.
2. **Grave** — falha ao gravar a migração deixava o app preso na abertura e podia apagar resposta nova.
3. **Grave (comportamento)** — sorteio por peso distorcido com o banco novo → sorteio em duas etapas (Bloqueio 1).
4. **Médio** — imagem quebrada sem rede → aviso claro + "Tentar de novo".
5. **Médio** — faltava a etiqueta "gabarito não conferido" nas 10 antigas sem par.
6. **Menor** — teste e2e instável; meta description (SEO 82 → 91); Playwright como dependência de desenvolvimento.

### Pendências (não bloqueiam)
1. **BB-2023-AC-ATU-23**: conferir o gabarito oficial na norma do Banco Central.
2. **Celular real / PWA instalado**: não testado (link de ampliar, backup por "compartilhar", atualização do service worker num aparelho com a versão antiga).
3. **Imagem ampliada**: manter como link para outra aba ou criar tela cheia no app (aí entra na pilha do voltar).
4. **BB 2018 INF 55**: recorte com sobra embaixo (cosmético).
5. **Ícone "maskable"** usa a mesma imagem 512, sem margem de segurança: pode ficar cortado no Android. Não testado.
6. **Temas por palavra-chave**: melhorar a classificação (principalmente Bancários) para o efeito do tema dentro da matéria ficar mais justo.

## Riscos que continuam
- **Migração testada com um perfil de teste, não com os seus dados reais** → exporte o backup antes. O app também guarda uma cópia automática em `localStorage` (`treino_progresso_antes_do_banco_novo`).
- **Tentativas antigas não reavaliáveis**: nas 82 questões corrigidas só a última resposta é reavaliada; o histórico anterior fica como estava (sua taxa de acerto nessas pode estar um pouco errada).
- **Imagens sem rede**: questão com imagem nunca aberta não carrega offline (agora avisa).
- **Mistura de temas dentro da matéria** ainda favorece o tema grande (ver Bloqueio 1).
- **10 antigas sem par** (BB 2010/2012 Q26–30) sem conferência de gabarito (risco baixo, ver Bloqueio 2).
- Leitura humana das imagens só por amostra (24 de Estatística/Matemática, as 11 só-imagem; as 32 de página inteira por varredura).

## Como repetir
`npm run verificar` roda as 10 etapas. Separadas: `npm test`, `npx tsc --noEmit`, `node scripts/verificar-dados.mjs`, `node scripts/verificar-imagens.mjs`, `node scripts/verificar-amostra.mjs`, `node scripts/e2e.mjs`, `node scripts/e2e-offline.mjs`, `node scripts/e2e-visual.mjs`, `node scripts/e2e-migracao.mjs` (as de navegador precisam do `npx vite preview --port 4173`, exceto a de migração, que sobe a 4180). Tabela do sorteio: `VITE_TABELA=1 npx vitest run src/core/sorteio.test.ts --reporter=verbose`.
