import type { UserRole } from '@/types'

export const CENTRAL_ARQUIVOS_BUCKET = 'central-arquivos' as const

export const CENTRAL_ARQUIVOS_ALLOWED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'txt',
  'jpg',
  'jpeg',
  'png',
  'mp3',
  'm4a',
  'wav',
  'xlsx',
  'csv',
] as const

export const CENTRAL_ARQUIVOS_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/x-m4a',
  'audio/m4a',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
] as const

export type CentralArquivosAllowedExtension = typeof CENTRAL_ARQUIVOS_ALLOWED_EXTENSIONS[number]
export type CentralArquivosAllowedMimeType = typeof CENTRAL_ARQUIVOS_ALLOWED_MIME_TYPES[number]

export type CentralArquivosVisibilidade = 'interna' | 'portal'
export type CentralArquivosStatusProcessamento = 'pendente' | 'processando' | 'processado' | 'erro'
export type CentralArquivosStatusTranscricao = 'pendente' | 'processando' | 'transcrito' | 'erro'
export type CentralArquivosTipoVinculo = 'cliente' | 'processo' | 'caso'

export interface CentralArquivosFiltroBase {
  q?: string
  cliente_id?: string | null
  processo_id?: string | null
  caso_id?: string | null
  categoria?: string | null
  tipo?: string | null
  visibilidade?: CentralArquivosVisibilidade | null
  limit?: number
}

export interface CentralArquivosPasta {
  id: string
  nome: string
  descricao: string | null
  cliente_id: string | null
  processo_id: string | null
  caso_id: string | null
  pasta_pai_id: string | null
  criado_por: string
  visibilidade: CentralArquivosVisibilidade
  created_at: string
  updated_at: string
  cliente?: { id: string; nome: string } | null
  processo?: { id: string; titulo: string; numero_processo: string | null } | null
  pasta_pai?: { id: string; nome: string } | null
  criado_por_profile?: { id: string; nome: string } | null
}

export interface CentralArquivosDocumento {
  id: string
  pasta_id: string | null
  nome_original: string
  nome_armazenado: string
  tipo_mime: string
  extensao: string | null
  tamanho_bytes: number | null
  storage_bucket: string
  storage_path: string
  cliente_id: string | null
  processo_id: string | null
  caso_id: string | null
  categoria: string | null
  descricao: string | null
  enviado_por: string
  status_processamento: CentralArquivosStatusProcessamento
  status_transcricao: CentralArquivosStatusTranscricao | null
  visibilidade: CentralArquivosVisibilidade
  analise_aurora: Record<string, unknown> | null
  created_at: string
  updated_at: string
  cliente?: { id: string; nome: string } | null
  processo?: { id: string; titulo: string; numero_processo: string | null } | null
  pasta?: { id: string; nome: string } | null
  enviado_por_profile?: { id: string; nome: string } | null
}

export interface CentralArquivosVinculo {
  id: string
  documento_id: string
  cliente_id: string | null
  processo_id: string | null
  caso_id: string | null
  tipo_vinculo: CentralArquivosTipoVinculo
  criado_por: string
  created_at: string
}

export interface CentralArquivosCriarPastaInput {
  nome: string
  descricao?: string | null
  cliente_id?: string | null
  processo_id?: string | null
  caso_id?: string | null
  pasta_pai_id?: string | null
  visibilidade?: CentralArquivosVisibilidade
}

export interface CentralArquivosUploadInput {
  files: File[]
  pasta_id?: string | null
  cliente_id?: string | null
  processo_id?: string | null
  caso_id?: string | null
  categoria?: string | null
  descricao?: string | null
  visibilidade?: CentralArquivosVisibilidade
}

export interface CentralArquivosVincularInput {
  documento_id: string
  cliente_id?: string | null
  processo_id?: string | null
  caso_id?: string | null
  tipo_vinculo: CentralArquivosTipoVinculo
}

export interface CentralArquivosListResult<T> {
  items: T[]
}

export interface CentralArquivosDownloadResult {
  signedUrl: string
  fileName: string
  mimeType: string
}

export interface CentralArquivosPageSession {
  userId: string
  role: UserRole
}
