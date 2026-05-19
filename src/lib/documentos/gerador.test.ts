import { existsSync } from 'fs'
import { join } from 'path'
import { inflateRawSync } from 'zlib'
import { describe, expect, it } from 'vitest'
import { gerarDocumentoDocx } from './gerador'
import { normalizarDadosDocumento } from './schema'

interface ArquivoZipTeste {
  path: string
  data: Buffer
}

function lerZipDocx(buffer: Buffer): ArquivoZipTeste[] {
  let eocd = -1
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('DOCX inválido nos testes.')

  const total = buffer.readUInt16LE(eocd + 10)
  let offset = buffer.readUInt32LE(eocd + 16)
  const files: ArquivoZipTeste[] = []

  for (let i = 0; i < total; i++) {
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const path = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8')
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize)
    const data = method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed)

    files.push({ path, data })
    offset += 46 + nameLength + extraLength + commentLength
  }

  return files
}

function decodificarXml(texto: string) {
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function textoDocx(buffer: Buffer) {
  const xml = lerZipDocx(buffer)
    .filter(file => file.path.startsWith('word/') && file.path.endsWith('.xml'))
    .map(file => file.data.toString('utf8'))
    .join('')
  return Array.from(xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g))
    .map(match => decodificarXml(match[1]))
    .join('')
}

function xmlDocx(buffer: Buffer) {
  return lerZipDocx(buffer)
    .filter(file => file.path.startsWith('word/') && file.path.endsWith('.xml'))
    .map(file => file.data.toString('utf8'))
    .join('')
}

function caminhosDocx(buffer: Buffer) {
  return lerZipDocx(buffer).map(file => file.path)
}

function esperarSemPlaceholders(buffer: Buffer) {
  expect(textoDocx(buffer)).not.toMatch(/\{\{[A-Z0-9_]+\}\}/)
}

describe('gerador DOCX', () => {
  it('versiona os templates DOCX oficiais do gerador', () => {
    const base = join(process.cwd(), 'public', 'templates', 'documentos')

    expect(existsSync(join(base, 'contrato-partido-template.docx'))).toBe(true)
    expect(existsSync(join(base, 'contrato-acao-isolada-template.docx'))).toBe(true)
    expect(existsSync(join(base, 'procuracao-template.docx'))).toBe(true)
    expect(existsSync(join(base, 'hipossuficiencia-template.docx'))).toBe(true)
    expect(existsSync(join(base, 'peticao-comum-template.docx'))).toBe(true)
    expect(existsSync(join(base, 'folha-padrao-2026.png'))).toBe(true)
  })

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
    const texto = textoDocx(docx)

    expect(texto).toContain('DO OBJETO')
    expect(texto).toContain('DA VIGÊNCIA')
    expect(texto).toContain('DO PAGAMENTO')
    expect(texto).toContain('DA SUCUMBÊNCIA')
    expect(texto).toContain('DAS CUSTAS JUDICIAIS')
    expect(texto).toContain('DAS DESPESAS DIVERSAS')
    expect(texto).toContain('DA DESISTÊNCIA')
    expect(texto).toContain('DO FORO')
    expect(texto).toContain('Direito tributário e demandas criminais')
    expect(texto).toContain('Em dezembro de cada ano')
    esperarSemPlaceholders(docx)
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

    expect(textoDocx(docx)).not.toContain('Em dezembro de cada ano')
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
    const texto = textoDocx(docx)

    expect(texto).toContain('Cristiano Pessoa Sousa')
    expect(texto).toContain('Valéria Ferreira do Val Domingues Pessoa')
    expect(texto).toContain('nomeia e constitui seus bastantes procuradores')
    esperarSemPlaceholders(docx)
  })

  it('gera declaração com trecho literal do modelo oficial parametrizado', () => {
    const docx = gerarDocumentoDocx(normalizarDadosDocumento({
      tipoDocumento: 'hipossuficiencia',
      nomeRazaoSocial: 'Cliente Teste',
      cpfCnpj: '000.000.000-00',
      endereco: 'Rua Teste, 100',
      finalidadeHipossuficiencia: 'requerimento de gratuidade da justiça',
      nomeRevisor: 'Valéria',
    }, 'hipossuficiencia'), 'hipossuficiencia')
    const texto = textoDocx(docx)

    expect(texto).toContain('DECLARAÇÃO DE  POBREZA')
    expect(texto).toContain('não podendo, assim, pagar as custas processuais')
    expect(texto).toContain('requerimento de gratuidade da justiça')
    esperarSemPlaceholders(docx)
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
    const texto = textoDocx(docx)
    const xml = xmlDocx(docx)

    expect(xml).toContain('Cormorant Garamond')
    expect(xml).toContain('Montserrat')
    expect(texto).toContain('EXMO. SR. JUIZ DE DIREITO DA 1ª VARA CÍVEL DA COMARCA DE Belo Horizonte/MG')
    expect(texto).toContain('URGENTE')
    expect(texto).toContain('DA GRATUIDADE DA JUSTIÇA')
    expect(texto).toContain('DOS FATOS')
    expect(texto).toContain('DO DIREITO')
    expect(texto).toContain('DOS PEDIDOS')
    expect(texto).toContain('Cristiano Pessoa Sousa')
    expect(texto).toContain('Valéria F. do Val Domingues Pessoa')
    expect(caminhosDocx(docx)).toContain('word/header1.xml')
    expect(caminhosDocx(docx)).toContain('word/footer1.xml')
    esperarSemPlaceholders(docx)
  })
})
