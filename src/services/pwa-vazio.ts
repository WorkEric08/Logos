// No APK não há service worker: o app já está em disco, e um SW só guardaria uma segunda cópia (e arriscaria servir a versão velha).
// O build do Android troca `virtual:pwa-register` por este arquivo (ver vite.config.ts).
export function registerSW(): () => Promise<void> { return async () => {} }
