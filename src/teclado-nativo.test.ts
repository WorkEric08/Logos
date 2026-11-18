import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// O teclado digital só COBRE a tela: a janela não encolhe, nada sobe e nenhum botão some ou pisca. Isto vive em três lugares
// (manifest, tratamento das barras no MainActivity e meta viewport) mais a ausência do mecanismo antigo; este teste trava os quatro.
const ler = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

function arquivos(dir: string, ext: RegExp, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n)
    if (statSync(f).isDirectory()) arquivos(f, ext, acc)
    else if (ext.test(n)) acc.push(f)
  }
  return acc
}

describe('teclado digital só cobre a tela', () => {
  it('o Android não encolhe nem desloca a janela (windowSoftInputMode=adjustNothing)', () => {
    expect(ler('android', 'app', 'src', 'main', 'AndroidManifest.xml')).toMatch(/android:windowSoftInputMode="adjustNothing"/)
  })

  it('o MainActivity não soma a altura do teclado ao preenchimento da janela (o plugin SystemBars faria isso)', () => {
    const java = ler('android', 'app', 'src', 'main', 'java', 'br', 'com', 'treinobb', 'MainActivity.java')
    expect(java).toMatch(/setOnApplyWindowInsetsListener\(getWindow\(\)\.getDecorView\(\)/)
    expect(java).toMatch(/setInsets\(WindowInsetsCompat\.Type\.ime\(\), Insets\.NONE\)/)
    expect(java).toMatch(/v\.setPadding\(b\.left, b\.top, b\.right, b\.bottom\)/) // o preenchimento da janela é só das barras do sistema, nunca do teclado
    expect(java).toMatch(/--teclado/) // a altura do teclado só vai para o CSS (espaço de rolagem), ver services/teclado.ts
  })

  it('no navegador a página não é redimensionada pelo teclado (interactive-widget=overlays-content)', () => {
    const html = ler('index.html')
    expect(html).toMatch(/interactive-widget=overlays-content/)
    expect(html).not.toMatch(/resizes-content|resizes-visual/)
  })

  it('o espaço do teclado é um espaçador no FIM do conteúdo, nunca padding do contêiner de rolagem (o position:sticky respeita o padding e sobe os botões para cima do teclado)', () => {
    const css = ler('src', 'ui', 'styles.css')
    expect(css).toContain('.scroll-y::after{content:"";display:block;height:0}')
    // a altura só vale com um campo de texto em foco: um --teclado velho não pode deixar um vazio rolável no fim da tela (2026-11-17)
    expect(css).toContain(':root:has(input:focus,textarea:focus,select:focus,[contenteditable]:focus) .scroll-y::after{height:var(--teclado,0px)}')
    expect(css).not.toMatch(/padding-bottom:\s*var\(--teclado/)
  })

  it('o mecanismo antigo de esconder botões com o teclado não existe mais', () => {
    const fontes = arquivos('src', /\.(tsx?|css)$/).filter((f) => !/teclado-nativo\.test\.ts$/.test(f))
    for (const f of fontes) {
      const t = readFileSync(f, 'utf8')
      expect(t, f).not.toMatch(/data-kb-hide|html\.kb-open|kb-returning|bindKeyboardFlag/)
    }
  })
})
