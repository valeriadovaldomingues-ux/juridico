import { MyAiDriveValidationError } from './errors'
import type {
  MyAiDriveFile,
  MyAiDriveFolder,
  MyAiDriveSearchResult,
  MyAiDriveProviderStatus,
} from './types'

function stripControlChars(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, '')
}

export function normalizeFileName(name: string): string {
  const cleaned = stripControlChars(name)
    .normalize('NFKC')
    .replace(/[\\/]+/g, ' ')
    .replace(/[<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\.\.+/g, '.')
    .replace(/^[.\s]+/g, '')
    .replace(/\s*\.+$/g, '')
    .trim()

  if (!cleaned) {
    throw new MyAiDriveValidationError('O nome do arquivo não pode ficar vazio.')
  }

  return cleaned
}

export function normalizePath(path: string): string {
  const cleaned = stripControlChars(path)
    .normalize('NFKC')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .trim()

  if (!cleaned) {
    throw new MyAiDriveValidationError('O caminho não pode ficar vazio.')
  }

  const segments = cleaned.split('/').filter(Boolean)
  const normalizedSegments = segments.map(segment =>
    segment
      .replace(/[<>:"|?*\u0000-\u001F]/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  ).filter(segment => Boolean(segment) && segment !== '.' && segment !== '..')

  if (normalizedSegments.length === 0) {
    throw new MyAiDriveValidationError('O caminho não pode ficar vazio.')
  }

  return `/${normalizedSegments.join('/')}`
}

function normalizeFile(input: Partial<MyAiDriveFile> | null | undefined): MyAiDriveFile | null {
  if (!input?.id || !input.name || !input.path) {
    return null
  }

  return {
    id: String(input.id).trim(),
    name: normalizeFileName(String(input.name)),
    path: normalizePath(String(input.path)),
    mimeType: input.mimeType ? String(input.mimeType).trim() : undefined,
    sizeBytes: typeof input.sizeBytes === 'number' ? Math.max(0, Math.trunc(input.sizeBytes)) : undefined,
    createdAt: input.createdAt ? String(input.createdAt).trim() : undefined,
    updatedAt: input.updatedAt ? String(input.updatedAt).trim() : undefined,
  }
}

function normalizeFolder(input: Partial<MyAiDriveFolder> | null | undefined): MyAiDriveFolder | null {
  if (!input?.id || !input.name || !input.path) {
    return null
  }

  return {
    id: String(input.id).trim(),
    name: normalizeFileName(String(input.name)),
    path: normalizePath(String(input.path)),
    parentId: input.parentId ? String(input.parentId).trim() : null,
    itemCount: typeof input.itemCount === 'number' ? Math.max(0, Math.trunc(input.itemCount)) : undefined,
    updatedAt: input.updatedAt ? String(input.updatedAt).trim() : undefined,
  }
}

export function normalizeSearchResult(
  input: Partial<MyAiDriveSearchResult> & { status?: MyAiDriveProviderStatus['status']; operation?: MyAiDriveSearchResult['operation'] },
): MyAiDriveSearchResult {
  return {
    status: input.status ?? 'not_configured',
    operation: input.operation ?? 'search_files',
    message: stripControlChars(String(input.message ?? 'My AI Drive ainda não está configurado.')).trim(),
    files: Array.isArray(input.files)
      ? input.files.map(file => normalizeFile(file)).filter((file): file is MyAiDriveFile => !!file)
      : [],
    folders: Array.isArray(input.folders)
      ? input.folders.map(folder => normalizeFolder(folder)).filter((folder): folder is MyAiDriveFolder => !!folder)
      : [],
    totalCount: typeof input.totalCount === 'number' ? Math.max(0, Math.trunc(input.totalCount)) : 0,
    nextCursor: input.nextCursor ? String(input.nextCursor).trim() : undefined,
  }
}
