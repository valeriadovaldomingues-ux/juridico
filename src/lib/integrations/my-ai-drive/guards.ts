import type { UserRole } from '@/types'
import { MyAiDriveError, MyAiDriveValidationError } from './errors'
import type {
  MyAiDriveOperation,
  MyAiDriveRequest,
} from './types'

const ALLOWED_OPERATIONS = new Set<MyAiDriveOperation>([
  'search_files',
  'list_folders',
  'get_file_metadata',
  'download_file',
  'upload_file',
])

function assertStringWithinLimit(value: string, maxLength: number, label: string): void {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new MyAiDriveValidationError(`Informe ${label}.`)
  }

  if (trimmed.length > maxLength) {
    throw new MyAiDriveValidationError(`${label} excede o limite permitido.`)
  }
}

export function assertMyAiDriveSocioAccess(role: UserRole | null | undefined): asserts role is 'socio' {
  if (role !== 'socio') {
    throw new MyAiDriveError('not_socios_only', 'A integração My AI Drive está restrita a sócios.', 403)
  }
}

export function assertKnownOperation(operation: string): asserts operation is MyAiDriveOperation {
  if (!ALLOWED_OPERATIONS.has(operation as MyAiDriveOperation)) {
    throw new MyAiDriveValidationError('Operação do My AI Drive desconhecida.')
  }
}

export function assertSafeSearchQuery(query: string): void {
  const normalized = query.replace(/[\u0000-\u001F\u007F]/g, '').trim()
  assertStringWithinLimit(normalized, 200, 'uma consulta válida')

  if (normalized.length < 2) {
    throw new MyAiDriveValidationError('Digite pelo menos 2 caracteres para pesquisar.')
  }
}

export function assertSafePath(path: string): void {
  const normalized = path.trim()
  assertStringWithinLimit(normalized, 500, 'um caminho válido')

  if (normalized.includes('..') || normalized.includes('\\') || normalized.includes('\0') || normalized.includes('://')) {
    throw new MyAiDriveValidationError('O caminho informado não é permitido.')
  }
}

export function assertSafeIdentifier(identifier: string, label = 'identificador'): void {
  const normalized = identifier.trim()
  assertStringWithinLimit(normalized, 200, `um ${label} válido`)

  if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) {
    throw new MyAiDriveValidationError(`O ${label} informado não é válido.`)
  }
}

export function assertMyAiDriveRequest(request: MyAiDriveRequest): void {
  assertMyAiDriveSocioAccess(request.role)
  assertKnownOperation(request.operation)
}
