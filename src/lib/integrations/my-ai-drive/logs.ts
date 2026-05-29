import { normalizeFileName, normalizePath } from './normalize'
import type { MyAiDriveLogEntry, MyAiDriveOperation, MyAiDriveProviderStatus } from './types'

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): MyAiDriveLogEntry['metadata'] {
  if (!metadata) return undefined

  const sanitized: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (/token|secret|password|content|body|bytes|data|file/i.test(key)) continue
    if (typeof value === 'string') {
      sanitized[key] = value.trim().slice(0, 120)
      continue
    }
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      sanitized[key] = value
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

export function createMyAiDriveLogEntry(input: {
  operation: MyAiDriveOperation
  status: MyAiDriveLogEntry['status']
  userId?: string
  role?: MyAiDriveLogEntry['role']
  agentId?: string
  resourceId?: string
  resourcePath?: string
  query?: string
  resultCount?: number
  errorCode?: string
  errorMessage?: string
  metadata?: Record<string, unknown>
  providerStatus?: MyAiDriveProviderStatus['status']
  timestamp?: string
}): MyAiDriveLogEntry {
  return {
    operation: input.operation,
    status: input.status,
    timestamp: input.timestamp ?? new Date().toISOString(),
    userId: input.userId,
    role: input.role ?? 'unknown',
    agentId: input.agentId,
    resourceId: input.resourceId ? normalizeFileName(input.resourceId) : undefined,
    resourcePath: input.resourcePath ? normalizePath(input.resourcePath) : undefined,
    queryLength: typeof input.query === 'string' ? input.query.trim().length : undefined,
    resultCount: typeof input.resultCount === 'number' ? Math.max(0, Math.trunc(input.resultCount)) : undefined,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage ? input.errorMessage.trim().slice(0, 200) : undefined,
    metadata: sanitizeMetadata({
      ...input.metadata,
      providerStatus: input.providerStatus,
    }),
  }
}
