import { qualificacaoCliente, type ClienteQualificacao } from './qualificacao'

/** Corpo da declaração de hipossuficiência, no texto exato usado pelo escritório. */
export function corpoHipossuficiencia(cliente: ClienteQualificacao): string[] {
  return [
    `Eu, ${qualificacaoCliente(cliente)}, DECLARO, para os devidos fins de direito, sob as penas da lei, que ` +
      'não possuo condições financeiras de arcar com as custas processuais e honorários advocatícios sem ' +
      'prejuízo do próprio sustento e de minha família, nos termos do art. 98 e seguintes do Código de ' +
      'Processo Civil (Lei nº 13.105/2015) e do art. 5º, inciso LXXIV, da Constituição Federal de 1988.',
    'Declaro, ainda, que esta declaração é verdadeira e que estou ciente de que a falsidade desta poderá ' +
      'implicar nas sanções previstas nos arts. 297 e 299 do Código Penal, sem prejuízo das sanções civis cabíveis.',
  ]
}
