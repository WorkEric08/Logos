import { Capacitor } from '@capacitor/core'

/** Rodando dentro do APK (Capacitor)? No navegador/PWA é falso. Todo acesso nativo passa por services/native/, com alternativa web. */
export const ehNativo = () => Capacitor.isNativePlatform()
