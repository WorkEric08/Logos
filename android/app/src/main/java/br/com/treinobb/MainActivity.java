package br.com.treinobb;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Sem barras de rolagem em lugar nenhum: a barra nativa da WebView (a "barrinha cinza" ao rolar) o CSS não alcança.
        WebView web = getBridge().getWebView();
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        // Sem o efeito de "esticar"/brilho ao puxar além do topo ou do fim (Android 12+ estica a tela): o CSS (overscroll-behavior:none) cobre a página, isto cobre a WebView.
        web.setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);

        // O teclado digital só cobre a tela: nada se mexe, não encolhe, não sobe botão. O plugin SystemBars do Capacitor, quando o teclado
        // abre, soma a altura dele ao preenchimento da janela (a WebView encolheria e os botões do pé subiriam). Aqui o preenchimento
        // acompanha só as barras do sistema (status e navegação) e o teclado é ignorado. Sem viewport-fit=cover no APK (vite.config.ts)
        // o plugin também repassaria zeros ao CSS, igual a isto; se um dia usar viewport-fit=cover, rever este trecho.
        final int[] ultimoTeclado = { -1 };
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, insets) -> {
            int barras = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
            Insets b = insets.getInsets(barras);
            v.setPadding(b.left, b.top, b.right, b.bottom);
            // Quanto do teclado cobre a WebView (a altura dele menos a barra de navegação, que a WebView já não ocupa), em dp: vira --teclado no CSS,
            // que só aumenta o espaço de rolagem no fim da página para o campo de baixo poder subir acima do teclado (nada se mexe ao abrir).
            boolean aberto = insets.isVisible(WindowInsetsCompat.Type.ime());
            int cobre = aberto ? Math.max(0, insets.getInsets(WindowInsetsCompat.Type.ime()).bottom - b.bottom) : 0;
            int dp = Math.round(cobre / getResources().getDisplayMetrics().density);
            if (dp != ultimoTeclado[0]) {
                ultimoTeclado[0] = dp;
                web.evaluateJavascript("document.documentElement.style.setProperty('--teclado','" + dp + "px')", null);
            }
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(barras, Insets.NONE)
                .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
                .build();
        });
        getWindow().getDecorView().requestApplyInsets();
    }
}
