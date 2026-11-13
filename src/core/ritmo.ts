// O ritmo da conversa do assistente: quanto tempo o "digitando…" dura antes de cada fala e como um número sobe contando. Puro (sem relógio nem DOM):
// quem usa (ui/Assistente.tsx) cuida dos temporizadores e de "reduzir movimento". As durações das saídas ficam aqui para a tela e os testes concordarem.

/** Duração das animações de saída (ms): um pouco menos que a de entrada, para a tela nunca parecer travada. */
export const DURACAO_SAIDA = 170

/** Quanto o assistente "digita" uma fala (ms): 320 ms de "pensar" + 12 ms por letra, entre 450 e 1.400 (falas longas não seguram a pessoa). */
export const atrasoDeFala = (texto: string): number => Math.min(1400, Math.max(450, Math.round(320 + texto.length * 12)))

/** Intervalo entre uma fala já pronta e a próxima da mesma resposta (ms). */
export const PAUSA_ENTRE_FALAS = 120

/** Valor de um número que sobe contando: `t` de 0 a 1 (do começo ao fim), curva "freia no final". Sempre chega exatamente a `alvo`. */
export function valorContagem(t: number, alvo: number): number {
  if (t >= 1 || alvo <= 0) return alvo
  if (t <= 0) return 0
  return Math.min(alvo, Math.round(alvo * (1 - (1 - t) ** 3)))
}
