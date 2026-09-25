import { qualificacaoCliente, type ClienteQualificacao } from './qualificacao'

// Outorgados fixos — mesmo texto usado nas procurações reais do escritório.
const OUTORGADOS =
  'nomeia e constitui seus bastantes procuradores os advogados: Cristiano Pessoa Sousa, inscrito na Ordem dos ' +
  'Advogados do Brasil no Conselho Seccional de Minas Gerais sob o n° 88.465, brasileiro, casado, e Valéria ' +
  'Ferreira do Val Domingues Pessoa, inscrita na Ordem dos Advogados do Brasil no Conselho Seccional de Minas ' +
  'Gerais sob o n° 98.185, brasileira, casada, ambos com endereço comercial à rua Gonçalves Dias, nº 874, 8º ' +
  'andar, Savassi – Belo Horizonte/MG'

const PODERES =
  'atribuindo-lhes poderes para o foro em geral e especiais para propor todos os tipos de ações, transigir, ' +
  'recorrer, receber e dar quitações, fazer levantamentos e depósitos, desistir, inclusive receber citações, ' +
  'conjunta ou separadamente, tudo em defesa dos legítimos interesses do outorgante'

/**
 * Corpo da procuração ad judicia et extra. `poderesEspecificos`, quando informado, é
 * anexado ao final ("em especial para ...") — ex: "depósito em juízo das chaves...".
 */
export function corpoProcuracao(cliente: ClienteQualificacao, poderesEspecificos?: string): string {
  const especifico = poderesEspecificos?.trim()
    ? `, em especial para ${poderesEspecificos.trim()}`
    : ''

  return `${qualificacaoCliente(cliente)}, pelo presente instrumento particular de PROCURAÇÃO, ${OUTORGADOS}, ` +
    `${PODERES}${especifico}.`
}
