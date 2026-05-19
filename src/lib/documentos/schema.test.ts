import { describe, expect, it } from 'vitest'
import {
  TIPOS_DOCUMENTO_GERADOR,
  calcularCamposAusentes,
  extensaoArquivoPermitida,
  normalizarDadosDocumento,
  podeGerarDocumento,
} from './schema'

describe('schema do gerador de documentos', () => {
  it('expõe os cinco tipos de documento da tela inicial', () => {
    expect(TIPOS_DOCUMENTO_GERADOR.map(tipo => tipo.titulo)).toEqual([
      'Contrato — Advocacia de Partido',
      'Contrato — Ação Isolada',
      'Procuração ad judicia et extra',
      'Declaração de Hipossuficiência',
      'Petição Comum',
    ])
  })

  it('aceita apenas uploads permitidos', () => {
    expect(extensaoArquivoPermitida('contrato.pdf', 'application/pdf')).toBe(true)
    expect(extensaoArquivoPermitida('rg.jpg', 'image/jpeg')).toBe(true)
    expect(extensaoArquivoPermitida('comprovante.png', 'image/png')).toBe(true)
    expect(extensaoArquivoPermitida('planilha.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(false)
  })

  it('não inventa CPF/CNPJ ausente ao normalizar dados extraídos', () => {
    const dados = normalizarDadosDocumento({
      tipoDocumento: 'contrato_partido',
      nomeRazaoSocial: 'Empresa Teste Ltda.',
      camposAusentes: ['CPF/CNPJ'],
    }, 'contrato_partido')

    expect(dados.nomeRazaoSocial).toBe('Empresa Teste Ltda.')
    expect(dados.cpfCnpj).toBe('')
    expect(dados.camposAusentes).toContain('CPF/CNPJ')
  })

  it('calcula campos ausentes para revisão', () => {
    const dados = normalizarDadosDocumento({
      tipoDocumento: 'hipossuficiencia',
      nomeRazaoSocial: 'Maria Teste',
    }, 'hipossuficiencia')

    expect(calcularCamposAusentes('hipossuficiencia', dados)).toContain('CPF/CNPJ')
    expect(dados.camposAusentes).toContain('Finalidade')
  })

  it('bloqueia geração sem confirmação humana', () => {
    const dados = normalizarDadosDocumento({ tipoDocumento: 'peticao_comum' }, 'peticao_comum')

    expect(podeGerarDocumento(false, dados)).toBe(false)
    expect(podeGerarDocumento(true, dados)).toBe(true)
  })

  it('normaliza campos específicos da petição comum', () => {
    const dados = normalizarDadosDocumento({
      tipoDocumento: 'peticao_comum',
      urgencia: true,
      gratuidadeJustica: true,
      uf: 'mg',
      valorCausa: '1.000,00',
    }, 'peticao_comum')

    expect(dados.urgencia).toBe(true)
    expect(dados.gratuidadeJustica).toBe(true)
    expect(dados.uf).toBe('MG')
    expect(dados.valorCausa).toBe('1.000,00')
  })
})
