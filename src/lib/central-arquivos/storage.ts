import { randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { CENTRAL_ARQUIVOS_ALLOWED_EXTENSIONS, CENTRAL_ARQUIVOS_ALLOWED_MIME_TYPES, CENTRAL_ARQUIVOS_BUCKET } from './types'

export const CENTRAL_ARQUIVOS_MAX_UPLOAD_BYTES = 25 * 1024 * 1024
export const CENTRAL_ARQUIVOS_MAX_TOTAL_BYTES = 100 * 1024 * 1024

function sanitizeBaseName(filename: string): string {
  const base = filename
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    ?.replace(/\.[^.]+$/, '') ?? 'arquivo'

  return base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'arquivo'
}

export function getCentralArquivosBucket() {
  return CENTRAL_ARQUIVOS_BUCKET
}

export function buildCentralArquivosStoragePath(params: {
  originalName: string
  folderId?: string | null
  prefix?: string
}) {
  const original = params.originalName
  const ext = original.includes('.') ? original.split('.').pop()?.toLowerCase() ?? '' : ''
  const safeExt = ext && CENTRAL_ARQUIVOS_ALLOWED_EXTENSIONS.includes(ext as typeof CENTRAL_ARQUIVOS_ALLOWED_EXTENSIONS[number])
    ? ext
    : 'bin'
  const safeBase = sanitizeBaseName(original)
  const folder = params.folderId ? sanitizeBaseName(params.folderId) : 'raiz'
  const prefix = params.prefix ? sanitizeBaseName(params.prefix) : 'arquivos'

  return [
    prefix,
    folder,
    new Date().toISOString().slice(0, 10).replace(/-/g, '/'),
    `${randomUUID()}-${safeBase}.${safeExt}`,
  ].join('/')
}

export function assertAllowedCentralArquivoFile(file: File): void {
  const lowerName = file.name.toLowerCase()
  const extension = lowerName.split('.').pop() ?? ''
  const mime = file.type.toLowerCase()

  if (!CENTRAL_ARQUIVOS_ALLOWED_EXTENSIONS.includes(extension as typeof CENTRAL_ARQUIVOS_ALLOWED_EXTENSIONS[number])) {
    throw new Error('Formato de arquivo não permitido.')
  }

  if (!CENTRAL_ARQUIVOS_ALLOWED_MIME_TYPES.includes(mime as typeof CENTRAL_ARQUIVOS_ALLOWED_MIME_TYPES[number])) {
    throw new Error('Tipo MIME não permitido.')
  }

  if (file.size <= 0) {
    throw new Error('O arquivo está vazio.')
  }

  if (file.size > CENTRAL_ARQUIVOS_MAX_UPLOAD_BYTES) {
    throw new Error('O arquivo excede o limite de 25MB.')
  }
}

export function assertAllowedCentralArquivosBatch(files: File[]): void {
  if (!files.length) {
    throw new Error('Envie pelo menos um arquivo.')
  }

  const total = files.reduce((sum, file) => sum + file.size, 0)
  if (total > CENTRAL_ARQUIVOS_MAX_TOTAL_BYTES) {
    throw new Error('O total de arquivos excede o limite de 100MB.')
  }

  for (const file of files) {
    assertAllowedCentralArquivoFile(file)
  }
}

function getServiceClient() {
  return createServiceClient()
}

export async function uploadFileToStorage(path: string, file: File) {
  const client = getServiceClient()
  const { error } = await client.storage
    .from(CENTRAL_ARQUIVOS_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    throw new Error(error.message)
  }

  return path
}

export async function removeFileFromStorage(path: string): Promise<void> {
  const client = getServiceClient()
  await client.storage.from(CENTRAL_ARQUIVOS_BUCKET).remove([path])
}

export async function createDownloadUrl(path: string, expiresInSeconds = 900): Promise<string> {
  const client = getServiceClient()
  const { data, error } = await client.storage
    .from(CENTRAL_ARQUIVOS_BUCKET)
    .createSignedUrl(path, expiresInSeconds)

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Não foi possível gerar o link de download.')
  }

  return data.signedUrl
}

