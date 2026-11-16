# Assistente (pseudo-agente) — documentação

Uma **aba própria** (ícone de conversa na barra de navegação, entre Cards e Desempenho) com um **chat** de ações fixas, sem IA. A pessoa toca numa **sugestão** (pílulas no fim da conversa, como as respostas rápidas de um chat) e a fala dela aparece em um balão; o assistente responde em balões e, quando precisa de arquivos ou de um nome, mostra isso **dentro da conversa**. A pessoa também pode **escrever** o pedido numa caixa de mensagem ("importar prova"): o assistente entende palavras-chave, aceita um erro de digitação e pergunta quando o pedido pode ser duas coisas. A conversa fica na memória (trocar de aba não a perde; recarregar o app sim). **Como a troca acontece e o movimento de cada momento: `docs/assistente-conversa.md`.**

O assistente o assistente pede os arquivos, lê tudo **no aparelho** (nada sai de lá), mostra uma **prévia** e só grava o que a pessoa confirmar. A IA é um **extra opcional** (ver "Ajuda de IA").

Onde mora o quê:

| Parte | Arquivo |
|---|---|
| Catálogo das ações (esta documentação nasce dele) | `src/core/assistente.ts` |
| Entender o que a pessoa escreve | `src/core/conversa.ts` |
| Ritmo da conversa (digitando, contagem, saída) | `src/core/ritmo.ts`, `src/ui/movimentoChat.tsx` |
| Estado da conversa e fluxo de cada ação | `src/store/assistente.ts` |
| Tela (aba Assistente) | `src/ui/Assistente.tsx`, `src/ui/AssistenteIA.tsx` |
| Espaços de estudo | `src/core/espaco.ts`, `src/store/espacos.ts` |
| Leitura de PDF (regras) | `src/core/importar/` (`layout`, `prova`, `gabarito`, `montar`, `cartoes`, `ia`) |
| Leitura de PDF no navegador | `src/services/importar/` (`pdf`, `pdfjs`, `recorte`, `arquivos`, `ia`) |
| Medir o leitor contra as suas provas | `scripts/medir-extracao.mjs` |
| Teste de ponta a ponta | `scripts/e2e-assistente.mjs` |

## Espaço de estudo

Um **espaço** reúne as questões, as matérias (com peso no sorteio), as provas, os bancos e, se houver, as regras do simulado de um assunto. O Banco do Brasil vem **embutido** e é o espaço padrão (com as regras do edital 2022/001). Os outros a pessoa cria e enche importando arquivos.

- Trocar de espaço reatribui o que o app lê (`definirBanco`, `definirMaterias`, `definirRegras`, `definirBancos`) e sobe `useApp.versao`, que recomeça as telas.
- O progresso é guardado **por questão** (id), não por espaço: trocar ou apagar um espaço não apaga o progresso.
- O id de uma questão importada é calculado **pelo conteúdo** (`idPorConteudo`): importar o mesmo arquivo de novo dá os mesmos ids (não duplica) e recupera o progresso. Corrigir o texto com a IA **não** troca o id (`idOrigem`).
- O espaço do BB **não recebe arquivos**. Para somar provas ao BB, crie um espaço "com as questões do BB": as embutidas + as suas.
- Espaço sem regras de edital faz simulado simples (matéria e quantidade à escolha; nota = acertos; "passou" = metade ou mais).
- Dados no aparelho: IndexedDB `treino-bb` (nome nunca muda), versão 5: tabelas `espacos`, `questoes` (índice por espaço) e `imagens` (recortes de PDF). **A conta Google ainda não sincroniza espaços nem imagens importadas** (só progresso, cartões, marcações e ajustes).

## Ações

### Importar uma prova em PDF (`prova`)
- **Preciso de:** o PDF da prova (com texto, não foto); o PDF do gabarito é opcional.
- **Fluxo:** (se o BB está ativo, pede para criar um espaço) → escolher os dois PDFs → "Ler a prova" → **prévia** (nome da prova, imagem das questões, cada questão com gabarito A–E editável, aviso e caixa para incluir) → "Adicionar N".
- **O que o leitor faz:** separa as duas colunas e as faixas largas (tabelas), corta cabeçalho e rodapé, acha as questões (número sozinho na linha, na margem, seguido de `(A)` antes de outro número), lê as alternativas `(A)`–`(E)` (inclusive as que vêm na mesma linha), junta hifenização, reconhece matéria (título em maiúsculas) e bloco, separa texto-base ("questões 1 a 3"), lê o gabarito (`1 - C`, `ANULADA`, vários cadernos → o 1º) e recorta a imagem das questões com figura/tabela.
- **Nunca entra:** questão sem gabarito, anulada, com menos de 2 alternativas ou cujo gabarito aponta uma letra que não foi lida. A prévia mostra o motivo.
- **Limites:** PDF escaneado (só imagem) não é lido sem IA; formato muito diferente do das provas de concurso (número da questão fora da margem, alternativas sem parênteses) pode falhar e vira aviso, nunca resposta inventada.

**Medição real** (`node scripts/medir-extracao.mjs`, 20 provas e 1.163 questões já revisadas do `banco/`): questões encontradas **99,2%**; com 5 alternativas **99,0%**; alternativas iguais às do banco **95,4%**; enunciado igual **98,4%**; gabarito certo em **100% dos gabaritos que são texto** (950 de 950; o gabarito do BB 2012 é imagem e fica sem resposta).

### Criar cartões de um resumo (`cartoes`)
- **Preciso de:** PDF com texto, `.txt` ou `.md`.
- **Reconhece:** `Termo: definição`, `Termo – definição`, `P: … R: …`, `X é …` ("O que é X?"), `# Título` + parágrafo e trecho em `**negrito**` (vira lacuna `_____`). Sem repetir a frente, frente ≤ 300 e verso ≤ 1.200 caracteres, no máximo 300 cartões.
- **Fluxo:** escolher o arquivo → prévia (nome do baralho e caixa por cartão) → "Criar o baralho". O assistente diz quantos parágrafos ficaram de fora.

### Montar um simulado (`simulado`) — pedido com detalhes (F2)
Pode ser pedido inteiro ("simulado de matemática com 20 questões", "simulado com 20 questões da prova do bb 2018") ou aos poucos: o que a pessoa **não disse** o assistente pergunta, com opções para tocar (ou escrever a resposta). Sem nada dito: "Qual simulado? O do edital (com nota e regras) ou de uma matéria?" (a opção do edital só existe em espaço com regras e só se a quantidade não foi dita: o do edital tem 70 questões). Com a matéria e sem a quantidade: "Quantas questões?" (10, 20, 30, 40, ou escrever). O simulado do edital é o de sempre (nota, regras, cronômetro); o de matéria/prova é um simulado com cronômetro escondido e resultado, sorteado pelo mesmo peso do treino (`pick`). Se o espaço tem menos questões do que o pedido, o assistente diz ("só tenho 12 questões disso") e monta com todas.

### Treinar questões (`treinar`) — F2
Treino com correção na hora. "Treinar" sozinho pergunta a matéria ("ou 'todas' para um treino misto"); com a matéria, a prova ou a quantidade já ditas não pergunta mais nada e usa **10 questões** quando a quantidade falta. Exemplos: "treinar 15 de matemática", "treinar a prova do BB 2021", "treinar essa prova" (a última importada na conversa), "fazer a prova da caixa 2024". Limite: só sorteia entre as questões do espaço ativo; pedido sem questões (matéria sem nenhuma, prova que não existe) responde com erro e saída.

### Perguntar ao meu material (`perguntar`) — F1 do plano do agente offline
- **Como pergunta:** tocando na sugestão ou escrevendo ("o que é Copom?", "onde fala de inflação", "juros compostos", "procure consignado"). Texto que não é um comando mas é o nome de algo que você guardou também é respondido (como a busca de uma paleta de comandos).
- **O que responde:** até 3 resultados dentro do balão, cada um com o tipo (Material, Questão ou Cartão), a **fonte** ("Resumo de juros · trecho 12 de 40") e o trecho com a palavra em **destaque**. "Parte da pergunta" quando nenhum trecho tem todas as palavras. Sem resultado, diz que não achou e o que fazer.
- **Onde procura:** nos trechos dos seus materiais, nas questões do espaço e nos seus cartões. Material pesa mais que cartão e cartão mais que questão ("o que é X?" quer a explicação antes do exercício).
- **Como funciona (sem IA):** cada palavra vira um **radical** (Snowball português + "-ões/-ães" + palavra sem acento: "inflação", "inflações" e "inflacao" se encontram) e a busca é do MiniSearch, em memória, com prefixo, erro de digitação em palavras de 6+ letras e ranking BM25. Procura por **palavras, não por significado**.
- **Medido:** conjunto-ouro do plano (36 trechos, 40 perguntas): resposta certa nos 3 primeiros em **100 %** e em 1º em 92,5 %. Medição independente com as 1.168 questões reais do banco como material (`node scripts/medir-busca.mjs`, 400 perguntas de 3 palavras do enunciado): **97,2 %** nos 3 primeiros como está, 95,7 % sem acento, 93,2 % com uma troca de letras, 92,2 % sem acento e com troca (os erros são sobretudo perguntas genéricas demais, como "financeiro atividades"). Índice de 1.168 questões em ~200 ms, busca em ~1 ms; 20 mil trechos dentro do orçamento (teste).

### Meus materiais (`materiais`) — F1 do plano do agente offline
- **Guardar:** PDF com texto, TXT ou MD (pelo painel, ou ao **criar cartões de um resumo**, que também o guarda). O texto vira **trechos** de até 700 letras (parágrafo grande é partido nas frases). Qualquer espaço pode ter materiais, inclusive o do Banco do Brasil.
- **Listar e apagar:** o painel mostra nome, trechos, tamanho e data; apagar leva o material e **todos** os trechos dele (em dois toques) e não toca em questões nem cartões.
- **Limites:** 4 milhões de letras e 20 mil trechos por material; PDF escaneado não é lido (não há OCR) e a conversa explica.
- **Dados** (decisões de arquitetura, Dexie **v6**, só acrescenta): `materiais` (um por arquivo: id, espaço, nome, tipo, data, nº de trechos e de letras) e `trechos` (id `<material>:<n>`, material, espaço, texto), em tabelas separadas (leitura por espaço, apagar em cascata, sincronização futura por trecho). O **id vem do conteúdo** (+ espaço): guardar o mesmo texto de novo não duplica (a conversa avisa). Apagar um espaço apaga os materiais dele. O **índice de busca não é guardado**: é derivado, refeito em memória quando algo muda (outro espaço, material novo/apagado, mais questões ou cartões) e barato de refazer (medido); se um dia estourar o orçamento, a saída é guardar o índice serializado com a versão dos dados. **Fica só no aparelho** (ainda não sincroniza pela conta; ver Não verificado).

### Escolher ou criar um espaço (`espaco`)
Ativar, criar (vazio ou com as questões do BB) e apagar (em dois toques; o espaço do BB não se apaga).

### Ver o que eu já tenho (`resumo`)
Quantas questões, matérias e provas o espaço ativo tem.

### Ajuda de IA — opcional (`ia`)
Desligada por padrão. Com a **chave da Anthropic da própria pessoa** (guardada só neste aparelho, em `localStorage.logos_ia_chave`; nunca vai para a nuvem do Logos nem para backup), as questões **com aviso** ganham "Reler com IA": o recorte da página + o texto lido vão para `api.anthropic.com` (SDK oficial, `dangerouslyAllowBrowser`, modelo à escolha, padrão `claude-opus-5-5`, saída estruturada em JSON, `fallbacks: "default"`). A IA só **transcreve** (não resolve nem mexe no gabarito); a sugestão aparece para conferir e só entra em "Usar a sugestão". Testar a chave só conta tokens (não gasta). Cobrança: conta da API (console.anthropic.com), separada da assinatura do Claude.

## Como acrescentar uma ação ou um formato de prova

1. **Ação:** acrescente em `ACOES` (`src/core/assistente.ts`, com o `sugestao` curto que aparece na pílula), o fluxo em `src/store/assistente.ts`, a tela em `src/ui/Assistente.tsx` e uma seção aqui (o teste `src/core/assistente.test.ts` falha se faltar).
2. **Campo de texto novo:** registre em `scripts/campos-de-texto.json` e crie o cenário em `scripts/e2e-teclado.mjs` (regra do teclado).
3. **Formato de prova novo:** ajuste `src/core/importar/prova.ts`/`layout.ts` e **meça** com `scripts/medir-extracao.mjs` (não deve piorar os números acima); acrescente um caso em `src/core/importar/importar.test.ts`.

## Diálogo com detalhes, contexto e memória (F2)
Camada nova **pura**, em `src/core/dialogo/` (sem DOM, banco nem estado): `entidades.ts` (o que a fala traz além do pedido), `dialogo.ts` (o motor de "perguntar o que falta") e `digitando.ts` (sugestões enquanto se digita). O store (`store/assistente.ts`) só liga isso às telas.

- **Entidades** (`extrairEntidades(fala, contexto)`): matéria (compara pelo **radical** das palavras com as matérias do espaço: palavra que só existe numa matéria já basta, "financeiro" repartido só junto com as outras), quantidade ("20 questões", "de 15", "vinte questões"; ignora ano, "questão 12", "lei 8"), prova ("bb 2021", "caixa rs 2024", "bb 10/2015"; o nome do banco **e** o ano têm de aparecer; prova de TI só se a pessoa disser "TI" ou "tecnologia"; "bb 2015" vale as duas de 2015), "essa prova" (a última importada), "todas as matérias", "hoje/semana" (reservado para o painel do dia da F6), espaço pelo nome e nome de um espaço novo ("criar espaço Direito Civil"). O **contexto** vem do espaço ativo (`Contexto`): matérias que têm questões, provas, espaços, se há regras de edital e a última prova importada.
- **Motor** (`proximoPasso(pedido, contexto)`): ou EXECUTA ou PERGUNTA o que falta (`matéria` e depois `quantidade`), nunca repete o que já foi dito. Enquanto uma pergunta está aberta (`etapa: 'pergunta'`) o texto escrito é lido como resposta (`entenderResposta`); se não faz sentido, repete a pergunta; se é outro pedido ("criar cartões"), troca de assunto; "cancelar" desiste. Ajuste de intenção (`ajustarPelasEntidades`): "treinar a prova do BB 2021" é treino (não importar prova) e uma dúvida entre ações que leva detalhes vira simulado/treino; "importar a prova do BB 2021" continua importando.
- **Mais comandos por escrito**: "quantas questões de matemática tenho?", "quantas tem a prova do BB 2021?" (contagem com detalhe), "trocar para o espaço Direito Penal", "criar espaço Direito Civil" (cria vazio e se pode desfazer), "desfazer", "limpar conversa".
- **Sugestões ao digitar** (`sugerirDigitando`): a partir de 2 letras as pílulas se filtram pelas palavras-chave das ações ("simu" → Montar um simulado); texto que não combina bem com nenhuma ação oferece **"Procurar “…” no meu material"**. Nada some: apagar o texto devolve a lista de sempre.
- **Desfazer**: só **a última coisa** que o assistente fez por você, guardada na memória (não sobrevive a fechar o app): criar espaço (apaga o criado e volta ao de antes), guardar material, apagar material (devolve com os trechos), criar cartões (tira os cartões, e o baralho se foi criado agora). A sugestão "Desfazer: …" aparece nos menus; escrever "desfazer" vale o mesmo. **Não** se desfaz: importar prova (as respostas por questão já podem ter sido registradas; para tirar, apague o espaço).
- **Histórico**: cada fala é guardada no aparelho (Dexie **v7**, tabela `conversa`, só acrescenta; as últimas **300**, as mais antigas saem sozinhas). Ao reabrir o app a conversa volta **de uma vez** (sem "digitando…" nem entrada animada). "Limpar a conversa" (sugestão quando passa de 12 falas, ou escrevendo) pede confirmação e apaga **só o histórico daqui**: materiais, questões e cartões não são tocados.
- **Ordem das gravações**: as gravações do histórico entram numa fila (uma por vez, em ordem), senão apagar a conversa podia passar na frente de uma fala ainda sendo gravada (visto no teste).
- **Medido**: `src/core/dialogo/corpus.test.ts` (87 frases reais com ação, detalhes e o que falta perguntar) e `dialogo.test.ts` (77 casos: matéria, quantidade, provas, motor e sugestões); `scripts/e2e-assistente-dialogo.mjs` no navegador. **Regra:** mexeu em `conversa.ts` ou `entidades.ts`? Rode `npx vitest run src/core/dialogo` e não piore nenhuma frase.

## Caixa de mensagem e a regra do teclado
A caixa de mensagem existe e obedece à regra do teclado: fica logo abaixo da última fala (nunca presa no pé da tela). Detalhes em `docs/assistente-conversa.md`.

## Não verificado
F2: as sugestões enquanto se digita foram conferidas no navegador do computador (Chrome); no teclado do celular real falta ver (a lista aparece logo abaixo da caixa, que fica no alto da tela, então deve ficar acima do teclado). O entendimento de frases foi medido com as frases do conjunto de teste, escritas por mim: frases suas que não forem entendidas valem ouro para ampliá-lo.
Os materiais guardados e o índice de busca ficam só no aparelho (não sincronizam pela conta Google; mesma limitação dos espaços). A busca foi medida com texto do banco e um resumo escrito para o teste, **não** com os seus resumos reais: junte alguns e rode a medição (ver F1 do plano).
Aparelho real (Android): o seletor de arquivos e o recorte de imagem rodam no navegador (Chrome, testado); no APK dependem da WebView e do seletor do sistema. A leitura de PDFs muito diferentes das provas da Cesgranrio (outras bancas) não foi medida.
