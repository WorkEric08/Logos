import type { CapacitorConfig } from '@capacitor/cli'

// appId e o nome do banco do navegador ("treino-bb") NUNCA mudam: o Android trataria outro id como outro app e outro nome de banco
// abriria um IndexedDB vazio. Renomear o produto é só texto de tela, manifest e strings.xml.
const config: CapacitorConfig = {
  appId: 'br.com.treinobb',
  appName: 'Logos',
  webDir: 'dist-android',
  backgroundColor: '#000000',
  android: { backgroundColor: '#000000' },
  plugins: {
    // Barras do sistema pretas com ícones claros, em qualquer tema do app; a WebView recua pelas barras (sem viewport-fit=cover no APK).
    SystemBars: { style: 'DARK', insetsHandling: 'css' },
  },
}
export default config
