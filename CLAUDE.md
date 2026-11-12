# Logos — contexto para a IDE

> O app se chama **Logos** (antes "Treino BB", renomeado em 2026-11-12). Por compatibilidade, **não mudam**: o banco do IndexedDB `treino-bb`, o `appId`/pacote Android `br.com.treinobb` e as chaves de `localStorage`; mudar qualquer um apagaria o progresso ou criaria outro app no celular.

App pessoal (PWA, React + TypeScript + Vite, offline). Hoje treina com 478 questões do Banco do Brasil em `src/data/bank.json`. Leia o `README.md` (regras para não regredir: peso do sorteio, simulado, botão voltar, temas, sem alert/confirm). O dono prefere respostas curtas, simples e em português.

## REGRA DO TECLADO DIGITAL (obrigatória, vale para todo o app)
O teclado do celular **só cobre a tela**. **Nenhum botão de ação pode aparecer acima do teclado** se a camada de conteúdo dele fica por baixo: botões do pé (`.foot.sticky`, `.side.go`, Anterior/Próxima, Salvar…) ficam onde estão, por baixo do teclado; só aparecem se a pessoa **rolar a página** ou **fechar o teclado**. Nada se mexe, não encolhe e a página não rola sozinha ao abrir. O que ficou atrás do teclado é alcançado rolando (a altura do teclado entra como `--teclado` e vira um espaçador **no fim do conteúdo**: `.scroll-y::after`; **nunca** `padding-bottom` no `.scroll-y`, porque o `position:sticky` respeita o padding e sobe os botões para cima do teclado: foi o bug de 2026-11-10).
- **Sempre que eu pedir algo que mexa em tela, rodapé, botão ou campo de texto**: rodar `node scripts/e2e-teclado.mjs` (celulares 412×880 com teclado de 414 px — o do print do usuário —, 360×780, 390×844 e 320×568, **em todos os campos de texto**) além do resto do `npm run verificar`.
- **Campo de texto novo** (`<input>`/`<textarea>`): registrar em `scripts/campos-de-texto.json` e criar o cenário em `scripts/e2e-teclado.mjs` (o teste `src/teclado-campos.test.ts` falha sem isso).
- Não usar `adjustResize`, `resizes-content`, `autoFocus` (rola a tela) nem esconder/mostrar botões com o teclado (`data-kb-hide` foi removido). Detalhes e histórico: README, seção "Teclado".

## Banco novo de questões Cesgranrio (pasta `banco/`)
Foi preparado à parte, para Agente Comercial, com BB, Caixa, BNB, Banco da Amazônia e Banese (1.163 questões; 1.158 válidas e 5 anuladas). **Ainda não está ligado ao app.** Não apague nem substitua `src/data/bank.json` sem perguntar.

- `banco/*.json`: um arquivo por grupo de matérias (`agente_comercial_*.json`). Formato dos campos em `banco/LEIA-ME.md`.
- `banco/imagens/<id>.png`: imagem da questão. Quando o campo `imagem` não é null, **a imagem é a fonte da verdade** (o texto pode ter perdido fórmula, tabela ou figura). Estatística e Matemática usam imagem em quase todas.
- `status: "anulada"` (gabarito null): não mostrar nem sortear.
- `cargoOrigem: "TI"`: questão de prova de TI reaproveitada porque o conteúdo serve ao Agente Comercial.
- `revisar`: avisos de extração. Mostrar a imagem quando houver.
- Gabarito é só do caderno 1 (o do PDF). Gabarito do BB 2012 foi lido de imagem.
- Algumas questões se repetem entre provas (a banca reaproveita). Se atrapalhar o sorteio, deduplicar pelo enunciado.

## Primeiro passo sugerido
1. Comparar o formato de `src/data/bank.json` (`core/types.ts`: Question) com o do `banco/`.
2. Escrever `scripts/importar-banco.mjs` que converte o `banco/` para o formato do app, sem mexer no que já existe.
3. Ampliar `core/subjects.ts` e `SOURCES` para os novos bancos e matérias, mantendo o banco `treino-bb` do IndexedDB (nome nunca muda; não perder o progresso).
4. Mostrar `imagem` na tela da questão; carregar as imagens sob demanda (são ~400 PNG, cerca de 30 MB) para não pesar no PWA.
5. Rodar `npm test` e `npm run build` antes de dizer que está pronto.
