import { describe, expect, it } from 'vitest'
import { gerarDocumentoDocx } from './gerador'
import { normalizarDadosDocumento } from './schema'

describe('gerador DOCX', () => {
  it('gera contrato de partido com as cláusulas obrigatórias do modelo oficial', () => {
    const docx = gerarDocumentoDocx(normalizarDadosDocumento({
      tipoDocumento: 'contrato_partido',
      clienteTipo: 'pj',
      nomeRazaoSocial: 'Empresa Teste Ltda.',
      cpfCnpj: '00.000.000/0001-00',
      endereco: 'Rua Teste, 100',
      honorarios: 'R$ 5.000,00',
      vencimento: '10',
      primeiraParcela: '10/06/2026',
      vigenciaInicio: '01/06/2026',
      todasAreas: false,
      areasExcluidas: 'Direito tributário e demandas criminais',
      percentualExito: '10%',
      parcelaAdicionalDezembro: true,
      nomeRevisor: 'Valéria',
    }, 'contrato_partido'), 'contrato_partido')
    const xml = docx.toString('utf8')

    expect(xml).toContain('Cláusula primeira – DO OBJETO')
    expect(xml).toContain('Cláusula segunda – DA VIGÊNCIA')
    expect(xml).toContain('Cláusula terceira – DO PAGAMENTO')
    expect(xml).toContain('Cláusula quarta – DA SUCUMBÊNCIA')
    expect(xml).toContain('Cláusula quinta – DAS CUSTAS JUDICIAIS')
    expect(xml).toContain('Cláusula sexta – DAS DESPESAS DIVERSAS')
    expect(xml).toContain('Cláusula sétima – DA DESISTÊNCIA')
    expect(xml).toContain('Cláusula oitava – DO FORO')
    expect(xml).toContain('Direito tributário e demandas criminais')
    expect(xml).toContain('Parcela adicional anual em dezembro: sim')
  })

  it('omite a parcela adicional anual em dezembro quando não marcada', () => {
    const docx = gerarDocumentoDocx(normalizarDadosDocumento({
      tipoDocumento: 'contrato_partido',
      clienteTipo: 'pj',
      nomeRazaoSocial: 'Empresa Teste Ltda.',
      cpfCnpj: '00.000.000/0001-00',
      endereco: 'Rua Teste, 100',
      honorarios: 'R$ 5.000,00',
      vencimento: '10',
      primeiraParcela: '10/06/2026',
      vigenciaInicio: '01/06/2026',
      todasAreas: true,
      percentualExito: '10%',
      parcelaAdicionalDezembro: false,
      nomeRevisor: 'Valéria',
    }, 'contrato_partido'), 'contrato_partido')

    expect(docx.toString('utf8')).not.toContain('Parcela adicional anual em dezembro')
  })

  it('gera procuração com os advogados oficiais', () => {
    const docx = gerarDocumentoDocx(normalizarDadosDocumento({
      tipoDocumento: 'procuracao',
      clienteTipo: 'pf',
      nomeRazaoSocial: 'Cliente Teste',
      cpfCnpj: '000.000.000-00',
      endereco: 'Rua Teste, 100',
      nomeRevisor: 'Cristiano',
    }, 'procuracao'), 'procuracao')
    const xml = docx.toString('utf8')

    expect(xml).toContain('Cristiano Pessoa Sousa')
    expect(xml).toContain('Valéria Ferreira do Val Domingues Pessoa')
  })

  it('aplica a folha padrão 2026 na petição comum', () => {
    const docx = gerarDocumentoDocx({
      tipoDocumento: 'peticao_comum',
      tipoPeticao: 'Ação de Obrigação de Fazer',
      nomeRazaoSocial: 'Cliente Teste',
      cpfCnpj: '000.000.000-00',
      endereco: 'Rua Teste, 100',
      parteContraria: 'Empresa Ré',
      vara: '1ª',
      foro: 'CÍVEL',
      comarca: 'Belo Horizonte',
      uf: 'MG',
      urgencia: true,
      gratuidadeJustica: true,
      fatosResumidos: 'Fatos narrados pelo cliente.',
      direito: 'Fundamentos jurídicos aplicáveis.',
      pedidos: 'Procedência dos pedidos.',
      valorCausa: '1.000,00',
      localData: 'Belo Horizonte, 18 de maio de 2026.',
      nomeRevisor: 'Valéria',
    })
    const xml = docx.toString('utf8')

    expect(xml).toContain('Cormorant Garamond')
    expect(xml).toContain('Montserrat')
    expect(xml).toContain('EXMO. SR. JUIZ DE DIREITO DA 1ª VARA CÍVEL DA COMARCA DE Belo Horizonte/MG.')
    expect(xml).toContain('URGENTE')
    expect(xml).toContain('DA GRATUIDADE DA JUSTIÇA')
    expect(xml).toContain('DOS FATOS')
    expect(xml).toContain('DO DIREITO')
    expect(xml).toContain('DOS PEDIDOS')
    expect(xml).toContain('Cristiano Pessoa Sousa')
    expect(xml).toContain('Valéria F. do Val Domingues Pessoa')
    expect(xml).toContain('header1.xml')
    expect(xml).toContain('footer1.xml')
  })
})
