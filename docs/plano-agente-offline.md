# Plano — o "agente" do Logos sem LLM, offline-first

**Princípio do produto:** a pessoa entrega materiais (provas, gabaritos, resumos, apostilas) e o agente, **no aparelho e sem internet**, transforma isso em questões, simulados e flashcards, e conduz o estudo. Este plano diz como chegar lá **sem modelo de linguagem**, inspirado no que o mercado e projetos parecidos fazem, mantendo os padrões do projeto (núcleo puro e testado, Dexie que só cresce, regra do teclado, movimento com "reduzir movimento", medir antes de mudar, docs atualizadas, `npm run verificar` + APK).

Estado em 2026-11-15: chat com sugestões e caixa de mensagem (`core/conversa.ts`), importação de prova PDF medida (99,2 % das questões), cartões por padrões (`core/importar/cartoes.ts`), espaços de estudo, simulado simples, IA opcional (BYOK). Ver `docs/assistente.md` e `docs/assistente-conversa.md`.

---

## 1. O que o mercado e projetos parecidos ensinam

| Fonte | O que fazem (sem LLM) | O que trazemos para o Logos |
|---|---|---|
| **Chatbots por regras** (Rasa forms, Genesys, Hubtype, Progress) | Árvore de decisão com botões; **slot filling** (pergunta o que falta); contexto guardado; quando ambíguo, **diz o que entendeu e oferece opções** em vez de adivinhar; testar conversas de ponta a ponta | Já temos pílulas e desambiguação. Falta **slots** ("simulado de matemática com 20" → matéria + quantidade), **contexto** ("dessa prova" = a última importada) e conversa guardada |
| **Paleta de comandos** (Linear, Raycast, Superhuman `command-score`, `cmdk`) | Digitar filtra ações com **casamento aproximado**, setas + Enter, e "criar a partir do texto digitado" quando nada casa | **Sugestões que se filtram enquanto a pessoa digita** (typeahead) na caixa do chat |
| **NLP.js (AXA)** | Classificador de intenções + entidades que roda no navegador, offline, com português | Referência de arquitetura (intenção + entidades). Não precisamos da biblioteca (2,3 MB): o nosso `entender()` + um extrator de entidades por regras cobre o domínio pequeno |
| **Obsidian Spaced Repetition / RemNote** | Flashcards por **sintaxe no próprio texto**: `Pergunta::Resposta`, `:::` (dupla), bloco com `?`, lacuna com `==destaque==`, `**negrito**` ou `{{chaves}}`; RemNote: `>>`, `::`, `{{cloze}}` | Aceitar a **mesma sintaxe** nos resumos (TXT/MD/PDF): quem já usa Obsidian/Anki/RemNote importa sem esforço, e o resultado é **100 % fiel** (não é palpite) |
| **SuperMemo — 20 regras / Anki** | **Princípio da informação mínima**; lacuna (cloze) como forma mais rápida e eficaz; enumerações viram **um cartão por item**; redundância por ângulos diferentes é boa | Regras de qualidade aplicadas a todo cartão gerado (tamanho, uma resposta por cartão, enumeração quebrada) |
| **Quizlet Learn** | Múltipla escolha com **distratores tirados do próprio conjunto** (respostas de outros cartões); começa fácil (escolha) e progride para escrever | Questões A–E geradas do material usando **outras definições/termos do mesmo tipo** como alternativas erradas; modos de dificuldade crescente |
| **Literatura de geração de distratores** (revisões PeerJ 2024, arXiv 2402.01512) | Métodos tradicionais: mesma categoria semântica, similaridade de forma, perturbação numérica, frequência | Distratores por **tipo** (sigla↔sigla, órgão↔órgão, número↔número perturbado, lei↔lei) e por **matéria** (alternativas reais do banco) |
| **YAKE!** | Extração de palavras-chave **sem treino e sem dicionário**, multilíngue (estatística do próprio texto) | Escolher **o que esconder** na lacuna e quais termos viram glossário |
| **MiniSearch** | Busca de texto completo **na memória do navegador**, offline, com prefixo, aproximação (erro de digitação) e ranking BM25 | "**Pergunte ao seu material**": o chat responde mostrando o trecho certo dos seus arquivos e questões, com a fonte |
| **Stemmer português** (RSLP/Orengo; Snowball do `lunr.pt`) | Reduz "bancários/bancário/banco" ao radical | Busca e entendimento tolerantes a plural/flexão |
| **FSRS (`ts-fsrs`, MIT)** | Agendador de revisão moderno; no benchmark do próprio projeto (1,7 bi de revisões) erra bem menos que o SM-2 | Trocar o agendamento dos Cards (hoje parecido com SM-2) — **decisão sua**, ver perguntas |
| **QConcursos / Estratégia / Gran** | **Caderno de erros** por disciplina; tirar a questão depois de **3 acertos seguidos**; **simulado semanal personalizado** a partir do histórico; estatística por banca/disciplina/assunto | Caderno de erros automático + simulado da semana montado pelo agente com o que você mais erra |
| **Embeddings pequenos** (Transformers.js: bekko-embedding 7,7 M parâmetros, multilingual-e5-small 21,6 M) | Busca **por significado** no navegador, sem servidor (não é LLM) | Opcional e tardio (download de dezenas de MB); a busca por palavras resolve a maior parte |

---

## 2. Diagnóstico do assistente atual

**Bom:** ações fixas documentadas, prévia antes de gravar, nada inventado, leitor de prova medido, conversa animada, caixa de mensagem dentro da regra do teclado.

**Limita o salto:**
1. O agente **não guarda o material**: lê, gera e esquece. Não dá para "gerar mais", "perguntar sobre o resumo" nem ligar uma questão errada ao trecho que explica.
2. Entende **só a ação**, não os detalhes (matéria, quantidade, prova, prazo).
3. Os geradores de cartão reconhecem poucos padrões e **não geram questões** a partir de resumos.
4. A conversa é **reativa**: não abre o dia dizendo o que estudar.
5. Conversa e ações não ficam guardadas; não há "desfazer" pelo chat.

---

## 3. A arquitetura alvo: um agente determinístico em 5 camadas

Tudo puro em `src/core/` (testável), estado em `src/store/`, tela em `src/ui/`, dados no Dexie (só **acrescentar** tabelas; o nome `treino-bb` nunca muda).

1. **Biblioteca de materiais** (`core/material/`): cada arquivo importado vira um *Material* do espaço: texto em parágrafos, origem (arquivo, página), data. Guardado no aparelho (tabela nova `materiais`). Reprocessável quando os geradores melhorarem.
2. **Mapa do conhecimento** (`core/conhecimento/`), extraído do material **por regras**:
   - **Glossário:** termo → definição ("X: …", "X – …", "X é …", sintaxe `::`).
   - **Entidades tipadas:** siglas com expansão ("Comitê de Política Monetária (Copom)"), leis/artigos ("Lei nº 4.595/64", "art. 5º"), órgãos, números/percentuais/valores, datas, enumerações ("são três: A, B e C").
   - **Frases-fato:** frases curtas e afirmativas que contêm entidades (matéria-prima de lacunas e questões).
   - **Palavras-chave** (YAKE simplificado) para escolher o que importa.
   - **Índice de busca** (MiniSearch + stemmer pt) sobre materiais, glossário e questões.
3. **Habilidades** (`core/habilidades/`, evolução do catálogo `ACOES`): cada uma declara **entradas (slots)**, **validação**, **prévia**, **execução**, **desfazer**, documentação e testes. Exemplos: importar prova; importar resumo; gerar cartões; gerar questões; montar simulado; caderno de erros; perguntar ao material; plano do dia.
4. **Diálogo** (`core/conversa.ts` evoluído): intenção + **entidades** (matéria, quantidade, prova/banco, tempo, "dessa prova"), **pergunta o que falta** com pílulas, contexto da conversa, desambiguação, typeahead, histórico guardado, "desfazer".
5. **Avaliação** (`scripts/medir-*.mjs` + testes): cada gerador tem conjunto-ouro e números que não podem piorar (como já fazemos com o leitor de PDF). Na prévia, a pessoa aceita ou descarta, e a **taxa de aceitação** fica só no aparelho, para calibrar as regras.

---

## 4. Como o fluxo fica para a pessoa

**Primeiro uso (3 passos guiados):** "Qual concurso?" → "Me mande a prova/edital/resumo" → prévia única: *"Li 70 questões e 1 resumo. Gerei 48 cartões e 20 questões de treino. Quer revisar antes de entrar?"* → tela inicial já montada.

**Dia a dia (proativo, ao abrir a aba):** *"Bom dia! Hoje: 14 cartões, 6 questões no caderno de erros e Matemática está em 52 %. Sugiro um simulado curto de Matemática (15 min)."* com pílulas [Começar] [Só os cartões] [Outra coisa].

**Material novo:** "Importar resumo" → o agente mostra **o que entendeu** (glossário, siglas, números) → oferece **o que pode gerar** (cartões, questões A–E, um simulado do tema) → prévia → entrada.

**Perguntar:** "o que é Copom?" → resposta curta do **glossário** + trecho do material com a fonte + pílulas [Criar cartão disso] [Questões sobre isso].

**Depois de errar uma questão:** "Errei a Q12" (ou automático) → trecho do material que explica, cartão sugerido e a questão entra no caderno de erros.

---

## 5. Fases (cada uma termina com tudo verde e APK)

Cada fase segue o mesmo **checklist de padrões** (seção 6). Ordem pensada para cada fase já entregar valor sozinha.

### F1 — Biblioteca de materiais + busca ("pergunte ao seu material")
- Tabela `materiais` (Dexie v6, só acrescenta). Importar resumo passa a **guardar** o material. Lista de materiais por espaço, com apagar.
- `core/conhecimento/indice.ts`: MiniSearch (import sob demanda) + stemmer português (Snowball, portado do `lunr.pt`, puro e testado).
- Habilidade **perguntar**: "o que é X?" / "onde fala de Y?" → até 3 trechos com destaque e fonte; sem resultado = "não achei nos seus materiais".
- **Testes:** stemmer (casos de plural e flexão), índice (acentos, erro de 1 letra), habilidade (resposta, vazio); e2e: importar resumo → perguntar → ver trecho.
- **Pronto quando:** 95 % das perguntas de um conjunto-ouro de 40 (feito com os seus resumos) trazem o trecho certo entre os 3 primeiros.

### F2 — Diálogo com detalhes, contexto e memória
- Extrator de **entidades da fala** (matéria pelo nome ou apelido, números, prova/banco, "dessa"/"essa prova", "hoje", "semana").
- **Slot filling:** faltou algo → o agente pergunta com pílulas. Ex.: "simulado" → [Matemática] [Português] [Todas]; "20 questões" já preenchido.
- **Typeahead:** enquanto digita, as pílulas se filtram com casamento aproximado (estilo paleta de comandos).
- **Histórico da conversa no aparelho** (tabela `conversa`), botão "Limpar conversa".
- **Desfazer** pelo chat ("desfazer" ou pílula após cada ação que grava).
- **Testes:** corpus de 120 frases com intenção e entidades esperadas (`conversa.test.ts`); e2e de slot filling; regra do teclado com a lista de sugestões aberta.

### F3 — Cartões 2.0 (fiéis e por regras de qualidade)
- **Sintaxe explícita** (fidelidade 100 %): `Pergunta::Resposta`, `:::` (dupla), bloco com `?`, `==lacuna==`, `{{lacuna}}`, `**lacuna**` (Obsidian/RemNote).
- **Gerados do mapa:** sigla ↔ expansão (dois sentidos), termo ↔ definição, **lacuna** na entidade principal da frase-fato, **enumeração → um cartão por item**, números/datas em lacuna.
- **Qualidade (SuperMemo):** frente ≤ 1 ideia, verso curto, sem pronome solto ("isso", "ele"), sem lacuna óbvia (palavra repetida na frente).
- **Cartão de questão errada** com o trecho do material que explica (se houver).
- **Medição:** conjunto-ouro (você marca "bom/ruim" em ~100 cartões gerados de 3 resumos); meta ≥ 80 % "bons"; não piorar.

### F4 — Questões A–E geradas do material (estilo Cesgranrio)
- **Modelos de questão** (por regras): "Qual é a definição de X?", "A sigla X significa:", "Segundo o texto, é correto afirmar que…", "Assinale a alternativa INCORRETA…", lacuna numérica.
- **Distratores** (5 alternativas): outras definições/entidades **do mesmo tipo** no material; alternativas reais do banco **da mesma matéria**; números perturbados (±10 %, ordem de grandeza, ano vizinho); nunca repetir, nunca deixar a certa óbvia (tamanho e forma parecidos).
- Entram como questões do espaço marcadas **"geradas"** (filtro próprio no Treinar; peso menor no sorteio que as de prova real; nunca no simulado do edital).
- **Medição:** conjunto-ouro (você avalia ~60 questões); meta: ≥ 70 % aproveitáveis sem edição; distrator absurdo < 10 %.

### F5 — Caderno de erros e simulados inteligentes
- **Caderno de erros automático** (QConcursos/Estratégia): toda questão errada entra; sai depois de **3 acertos seguidos**; por matéria.
- **Simulado da semana** montado pelo agente: mistura caderno de erros, matérias fracas e questões novas, no tamanho que você escolher; e simulado por matéria, por prova ou só de geradas.
- Comandos: "simulado de 30 com o que mais erro", "rever erros de Português".

### F6 — Painel do dia (agente proativo) + plano de estudo
- Ao abrir a aba: resumo do dia (cartões vencidos, caderno de erros, matéria mais fraca, sequência de dias), com 1 sugestão principal e alternativas.
- **Plano por regras:** tempo disponível ("tenho 30 min") → divide em cartões, erros e questões novas pelo peso do edital e pelo desempenho.
- Opcional: lembrete diário local (notificação no APK, sem servidor).

### F7 — FSRS nos Cards *(só com o seu "sim")*
- `ts-fsrs` (MIT, ES modules) no lugar do agendamento atual; **migração dos cartões existentes** sem perder histórico (estimar estado inicial a partir de intervalo e acertos), com desfazer e teste de migração (padrão do projeto para dados).

### F8 — Busca por significado *(opcional, tardio)*
- Modelo de embedding pequeno (não é LLM) baixado **só se a pessoa ligar**, guardado no aparelho; melhora "perguntar" e escolha de distratores. Só se F1 mostrar que palavras não bastam.

---

## 6. Padrões que toda fase segue (checklist)

- **Núcleo puro + testes** em `src/core/**` (sem DOM, sem banco); estado em `store/`; tela em `ui/`.
- **Dados:** Dexie só **acrescenta** tabelas/versões; nada some sem lápide/desfazer; `treino-bb`, `br.com.treinobb` e chaves de `localStorage` nunca mudam.
- **Offline-first:** bibliotecas novas carregadas **sob demanda** (`import()`), pequenas; nada depende de rede; funciona no APK.
- **Nada inventado:** todo gerador passa por **prévia** com aceitar/descartar; o que veio do material mostra a **fonte**.
- **Regra do teclado:** campo novo → `scripts/campos-de-texto.json` + cenário em `e2e-teclado.mjs` (4 celulares).
- **Movimento:** só `transform`/`opacity`, entrada **e** saída, "reduzir movimento" desliga; cenário em `e2e-assistente-movimento.mjs`.
- **Medir antes de mudar:** cada gerador com `scripts/medir-*.mjs` e conjunto-ouro; números no doc; não pode piorar.
- **Linguagem:** pt-BR, curto, primeira pessoa, erro sempre com próximo passo; sem `alert/confirm`.
- **Docs:** `docs/assistente.md`, `docs/assistente-conversa.md`, README (seção "Assistente") e este plano atualizados na mesma entrega.
- **Fechamento:** `npm run verificar` com 0 falhas + `npm run apk` + roteiro de teste no celular para você.

---

## 7. Riscos e limites honestos

- **Geração sem LLM depende da forma do texto.** Resumos bem estruturados (definições, siglas, listas) rendem muito; texto corrido rende pouco. A sintaxe explícita (F3) e a prévia compensam.
- **Questões geradas são mais fáceis que as da banca.** Servem para fixar conteúdo, não para medir nível de prova: por isso ficam separadas do simulado do edital.
- **Português:** não há biblioteca madura de NLP em JS para pt; usaremos regras + stemmer, com testes de casos reais.
- **Tamanho do app:** MiniSearch é pequeno; FSRS é pequeno; embeddings (F8) são grandes e por isso opcionais.

---

## 8. Decisões que preciso de você (respondidas em 2026-11-15: o dono delegou ao engenheiro)

1. **Questões geradas de resumos (F4):** quer, sabendo que são mais fáceis que as da banca e ficam separadas? Ou foco só em cartões + questões reais?
2. **FSRS (F7):** trocar o agendamento dos Cards (melhor retenção, mas os intervalos dos seus cartões atuais mudam após a migração)?
3. **Histórico da conversa guardado no aparelho (F2):** sim? (Ele também sincronizaria pela conta depois.)
4. **Sintaxe nos resumos (F3):** adotar a do Obsidian/RemNote (`::`, `==lacuna==`)? Você já escreve resumos assim ou em outro formato?
5. **Ordem:** a proposta é F1 → F2 → F3 → F5 → F4 → F6. Quer outra prioridade (por exemplo, caderno de erros e simulado da semana primeiro)?

**Decisões tomadas:** (1) questões geradas **sim**, separadas e fora do simulado do edital; (2) FSRS **decidido ao chegar em F7** (só com migração testada e desfazer); (3) histórico da conversa **guardado no aparelho** (F2); (4) sintaxe do Obsidian/RemNote **adotada** (F3); (5) ordem **F1 → F2 → F3 → F5 → F4 → F6**, depois F7 e F8 opcionais.

---

## Andamento

| Fase | Estado |
|---|---|
| **F1** — Biblioteca de materiais + busca | **Feita (2026-11-15)** |
| **F2** — Diálogo com detalhes, contexto e memória | **Feita (2026-11-15)** |
| **F3** — Cartões 2.0 | **Feita (2026-11-16)** |
| **F5** — Caderno de erros e simulados inteligentes | **Feita (2026-11-16)** |
| **F4** — Questões A–E geradas do material | **Feita (2026-11-16)** |
| **F6** — Painel do dia + plano de estudo | **Feita (2026-11-16)** |
| F7 — FSRS nos Cards (opcional) | Próxima (só com o seu "sim") |
| F8 — Busca por significado (opcional) | Falta |

### F6 — o que ficou
O assistente **abre a aba falando** (painel do dia, no máximo a cada 3 h) com UMA sugestão principal por prioridade e até 2 alternativas como pílulas; **plano por tempo** ("tenho 30 minutos") dividindo cartões, caderno de erros, matérias fracas e novas; "treinar questões novas". Sem tabela nova. **Limites:** estimativas de tempo (30 s/cartão, 2 min/questão) e meta de 20/dia são minhas; **lembrete diário por notificação NÃO feito** (exige plugin nativo + permissão do Android: muda o APK; faço se você pedir).

### F4 — o que ficou
Questões de 5 alternativas geradas por regras a partir dos fatos do gerador de cartões, em 7 tipos (definição, termo, sigla, número, lacuna, pergunta e resposta, "assinale a INCORRETA"), com alternativas erradas do próprio material (mesmo tipo e forma, tamanho parecido; números variados na mesma unidade), prévia com a fonte, marcação "gerada" (metade do peso, fora do simulado do edital), repetíveis (mesmos ids). **Limites:** só sai questão quando há ≥ 5 fatos do mesmo tipo; alternativas do banco de provas reais **não** foram usadas (entregariam a certa pelo estilo); a meta de ≥ 70 % aproveitáveis só se confirma com os seus materiais (`scripts/medir-questoes.mjs`); "simulado só de geradas" ficou para quando você pedir (hoje: "treinar essa prova" logo depois de adicionar, ou a "prova" Geradas no Treinar).

### F5 — o que ficou
Caderno de erros automático (entra ao errar, sai com 3 acertos seguidos, lido do registro de eventos), painel e comandos ("rever erros de português", "treinar meus erros", "simulado de 30 com o que mais erro"), **simulado da semana** (40 % caderno + 30 % matérias fracas + novas) com a mistura explicada, e a opção "Só dos meus erros" no simulado. Sem tabela nova. Medido com testes de núcleo (17), frases (corpus) e e2e no navegador com respostas reais. **Limites:** "Rever erros" do Treinar/Início usa a regra antiga; simulado "só de geradas" e o cartão automático de questão errada ficaram para depois da F4 (dependem das questões geradas); a regra de 3 seguidos não é configurável.

### F3 — o que ficou
Sintaxe explícita (`::`, `:::`, `?` sozinho, `==x==`, `{{x}}`), siglas nos dois sentidos, listas e enumerações em um cartão por item, lacuna em números/datas/valores, regras de qualidade (barra o ruim com o motivo à vista, avisa o discutível), tipo de cada cartão na prévia e trecho do material no verso do cartão de questão. Sem tabela nova. Medido com o conjunto-ouro do teste (100 %, pequeno e meu) e com `scripts/medir-cartoes.mjs`. **Limites:** a meta "≥ 80 % de cartões bons em ~100" só se confirma com os seus resumos reais (o script existe para isso); "lacuna na entidade principal da frase-fato" (sem NLP) **não** foi feita — só números e negrito; o cartão automático de questão errada depende do caderno de erros da F5.

### F2 — o que ficou
Camada pura `core/dialogo/` (entidades, motor de perguntar o que falta, sugestões ao digitar), ação **`treinar`**, pedidos com detalhes em simulado e treino, perguntas com opções (etapa `pergunta`), desfazer da última ação (espaço, material, cartões), limpar conversa com confirmação e histórico guardado (Dexie **v7**, tabela `conversa`, últimas 300 falas, fila de gravação). Medido: 87 frases (`corpus.test.ts`) e 77 casos de entidades/motor; e2e no navegador (`e2e-assistente-dialogo.mjs`). Limites: desfazer de **um** passo, importar prova não se desfaz; frases com dois pedidos ("importar e depois criar cartões") continuam sem entender; falta conferir a lista de sugestões no teclado de um celular real.

### F1 — o que ficou
Materiais guardados no aparelho (Dexie v6: `materiais` + `trechos`, id pelo conteúdo, cascata ao apagar), índice MiniSearch em memória com radical Snowball português, ação **Perguntar ao meu material** (intenção `perguntar` no chat, resposta com trechos em destaque e fonte) e **Meus materiais** (guardar, listar, apagar); criar cartões de um resumo também o guarda. Medido: conjunto-ouro 100 % nos 3 primeiros (92,5 % em 1º); independente com 1.168 questões reais 97,2 % / 95,7 % sem acento / 93,2 % com erro de letra. Offline-first conferido de ponta a ponta (busca sem internet). Ver `docs/assistente.md`.

---

## Fontes
- Chatbots por regras: [Genesys — boas práticas](https://help.genesys.cloud/articles/best-practice-recommendations-for-building-bots-in-architect/), [Hubtype](https://www.hubtype.com/blog/chatbot-best-practices), [Progress](https://progress.com/blogs/best-practices-for-designing-a-conversational-chatbot-experience), [Rasa (Packt)](https://packt-plus-non-live.prod.packtpub.com/en-in/product/conversational-ai-with-rasa-9781801077057/chapter/chapter-1-introduction-to-chatbots-and-the-rasa-framework-2/section/chatbot-basics-ch02lvl1sec06)
- Paleta de comandos: [Superhuman](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/), [Cmd+K estilo Linear/Vercel](https://www.techinterview.org/post/3233475212/build-command-palette-cmd-k/)
- NLP.js: [AXA nlp.js (changelog)](https://github.com/axa-group/nlp.js/blob/master/CHANGELOG.md), [node-nlp](https://classic.yarnpkg.com/en/package/node-nlp)
- Flashcards por sintaxe: [Obsidian Spaced Repetition](https://github.com/st3v3nmw/obsidian-spaced-repetition), [cloze no plugin](https://open-spaced-repetition.github.io/obsidian-spaced-repetition-recall/flashcards/basic-cloze-cards), [RemNote — importar de texto](https://help.remnote.com/en/articles/9252072-how-to-import-flashcards-from-text)
- Qualidade de cartões: [SuperMemo — 20 regras](https://www.supermemo.com/en/archives1990-2015/articles/20rules)
- Distratores: [Quizlet — questões mais difíceis](https://medium.com/tech-quizlet/how-quizlet-creates-trickier-questions-313317a6f47f), [Andy Matuschak sobre o Quizlet](https://notes.andymatuschak.org/zPY3itD88kpA9AepbKQaKfG), [revisão sistemática PeerJ 2024](https://peerj.com/articles/cs-2441), [survey arXiv 2402.01512](https://arxiv.org/html/2402.01512v2)
- Palavras-chave: [YAKE! (INESC TEC)](https://www.inesctec.pt/en/technologies/yake), [artigo](https://paperswithcode.com/paper/yake-keyword-extraction-from-single-documents)
- Busca offline: [MiniSearch](https://www.github.com/lucaong/minisearch), [documento de design](https://github.com/lucaong/minisearch/blob/master/DESIGN_DOCUMENT.md)
- Stemmer: [Lucene PortugueseStemmer (RSLP)](https://lucene.apache.org/core/4_2_1/analyzers-common/org/apache/lucene/analysis/pt/PortugueseStemmer.html), [ptstem](https://dfalbel.github.io/ptstem/articles/ptstem.html)
- Repetição espaçada: [ts-fsrs](https://cdn.jsdelivr.net/npm/ts-fsrs@5.4.1/README.md), [FSRS vs SM-2](https://www.mindomax.com/fsrs-vs-sm2-spaced-repetition-algorithm)
- Concursos: [Simulado semanal QConcursos](https://folha.qconcursos.com/n/simulado-semanal-qconcursos), [revisar erros (QConcursos)](https://folha.qconcursos.com/n/como-revisar-questoes-erradas-concursos), [caderno de erros (Estratégia)](https://www.estrategiaconcursos.com.br/blog/caderno-de-erros-por-onde-comecar/amp/), [Gran — caderno de erros](https://blog.grancursosonline.com.br/caderno-de-erros-para-concurseiros-de-ti-como-transformar-cada-questao-errada-em-ponto-na-prova/)
- Embeddings no navegador: [bekko-embedding-v1-a8m](https://huggingface.co/hotchpotch/bekko-embedding-v1-a8m), [busca semântica com Transformers.js](https://machinelearningmastery.com/building-semantic-search-with-transformers-js-and-sentence-embeddings/)
