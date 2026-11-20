# Testes no aparelho real — APK 2.0.0 (2026-11-18)

Marque `[x]` ao passar. Se algo falhar, escreva ao lado a tela e os passos. As correções vêm de `RELATORIO.md` e `CORRECOES.md`.
Instalar: `adb install -r apk/logos.apk` ou copiar o arquivo para o celular. **Nunca desinstale** (apaga o progresso).

## 1. Atualização por cima (faça primeiro)
- [ ] Antes de instalar: anotar quantas questões já viu e quantos cartões tem (___ questões / ___ cartões).
- [ ] (Opcional) Mais > Cópia de segurança > salvar uma cópia antes.
- [ ] Instalar o APK novo por cima.
- [ ] Abrir: progresso, baralhos, cartões e anotações continuam iguais.

## 2. Botão voltar do Android
- [ ] Começar treino em **Treinar**, sair pelo voltar: cai em Treinar; o voltar seguinte vai ao Início. (F-02)
- [ ] Mesmo teste a partir do **Assistente** e de um **treino do plano**: volta à aba de origem.
- [ ] Treino iniciado no **Início**: volta ao Início.
- [ ] Assistente com pergunta de opções aberta: 1º voltar fecha só a pergunta; 2º sai da aba. (F-07)
- [ ] Painel do plano no assistente: o voltar fecha só o painel; o botão "Voltar" do painel também funciona. (C-7)
- [ ] Cards: "Novo baralho", "Renomear" e "Excluir este baralho" abertos: o voltar só cancela o formulário. (F-11)
- [ ] Revisão de um simulado: o voltar leva ao Resultado. (C-2)
- [ ] Tela inicial: o voltar pede "toque de novo para sair"; tocar de novo fecha.
- [ ] Toques rápidos nos ícones da barra: vale o último tocado. (C-3)

## 3. Simulado
- [ ] Responder poucas e tocar "Entregar prova": aparece "Entregar mesmo assim?" com a contagem em branco e "Voltar à prova" já selecionado. (F-04)
- [ ] O voltar do aparelho fecha só o aviso; a prova continua na mesma questão.
- [ ] Responder todas e entregar: entrega direto, sem aviso.
- [ ] Revisão do simulado entregue: questão em branco não aceita resposta e mostra "Em branco. Gabarito: X". (F-05)
- [ ] Revisão pelo cartão-resposta: o pé tem Anterior · Resultado · Próxima. (F-06)
- [ ] Simulado parcial do assistente não aparece em "Simulados" como "Não passou". (C-1)

## 4. Treino
- [ ] Resultado do treino: o botão é "Mais como este" e mantém a matéria. (F-01)
- [ ] "Rever erros" mostra "20 de N" quando há mais de 20. (F-08)
- [ ] Tocar numa matéria no Desempenho: o Treinar abre com a matéria marcada e "Começar" habilitado. (F-09)
- [ ] Espaço vazio: Início/Treinar/Desempenho mostram "Este espaço ainda não tem questões" e "Importar uma prova". (F-10)
- [ ] "Descartar" do treino do plano: mostra "Treino descartado." com Desfazer por 8 s.

## 5. Teclado real (nenhum botão pode subir acima dele)
Abrir o teclado em cada campo; a tela não rola sozinha e nada se mexe.
- [ ] Busca de questões
- [ ] Anotação de uma questão
- [ ] Novo baralho / Renomear
- [ ] Novo cartão (frente e verso)
- [ ] Nome do espaço de estudo
- [ ] Chave de IA
- [ ] Exceção correta: a caixa de mensagem do assistente sobe com o teclado, logo acima dele.
- [ ] Rolar a página com o teclado aberto alcança os botões do pé.

## 6. Cópia de segurança (C-8, F-15, F-17, F-18)
- [ ] Mais > Cópia de segurança: o texto diz o que o arquivo leva (e só fala em conta Google se estiver conectado).
- [ ] Salvar pela folha de compartilhar do Android (Drive, WhatsApp…): o arquivo é criado. **(só foi testado no navegador)**
- [ ] Restaurar no mesmo aparelho: diz "Nada novo", sem duplicar.
- [ ] Marcações e anotações das questões voltam.
- [ ] "Estudo restaurado." > Desfazer: tira só o que a cópia trouxe.
- [ ] Se tiver uma cópia antiga (versão 1): ainda restaura.
- [ ] Com muitos cartões (se tiver): salvar e restaurar sem travar.

## 7. Importar e desfazer (C-4, C-9, F-12, F-13)
- [ ] Assistente > importar uma prova em PDF pelo seletor de arquivos do Android.
- [ ] A prévia avisa quantas questões "já estão neste espaço"; voltar na prévia pergunta "Descartar esta prévia?".
- [ ] "Treinar agora" depois de importar abre filtrado pela prova nova.
- [ ] "Desfazer: importar a prova" volta ao número anterior de questões; progresso, baralhos e materiais ficam intactos.
- [ ] Gerar questões de um material e "Desfazer: adicionar as questões geradas": tira só as geradas.
- [ ] Depois de responder uma das questões novas, o desfazer recusa e manda apagar o espaço em "Meus espaços".

## 8. Lembrete diário (F-14)
- [ ] Programar o lembrete no assistente/Mais; aceitar permissão de notificação e de alarme exato se o Android pedir.
- [ ] A notificação chega no horário com o app fechado.
- [ ] Reiniciar o celular: o lembrete continua.

## 9. Visual e desempenho
- [ ] As 6 abas em tema claro e escuro: sem texto cortado nem rolagem lateral.
- [ ] Barras do sistema (gestos/3 botões) não escondem botões do pé.
- [ ] Abrir o app e trocar de aba sem travar; Cards com muitos cartões abre rápido.

## Não é defeito (decidido)
- Sair de um treino em andamento não retoma (F-03); as respostas já ficam salvas.
- Ao restaurar uma cópia, o gráfico do mês usa o maior número do dia, não a soma.
- Questões que a importação relê não voltam ao texto antigo ao desfazer.

## Anotações do teste
(escreva aqui o que falhou: tela, passos, aparelho/versão do Android)
