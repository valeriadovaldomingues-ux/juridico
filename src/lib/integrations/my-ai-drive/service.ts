import type { UserRole } from '@/types'
import { MyAiDriveUnavailableError, MyAiDriveValidationError } from './errors'
import {
  assertMyAiDriveRequest,
  assertSafeIdentifier,
  assertSafePath,
  assertSafeSearchQuery,
} from './guards'
import { createMyAiDriveLogEntry } from './logs'
import { normalizeSearchResult } from './normalize'
import type {
  MyAiDriveAuthConfig,
  MyAiDriveDownloadRequest,
  MyAiDriveGetFileMetadataRequest,
  MyAiDriveListFoldersRequest,
  MyAiDriveProviderStatus,
  MyAiDriveSearchRequest,
  MyAiDriveSearchResult,
  MyAiDriveUploadRequest,
} from './types'

function createStubStatus(configured: boolean): MyAiDriveProviderStatus {
  return {
    status: configured ? 'stub' : 'not_configured',
    configured,
    message: configured
      ? 'My AI Drive em modo stub local. Integração real ainda não conectada.'
      : 'My AI Drive ainda não configurado.',
    checkedAt: new Date().toISOString(),
  }
}

function createStubResult(
  operation: MyAiDriveSearchResult['operation'],
  message: string,
  payload: Partial<MyAiDriveSearchResult> = {},
): MyAiDriveSearchResult {
  return normalizeSearchResult({
    status: 'not_configured',
    operation,
    message,
    files: payload.files ?? [],
    folders: payload.folders ?? [],
    totalCount: payload.totalCount ?? 0,
    nextCursor: payload.nextCursor ?? null,
  })
}

export class MyAiDriveService {
  constructor(private readonly config: Partial<MyAiDriveAuthConfig> = {}) {}

  getStatus(): MyAiDriveProviderStatus {
    return createStubStatus(Boolean(this.config.clientId || this.config.workspaceId || this.config.redirectUri))
  }

  async searchFiles(request: MyAiDriveSearchRequest): Promise<MyAiDriveSearchResult> {
    assertMyAiDriveRequest(request)
    assertSafeSearchQuery(request.query)
    if (request.folderPath) assertSafePath(request.folderPath)

    return createStubResult(
      'search_files',
      'My AI Drive ainda não está conectado. Resultado de stub retornado localmente.',
      { totalCount: 0 },
    )
  }

  async listFolders(request: MyAiDriveListFoldersRequest): Promise<MyAiDriveSearchResult> {
    assertMyAiDriveRequest(request)
    assertSafePath(request.folderPath)

    return createStubResult(
      'list_folders',
      'My AI Drive ainda não está conectado. Estrutura de pastas indisponível nesta fase.',
      { totalCount: 0 },
    )
  }

  async getFileMetadata(request: MyAiDriveGetFileMetadataRequest): Promise<MyAiDriveSearchResult> {
    assertMyAiDriveRequest(request)

    if (request.fileId) assertSafeIdentifier(request.fileId, 'identificador de arquivo')
    if (request.filePath) assertSafePath(request.filePath)
    if (!request.fileId && !request.filePath) {
      throw new MyAiDriveValidationError('Informe o arquivo que deseja consultar.')
    }

    return createStubResult(
      'get_file_metadata',
      'My AI Drive ainda não está conectado. Metadados indisponíveis nesta fase.',
      { totalCount: 0 },
    )
  }

  async downloadFile(request: MyAiDriveDownloadRequest): Promise<never> {
    assertMyAiDriveRequest(request)
    throw new MyAiDriveUnavailableError('download_file ainda não está implementado nesta fase.')
  }

  async uploadFile(request: MyAiDriveUploadRequest): Promise<never> {
    assertMyAiDriveRequest(request)
    throw new MyAiDriveUnavailableError('upload_file ainda não está implementado nesta fase.')
  }

  buildAuditLog(params: {
    operation: MyAiDriveSearchResult['operation'] | MyAiDriveDownloadRequest['operation'] | MyAiDriveUploadRequest['operation']
    status: 'success' | 'error' | 'blocked'
    userId?: string
    role?: UserRole | 'unknown'
    agentId?: string
    resourceId?: string
    resourcePath?: string
    query?: string
    resultCount?: number
    errorCode?: string
    errorMessage?: string
    metadata?: Record<string, unknown>
    timestamp?: string
  }) {
    return createMyAiDriveLogEntry({
      operation: params.operation,
      status: params.status,
      userId: params.userId,
      role: params.role,
      agentId: params.agentId,
      resourceId: params.resourceId,
      resourcePath: params.resourcePath,
      query: params.query,
      resultCount: params.resultCount,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      metadata: params.metadata,
      timestamp: params.timestamp,
      providerStatus: this.getStatus().status,
    })
  }
}

export const myAiDriveService = new MyAiDriveService()
