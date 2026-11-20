import { useConta } from '../services/sync/conta'
import { ConfirmarAcao } from './ConfirmarAcao'

/**
 * O aviso da PRIMEIRA subida de espaços (F6.5): antes de mandar para a conta Google as provas importadas, as questões e os materiais, explica o que sobe e dá a saída "Manter só aqui".
 * Nada de espaço sobe até a pessoa responder. O botão seguro (com o foco, e o que Esc, o voltar do aparelho e tocar fora escolhem) é "Manter só aqui": o que existe agora fica só neste
 * aparelho; o que for criado depois sobe normalmente, e em Meus espaços dá para escolher espaço por espaço.
 */
export function AvisoEspacos() {
  const responder = useConta((s) => s.responderAviso)
  return (
    <ConfirmarAcao
      titulo="O que sobe para a sua conta"
      texto="Seus espaços, provas importadas, questões e materiais vão para a sua conta Google, para aparecerem nos outros aparelhos. Só você acessa, mas o Google guarda em servidores (não é criptografado de ponta a ponta). Em “Meus espaços” dá para deixar um espaço só neste aparelho."
      confirmar="Enviar para a conta"
      cancelar="Manter só aqui"
      perigo={false}
      onConfirmar={() => void responder('enviar')}
      onCancelar={() => void responder('manter')}
    />
  )
}
