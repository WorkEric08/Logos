# Teste da sincronização com a conta Google REAL (checklist do dono)

Tudo o que a sincronização faz hoje (cartões, progresso, marcações, zerar/desfazer) e o que a F6 acrescenta (espaços, questões, materiais) foi testado só com **emuladores do Firebase** (`scripts/e2e-sync-emulador.mjs`, dois "aparelhos" falsos) e com nuvem de mentira nos testes. **Nada foi testado contra o projeto real `logos-f9d33`**: login do Google de verdade, regras publicadas e o APK só você consegue conferir. Este arquivo é o roteiro (cerca de 1 hora). Marque cada item; se algum falhar, **pare e me diga qual** (a F6.6 em diante só continua depois deste teste).

## Antes de começar
- Faça uma **cópia de segurança**: Mais › Cópia de segurança › Salvar cópia (agora leva também progresso, cartões e histórico). Guarde o arquivo no Drive.
- Tenha em mãos: o site publicado (Firebase Hosting), o celular com o APK e a conta Google que você usa no app.
- As regras novas do Firestore (F6.4) só valem depois de publicadas: `firebase deploy --only firestore:rules`. **Eu não publiquei nada.** Se você mandar, eu rodo; ou rode você, na pasta do projeto, depois de `firebase login`.

## Parte A — o que já existia (F6.0)
1. **Console do Firebase** › Authentication › Método de login › **Google ligado**; Settings › Domínios autorizados inclui o do Hosting (`logos-f9d33.web.app` e o `.firebaseapp.com`).
2. **Site**: abra o endereço do Hosting › Mais › Conta e sincronização › **Entrar com Google**. Deve mostrar seu e-mail e "Sincronizado." (sem "erro").
3. **APK**: entre com a **mesma** conta. O e-mail tem de ser o mesmo. (O SHA-1 do `debug.keystore` já está cadastrado; se aparecer "erro de configuração", é ele.)
4. **Cartões e progresso entre aparelhos**: crie um baralho com 2 cartões no site; no celular ele aparece em alguns segundos? Responda 3 questões no celular; o site mostra 3 questões vistas?
5. **Sem internet**: modo avião no celular, estude 2 cartões; ligue a internet: os dois chegam ao site?
6. **Console do Firestore**: existem `users/<seu uid>/eventos` e `itens`? Entre com **outra** conta Google no mesmo aparelho: o app tem de recusar ("Este aparelho já foi ligado a outra conta Google…").
7. **Zerar e desfazer**: Mais › Zerar tudo no site: o celular também zera? Desfazer no site: o celular volta?

## Parte B — espaços, provas e materiais (F6.1 a F6.5; só depois de eu avisar que estão no APK/site)
8. **Importar uma prova** no celular (Assistente › importar prova, num espaço seu): aparece no site, em Meus espaços, com as questões? (O primeiro envio mostra um aviso "O que sobe para a sua conta" com **Manter só aqui**: leia e escolha.)
9. **Material**: guarde um resumo no site (Assistente › Meus materiais); no celular pergunte "o que é …?" sobre ele: responde?
10. **Apagar o espaço** no site (pergunta no meio da tela): some no celular? As respostas que você já deu continuam contando (Desempenho)?
11. **Desfazer a importação** (pílula "Desfazer: importar a prova") no celular: some no site?
12. **O teste que você pediu — aparelho novo**: limpe os dados do app (ou reinstale) no celular e entre de novo com a conta: voltam o progresso, os cartões, os espaços, as questões importadas e os materiais? Em Mais › Conta e sincronização, a barra "Espaços e materiais: X de Y pacotes" chega ao fim?
13. **Modo avião**: com tudo baixado, os espaços e a busca funcionam sem internet?
14. **Dados móveis**: com o interruptor "Usar dados móveis para imagens" desligado, no 4G o texto baixa mas as imagens esperam o Wi-Fi (as imagens são a F6.6, ainda não).
15. **Atualizar o APK por cima** (sem desinstalar): espaços, questões, imagens e materiais continuam iguais? (A versão 8 do banco local é a migração mais delicada: por isso a cópia de segurança do começo.)

## O que o Firebase mostra (para conferir que não estourou a cota)
Console › Firestore › Uso: leituras/dia abaixo de 50.000, escritas/dia abaixo de 20.000, armazenamento abaixo de 1 GiB. O plano é o grátis (Spark): passar da cota só faz a operação falhar, nunca cobra.

## Se algo der errado
- Não apague nada no console. Mande o texto do erro de Mais › Conta e sincronização e o passo em que parou.
- Sair da conta (Mais › Conta e sincronização) não apaga nada do aparelho.
- Para voltar ao estado de antes: restaure a cópia de segurança (Mais › Cópia de segurança › Restaurar; só acrescenta).
