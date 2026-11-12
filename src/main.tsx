import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/newsreader/latin-400.css'
import '@fontsource/newsreader/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { ligarTeclado } from './services/teclado'
import { ligarPainel } from './services/painel'
import { App } from './ui/App'
import './ui/styles.css'

registerSW({ immediate: true })
ligarTeclado()
ligarPainel()
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
