import type { UserRole } from '@/types'

export type MyAiDriveOperation =
  | 'search_files'
  | 'list_folders'
  | 'get_file_metadata'
  | 'download_file'
  | 'upload_file'

export interface MyAiDriveFile {
  id: string
  name: string
  path: string
  mimeType?: string
  sizeBytes?: number
  createdAt?: string
  updatedAt?: string
}

export interface MyAiDriveFolder {
  id: string
  name: string
  path: string
  parentId?: string | null
  itemCount?: number
  updatedAt?: string
}

export interface MyAiDriveSearchResult {
  status: MyAiDriveProviderStatus['status']
  operation: Exclude<MyAiDriveOperation, 'download_file' | 'upload_file'>
  message: string
  files: MyAiDriveFile[]
  folders: MyAiDriveFolder[]
  totalCount: number
  nextCursor?: string | null
}

export interface MyAiDriveAuthConfig {
  workspaceId?: string
  clientId?: string
  redirectUri?: string
  scopes?: string[]
}

export interface MyAiDriveProviderStatus {
  status: 'not_configured' | 'stub' | 'ready' | 'unavailable'
  configured: boolean
  message: string
  checkedAt: string
}

export interface MyAiDriveLogEntry {
  operation: MyAiDriveOperation
  status: 'success' | 'error' | 'blocked'
  timestamp: string
  userId?: string
  role?: UserRole | 'unknown'
  agentId?: string
  resourceId?: string
  resourcePath?: string
  queryLength?: number
  resultCount?: number
  errorCode?: string
  errorMessage?: string
  metadata?: Record<string, string | number | boolean | null>
}

export interface MyAiDriveRequest {
  operation: MyAiDriveOperation
  role: UserRole | null | undefined
  userId?: string
  agentId?: string
}

export interface MyAiDriveSearchRequest extends MyAiDriveRequest {
  operation: 'search_files'
  query: string
  folderPath?: string
  limit?: number
}

export interface MyAiDriveListFoldersRequest extends MyAiDriveRequest {
  operation: 'list_folders'
  folderPath: string
}

export interface MyAiDriveGetFileMetadataRequest extends MyAiDriveRequest {
  operation: 'get_file_metadata'
  fileId?: string
  filePath?: string
}

export interface MyAiDriveDownloadRequest extends MyAiDriveRequest {
  operation: 'download_file'
  fileId: string
}

export interface MyAiDriveUploadRequest extends MyAiDriveRequest {
  operation: 'upload_file'
  fileName: string
  mimeType: string
  sizeBytes: number
}
