import { createServiceClient } from '@/lib/supabase/service'
import type {
  CentralArquivosCriarPastaInput,
  CentralArquivosDocumento,
  CentralArquivosDownloadResult,
  CentralArquivosFiltroBase,
  CentralArquivosPageSession,
  CentralArquivosPasta,
  CentralArquivosUploadInput,
  CentralArquivosVincularInput,
  CentralArquivosVinculo,
} from './types'
import {
  assertAllowedCentralArquivosBatch,
  buildCentralArquivosStoragePath,
  createDownloadUrl,
  removeFileFromStorage,
  uploadFileToStorage,
} from './storage'

class CentralArquivosError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = 'central_arquivos_error',
  ) {
    super(message)
    this.name = 'CentralArquivosError'
  }
}

function getService() {
  try {
    return createServiceClient()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Configuração do Supabase indisponível.'
    throw new CentralArquivosError(message, 500, 'config_unavailable')
  }
}

function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function matchesQuery(row: { nome?: string | null; descricao?: string | null; categoria?: string | null; cliente?: { nome: string } | null; processo?: { titulo: string; numero_processo: string | null } | null }, q: string) {
  const normalized = normalizeText(q)
  if (!normalized) return true
  const haystack = [
    row.nome ?? '',
    row.descricao ?? '',
    row.categoria ?? '',
    row.cliente?.nome ?? '',
    row.processo?.titulo ?? '',
    row.processo?.numero_processo ?? '',
  ].map(normalizeText).join(' | ')
  return haystack.includes(normalized)
}

function clampLimit(limit?: number, fallback = 100) {
  if (!limit || Number.isNaN(limit)) return fallback
  return Math.min(Math.max(Math.trunc(limit), 1), 200)
}

const DOCUMENT_TYPE_GROUPS: Record<string, string[]> = {
  pdf: ['pdf'],
  documento: ['doc', 'docx', 'txt'],
  imagem: ['jpg', 'jpeg', 'png'],
  audio: ['mp3', 'm4a', 'wav'],
  planilha: ['xlsx', 'csv'],
}

function normalizeTipoFiltro(tipo?: string | null) {
  return normalizeText(tipo ?? '')
}

function matchesTipoDocumento(row: { extensao: string | null; tipo_mime: string }, tipo?: string | null) {
  const normalized = normalizeTipoFiltro(tipo)
  if (!normalized) return true

  const extensao = normalizeText(row.extensao ?? '')
  const mime = normalizeText(row.tipo_mime)

  if (DOCUMENT_TYPE_GROUPS[normalized]) {
    return DOCUMENT_TYPE_GROUPS[normalized].includes(extensao)
  }

  return extensao === normalized || mime.includes(normalized)
}

export async function listPastas(filters: CentralArquivosFiltroBase = {}): Promise<CentralArquivosPasta[]> {
  const supabase = getService()
  const limit = clampLimit(filters.limit, 200)

  const { data, error } = await supabase
    .from('central_arquivos_pastas')
    .select(`
      id, nome, descricao, cliente_id, processo_id, caso_id, pasta_pai_id, criado_por,
      visibilidade, created_at, updated_at,
      cliente:clientes(id, nome),
      processo:processos(id, titulo, numero_processo),
      pasta_pai:central_arquivos_pastas!pasta_pai_id(id, nome),
      criado_por_profile:profiles!criado_por(id, nome)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new CentralArquivosError(error.message, 500, 'list_pastas_failed')

  return ((data ?? []) as unknown as CentralArquivosPasta[]).filter(row => {
    if (filters.cliente_id && row.cliente_id !== filters.cliente_id) return false
    if (filters.processo_id && row.processo_id !== filters.processo_id) return false
    if (filters.caso_id && row.caso_id !== filters.caso_id) return false
    if (filters.visibilidade && row.visibilidade !== filters.visibilidade) return false
    if (!filters.q) return true
    return matchesQuery(row, filters.q)
  })
}

export async function listDocumentos(filters: CentralArquivosFiltroBase = {}): Promise<CentralArquivosDocumento[]> {
  const supabase = getService()
  const limit = clampLimit(filters.limit, 200)

  const { data, error } = await supabase
    .from('central_arquivos_documentos')
    .select(`
      id, pasta_id, nome_original, nome_armazenado, tipo_mime, extensao, tamanho_bytes,
      storage_bucket, storage_path, cliente_id, processo_id, caso_id, categoria, descricao,
      enviado_por, status_processamento, status_transcricao, visibilidade, analise_aurora,
      created_at, updated_at,
      cliente:clientes(id, nome),
      processo:processos(id, titulo, numero_processo),
      pasta:central_arquivos_pastas(id, nome),
      enviado_por_profile:profiles!enviado_por(id, nome)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new CentralArquivosError(error.message, 500, 'list_documentos_failed')

  return ((data ?? []) as unknown as CentralArquivosDocumento[]).filter(row => {
    if (filters.cliente_id && row.cliente_id !== filters.cliente_id) return false
    if (filters.processo_id && row.processo_id !== filters.processo_id) return false
    if (filters.caso_id && row.caso_id !== filters.caso_id) return false
    if (filters.categoria && normalizeText(row.categoria ?? '') !== normalizeText(filters.categoria)) return false
    if (!matchesTipoDocumento(row, filters.tipo)) return false
    if (filters.visibilidade && row.visibilidade !== filters.visibilidade) return false
    if (!filters.q) return true
    return matchesQuery({
      nome: row.nome_original,
      descricao: row.descricao,
      categoria: row.categoria,
      cliente: row.cliente,
      processo: row.processo,
    }, filters.q)
  })
}

export async function createPasta(input: CentralArquivosCriarPastaInput, userId: string): Promise<CentralArquivosPasta> {
  const supabase = getService()

  const payload = {
    nome: input.nome.trim(),
    descricao: input.descricao?.trim() || null,
    cliente_id: input.cliente_id ?? null,
    processo_id: input.processo_id ?? null,
    caso_id: input.caso_id ?? null,
    pasta_pai_id: input.pasta_pai_id ?? null,
    criado_por: userId,
    visibilidade: input.visibilidade ?? 'interna',
  }

  if (!payload.nome) {
    throw new CentralArquivosError('Informe o nome da pasta.', 400, 'invalid_name')
  }

  const { data, error } = await supabase
    .from('central_arquivos_pastas')
    .insert(payload)
    .select(`
      id, nome, descricao, cliente_id, processo_id, caso_id, pasta_pai_id, criado_por,
      visibilidade, created_at, updated_at,
      cliente:clientes(id, nome),
      processo:processos(id, titulo, numero_processo),
      pasta_pai:central_arquivos_pastas!pasta_pai_id(id, nome),
      criado_por_profile:profiles!criado_por(id, nome)
    `)
    .single()

  if (error) throw new CentralArquivosError(error.message, 400, 'create_pasta_failed')
  return data as unknown as CentralArquivosPasta
}

export async function uploadCentralArquivos(input: CentralArquivosUploadInput, userId: string): Promise<CentralArquivosDocumento[]> {
  assertAllowedCentralArquivosBatch(input.files)

  const supabase = getService()
  const uploaded: CentralArquivosDocumento[] = []

  for (const file of input.files) {
    const storagePath = buildCentralArquivosStoragePath({
      originalName: file.name,
      folderId: input.pasta_id ?? null,
      prefix: 'docs',
    })

    try {
      await uploadFileToStorage(storagePath, file)
    } catch (error) {
      throw new CentralArquivosError(error instanceof Error ? error.message : 'Falha no upload.', 500, 'upload_failed')
    }

    const payload = {
      pasta_id: input.pasta_id ?? null,
      nome_original: file.name,
      nome_armazenado: storagePath.split('/').pop() ?? file.name,
      tipo_mime: file.type,
      extensao: file.name.split('.').pop()?.toLowerCase() ?? null,
      tamanho_bytes: file.size,
      storage_bucket: 'central-arquivos',
      storage_path: storagePath,
      cliente_id: input.cliente_id ?? null,
      processo_id: input.processo_id ?? null,
      caso_id: input.caso_id ?? null,
      categoria: input.categoria ?? null,
      descricao: input.descricao ?? null,
      enviado_por: userId,
      status_processamento: 'pendente',
      status_transcricao: null,
      visibilidade: input.visibilidade ?? 'interna',
      analise_aurora: null,
    }

    const { data, error } = await supabase
      .from('central_arquivos_documentos')
      .insert(payload)
      .select(`
        id, pasta_id, nome_original, nome_armazenado, tipo_mime, extensao, tamanho_bytes,
        storage_bucket, storage_path, cliente_id, processo_id, caso_id, categoria, descricao,
        enviado_por, status_processamento, status_transcricao, visibilidade, analise_aurora,
        created_at, updated_at,
        cliente:clientes(id, nome),
        processo:processos(id, titulo, numero_processo),
        pasta:central_arquivos_pastas(id, nome),
        enviado_por_profile:profiles!enviado_por(id, nome)
      `)
      .single()

    if (error || !data) {
      await removeFileFromStorage(storagePath)
      throw new CentralArquivosError(error?.message ?? 'Falha ao gravar metadados.', 400, 'metadata_failed')
    }

    uploaded.push(data as unknown as CentralArquivosDocumento)
  }

  return uploaded
}

export async function createVinculo(input: CentralArquivosVincularInput, userId: string): Promise<CentralArquivosVinculo> {
  const supabase = getService()

  if (!input.documento_id.trim()) {
    throw new CentralArquivosError('Informe o documento.', 400, 'invalid_documento')
  }

  if (!['cliente', 'processo', 'caso'].includes(input.tipo_vinculo)) {
    throw new CentralArquivosError('Tipo de vínculo inválido.', 400, 'invalid_vinculo')
  }

  if (input.tipo_vinculo === 'processo' && !input.processo_id?.trim()) {
    throw new CentralArquivosError('Informe o processo.', 400, 'invalid_processo')
  }

  if (input.tipo_vinculo === 'cliente' && !input.cliente_id?.trim()) {
    throw new CentralArquivosError('Informe o cliente.', 400, 'invalid_cliente')
  }

  if (input.tipo_vinculo === 'caso' && !input.caso_id?.trim()) {
    throw new CentralArquivosError('Informe o caso.', 400, 'invalid_caso')
  }

  const payload = {
    documento_id: input.documento_id,
    cliente_id: input.cliente_id ?? null,
    processo_id: input.processo_id ?? null,
    caso_id: input.caso_id ?? null,
    tipo_vinculo: input.tipo_vinculo,
    criado_por: userId,
  }

  const { data, error } = await supabase
    .from('central_arquivos_vinculos')
    .insert(payload)
    .select('*')
    .single()

  if (error) throw new CentralArquivosError(error.message, 400, 'create_vinculo_failed')
  return data as unknown as CentralArquivosVinculo
}

export async function getDocumentoDownload(documentoId: string): Promise<CentralArquivosDownloadResult> {
  const supabase = getService()

  if (!documentoId.trim()) {
    throw new CentralArquivosError('Documento não encontrado.', 404, 'document_not_found')
  }

  const { data: documento, error } = await supabase
    .from('central_arquivos_documentos')
    .select('id, nome_original, tipo_mime, storage_path, storage_bucket')
    .eq('id', documentoId)
    .single()

  if (error || !documento) {
    throw new CentralArquivosError('Documento não encontrado.', 404, 'document_not_found')
  }

  const signedUrl = await createDownloadUrl(documento.storage_path, 900)

  return {
    signedUrl,
    fileName: documento.nome_original,
    mimeType: documento.tipo_mime,
  }
}

export function isCentralArquivosError(error: unknown): error is CentralArquivosError {
  return error instanceof CentralArquivosError
}

export { CentralArquivosError }
