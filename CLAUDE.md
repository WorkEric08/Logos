# Logos — contexto para a IDE

> O app se chama **Logos** (antes "Treino BB", renomeado em 2026-11-12). Por compatibilidade, **não mudam**: o banco do IndexedDB `treino-bb`, o `appId`/pacote Android `br.com.treinobb` e as chaves de `localStorage`; mudar qualquer um apagaria o progresso ou criaria outro app no celular.

App pessoal (PWA, React + TypeScript + Vite, offline). Treina com 1.168 questões Cesgranrio (BB, Caixa, BNB, Banco da Amazônia e Banese) em `src/data/bank.json`, gerado por `scripts/importar-banco.mjs` a partir de `banco/`. Leia o `README.md` (regras para não regredir: peso do sorteio, simulado, botão voltar, temas, sem alert/confirm). O dono prefere respostas curtas, simples e em português.

## REGRA DO TECLADO DIGITAL (obrigatória, vale para todo o app)
O teclado do celular **só cobre a tela**. **Nenhum botão de ação pode aparecer acima do teclado** se a camada de conteúdo dele fica por baixo: botões do pé (`.foot.sticky`, `.side.go`, Anterior/Próxima, Salvar…) ficam onde estão, por baixo do teclado; só aparecem se a pessoa **rolar a página** ou **fechar o teclado**. Nada se mexe, não encolhe e a página não rola sozinha ao abrir. O que ficou atrás do teclado é alcançado rolando (a altura do teclado entra como `--teclado` e vira um espaçador **no fim do conteúdo**: `.scroll-y::after`; **nunca** `padding-bottom` no `.scroll-y`, porque o `position:sticky` respeita o padding e sobe os botões para cima do teclado: foi o bug de 2026-11-10).
- **Sempre que eu pedir algo que mexa em tela, rodapé, botão ou campo de texto**: rodar `node scripts/e2e-teclado.mjs` (celulares 412×880 com teclado de 414 px — o do print do usuário —, 360×780, 390×844 e 320×568, **em todos os campos de texto**) além do resto do `npm run verificar`.
- **Campo de texto novo** (`<input>`/`<textarea>`): registrar em `scripts/campos-de-texto.json` e criar o cenário em `scripts/e2e-teclado.mjs` (o teste `src/teclado-campos.test.ts` falha sem isso).
- Não usar `adjustResize`, `resizes-content`, `autoFocus` (rola a tela) nem esconder/mostrar botões com o teclado (`data-kb-hide` foi removido). Detalhes e histórico: README, seção "Teclado".

## Assistente e espaços de estudo (2026-11-12)
O app tem um **assistente** (aba própria com ícone de conversa; chat com balões e sugestões em pílulas, ações fixas, sem IA; IA opcional com a chave da própria pessoa) que importa provas e resumos em PDF para **espaços de estudo**. O BB é o espaço embutido. Leia `docs/assistente.md` antes de mexer em `core/importar/`, `store/espacos.ts` ou no assistente. Mexeu no leitor de PDF? Rode `node scripts/medir-extracao.mjs` (precisa dos PDFs em `~/Documents/Banco de questões Bancos Cesgranrio`) e não piore os números. Campos de texto do assistente: `#as-espaco`, `#as-prova`, `#as-baralho`, `#as-chave` (já na lista e no e2e de teclado).

## Banco de questões (pasta `banco/` → `src/data/bank.json`)
O banco novo **já está ligado ao app** (2026-11-06; detalhes no README, seção "Banco novo Cesgranrio"). `banco/*.json` é a fonte; `node scripts/importar-banco.mjs` regenera `src/data/bank.json` e `id-map.json`; as imagens ficam em `public/q/` e carregam sob demanda. Formato dos campos em `banco/LEIA-ME.md`. Não apague nem substitua `src/data/bank.json` sem perguntar.
- Questão com `imagem`: **a imagem é a fonte da verdade** (o texto pode ter perdido fórmula, tabela ou figura).
- `status: "anulada"` (gabarito null): não mostrar nem sortear.
- Gabarito é só do caderno 1 (o do PDF).
