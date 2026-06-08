import { parseOffice } from 'officeparser'
import { completarJSON } from '@/lib/ai/service'
import {
  normalizeProcessoImportacao,
  type ProcessoImportacaoDados,
} from './importar-documento'

export const PROCESSO_IMPORTAR_ARQUIVO_TAMANHO_MAX = 15 * 1024 * 1024

const EXTENSOES_PERMITIDAS = new Set(['pdf', 'doc', 'docx'])
const MIME_TYPES_PERMITIDOS = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
])

function getExtensaoArquivo(nome: string) {
  const parts = nome.toLowerCase().split('.')
  return parts.length > 1 ? parts.pop() ?? '' : ''
}

function normalizarTextoExtraido(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return normalizarTextoExtraido((value as { value?: unknown }).value)
  }
  return String(value).trim()
}

export function validarArquivoImportacaoProcesso(file: File) {
  const extensao = getExtensaoArquivo(file.name)
  if (!EXTENSOES_PERMITIDAS.has(extensao)) {
    throw new Error('Tipo de arquivo não permitido. Envie PDF, DOC ou DOCX.')
  }
  if (!MIME_TYPES_PERMITIDOS.has(file.type) && file.type !== '') {
    throw new Error('Tipo MIME não permitido. Envie PDF, DOC ou DOCX.')
  }
  if (file.size <= 0) {
    throw new Error('Arquivo vazio.')
  }
  if (file.size > PROCESSO_IMPORTAR_ARQUIVO_TAMANHO_MAX) {
    throw new Error('Arquivo excede o tamanho máximo permitido.')
  }
}

export async function extrairTextoDocumentoProcesso(file: File) {
  validarArquivoImportacaoProcesso(file)

  const buffer = new Uint8Array(await file.arrayBuffer())

  let texto = ''
  try {
    const ast = await parseOffice(buffer)
    texto = normalizarTextoExtraido(await ast.to('text'))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao extrair texto'
    if (getExtensaoArquivo(file.name) === 'doc') {
      throw new Error(`Não foi possível extrair o texto deste arquivo DOC legado. Converta para DOCX ou PDF pesquisável. (${message})`)
    }
    throw new Error(`Não foi possível extrair texto do documento. Verifique se o arquivo está legível e contém texto pesquisável. (${message})`)
  }

  if (!texto.trim()) {
    throw new Error('Não foi possível extrair texto do documento. O arquivo pode estar escaneado, ilegível ou sem texto pesquisável.')
  }

  return {
    extensao: getExtensaoArquivo(file.name),
    texto,
  }
}

function systemPrompt() {
  return [
    'Você extrai dados processuais a partir de um documento enviado pelo usuário.',
    'Responda exclusivamente em JSON válido, sem explicações.',
    'Não invente dados ausentes. Se algo não estiver expresso no texto, deixe o campo vazio ou null e registre em observacoes.camposNaoEncontrados.',
    'Se houver inconsistências, registre em observacoes.inconsistencias.',
    'Campos esperados:',
    '- cliente.nome, cliente.cpfCnpj, cliente.telefone, cliente.email, cliente.endereco',
    '- parteContraria.nome, parteContraria.cpfCnpj, parteContraria.endereco',
    '- processo.numero, processo.comarca, processo.vara, processo.tribunal, processo.classe, processo.assunto, processo.fase, processo.dataDistribuicao, processo.valorCausa, processo.segredoJustica',
    '- advogados[].nome, advogados[].oab, advogados[].representa',
    '- resumo.resumoCaso, resumo.fatosRelevantes, resumo.pedidosPrincipais, resumo.prazosMencionados',
    '- observacoes.camposNaoEncontrados, observacoes.inconsistencias, observacoes.observacoesInternas',
  ].join('\n')
}

export async function importarDadosProcessoDeDocumento(file: File): Promise<{
  arquivo: { nome: string; tipo: string; tamanho: number; extensao: string }
  textoExtraido: string
  dados: ProcessoImportacaoDados
}> {
  const { extensao, texto } = await extrairTextoDocumentoProcesso(file)
  const textoLimitado = texto.length > 50000 ? `${texto.slice(0, 50000)}\n\n[Texto truncado por limite técnico]` : texto

  const raw = await completarJSON([
    {
      role: 'system',
      content: systemPrompt(),
    },
    {
      role: 'user',
      content: JSON.stringify({
        arquivo: {
          nome: file.name,
          tipo: file.type,
          tamanho: file.size,
          extensao,
        },
        textoExtraido: textoLimitado,
      }),
    },
  ], { temperature: 0.1 })

  const parsed = JSON.parse(raw)
  const dados = normalizeProcessoImportacao(parsed)

  return {
    arquivo: {
      nome: file.name,
      tipo: file.type,
      tamanho: file.size,
      extensao,
    },
    textoExtraido: textoLimitado,
    dados,
  }
}

