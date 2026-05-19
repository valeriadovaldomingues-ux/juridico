import { describe, expect, it } from 'vitest'
import { gerarDocumentoDocx } from './gerador'

describe('gerador DOCX', () => {
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
