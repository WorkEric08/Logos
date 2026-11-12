# APK do Logos — como testar no celular

**Arquivo:** `apk/logos.apk` (gerado por `npm run apk`; ~49 MB, tudo dentro, funciona sem internet).

## Instalar
1. Passe o arquivo para o celular (cabo USB, Drive, WhatsApp para você mesmo…).
2. Abra o arquivo no celular. Se o Android perguntar, permita "instalar apps desconhecidos" para o app que você usou para abrir.
3. Toque em **Instalar** e depois em **Abrir**.

Com cabo e depuração USB: `adb install -r apk/logos.apk`.

## Atualizar (importante)
- **Instale a versão nova POR CIMA da antiga. Nunca desinstale**: desinstalar apaga o progresso.
- Isso funciona sempre, porque cada APK novo tem número de versão maior e a mesma assinatura (a chave está em `android/app/debug.keystore`; nunca troque nem apague).
- O app **não tem mais backup em arquivo** (saiu da tela Mais em 2026-11-09, porque a sincronização entre aparelhos virá por conta Google/Firebase). Até ela existir, o progresso fica só no aparelho: desinstalar ou limpar os dados do app apaga tudo.

## Progresso do navegador e do APK
O APK guarda os dados num lugar **separado** do navegador; hoje não há como levar o progresso de um para o outro (isso fica para a sincronização).

## Gerar um APK novo
`npm run apk` (precisa de JDK 17+ e do Android SDK; a 1ª vez baixa o Gradle). O resultado aparece em `apk/logos.apk` e o script confere assinatura e versão.

## O que ainda não foi visto num aparelho
Veja "O que não foi verificado" no README: este APK foi compilado e conferido por ferramentas e por uma simulação, mas ainda não foi aberto num celular de verdade.
