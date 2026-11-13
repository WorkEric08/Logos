# Assistente (pseudo-agente) — documentação

Um chat com **ações fixas**, sem IA. A pessoa escolhe o que quer fazer; o assistente pede os arquivos, lê tudo **no aparelho** (nada sai de lá), mostra uma **prévia** e só grava o que a pessoa confirmar. A IA é um **extra opcional** (ver "Ajuda de IA").

Onde mora o quê:

| Parte | Arquivo |
|---|---|
| Catálogo das ações (esta documentação nasce dele) | `src/core/assistente.ts` |
| Estado da conversa e fluxo de cada ação | `src/store/assistente.ts` |
| Tela | `src/ui/Assistente.tsx`, `src/ui/AssistenteIA.tsx` |
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

### Montar um simulado (`simulado`)
Espaço com regras de edital (BB): o simulado do edital. Os outros: escolher matéria e quantidade (10–40); sorteia pelo mesmo peso do treino.

### Escolher ou criar um espaço (`espaco`)
Ativar, criar (vazio ou com as questões do BB) e apagar (em dois toques; o espaço do BB não se apaga).

### Ver o que eu já tenho (`resumo`)
Quantas questões, matérias e provas o espaço ativo tem.

### Ajuda de IA — opcional (`ia`)
Desligada por padrão. Com a **chave da Anthropic da própria pessoa** (guardada só neste aparelho, em `localStorage.logos_ia_chave`; nunca vai para a nuvem do Logos nem para backup), as questões **com aviso** ganham "Reler com IA": o recorte da página + o texto lido vão para `api.anthropic.com` (SDK oficial, `dangerouslyAllowBrowser`, modelo à escolha, padrão `claude-opus-5-5`, saída estruturada em JSON, `fallbacks: "default"`). A IA só **transcreve** (não resolve nem mexe no gabarito); a sugestão aparece para conferir e só entra em "Usar a sugestão". Testar a chave só conta tokens (não gasta). Cobrança: conta da API (console.anthropic.com), separada da assinatura do Claude.

## Como acrescentar uma ação ou um formato de prova

1. **Ação:** acrescente em `ACOES` (`src/core/assistente.ts`), o fluxo em `src/store/assistente.ts`, a tela em `src/ui/Assistente.tsx` e uma seção aqui (o teste `src/core/assistente.test.ts` falha se faltar).
2. **Campo de texto novo:** registre em `scripts/campos-de-texto.json` e crie o cenário em `scripts/e2e-teclado.mjs` (regra do teclado).
3. **Formato de prova novo:** ajuste `src/core/importar/prova.ts`/`layout.ts` e **meça** com `scripts/medir-extracao.mjs` (não deve piorar os números acima); acrescente um caso em `src/core/importar/importar.test.ts`.

## Não verificado
Aparelho real (Android): o seletor de arquivos e o recorte de imagem rodam no navegador (Chrome, testado); no APK dependem da WebView e do seletor do sistema. A leitura de PDFs muito diferentes das provas da Cesgranrio (outras bancas) não foi medida.
