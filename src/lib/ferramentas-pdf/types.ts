import type { UserRole } from '@/types'

export const FERRAMENTAS_PDF_ALLOWED_ROLES = [
  'socio',
  'gerente',
  'advogado',
  'administrativo',
  'estagiario',
  'comercial',
] as const

export type FerramentasPdfAllowedRole = typeof FERRAMENTAS_PDF_ALLOWED_ROLES[number]

export type FerramentasPdfToolName =
  | 'merge'
  | 'split'
  | 'remove-pages'
  | 'rotate'
  | 'reorder'
  | 'image-to-pdf'
  | 'compress'

export type FerramentasPdfReadOnlyToolName = Exclude<FerramentasPdfToolName, 'compress'>

export type FerramentasPdfErrorCode =
  | 'invalid_file'
  | 'empty_file'
  | 'file_too_large'
  | 'too_many_files'
  | 'corrupted_pdf'
  | 'invalid_pages'
  | 'invalid_rotation'
  | 'operation_not_available'
  | 'not_socios_only'
  | 'approval_missing'
  | 'unauthorized'

export interface FerramentasPdfApprovalContext {
  required: boolean
  approved: boolean
  approvalId?: string
  approvedByUserId?: string
  approvedAt?: string
  reason?: string
}

export interface FerramentasPdfAuditLog {
  requestId: string
  userId: string
  role: UserRole
  tool: FerramentasPdfReadOnlyToolName
  status: 'success' | 'error' | 'blocked'
  sourceFiles: string[]
  outputFile?: string
  approval: FerramentasPdfApprovalContext
  errorCode?: FerramentasPdfErrorCode
  errorMessage?: string
  createdAt: string
  durationMs: number
}

export interface FerramentasPdfActionResult {
  bytes: Uint8Array
  filename: string
  pageCount: number
  notice?: string | null
  originalBytes?: number
  optimizedBytes?: number
  usedOriginal?: boolean
}

export interface FerramentasPdfRequestBase {
  tool: FerramentasPdfReadOnlyToolName
}

export interface FerramentasPdfMergeRequest extends FerramentasPdfRequestBase {
  tool: 'merge'
  files: File[]
}

export interface FerramentasPdfSplitRequest extends FerramentasPdfRequestBase {
  tool: 'split'
  file: File
  intervalo: string
}

export interface FerramentasPdfRemovePagesRequest extends FerramentasPdfRequestBase {
  tool: 'remove-pages'
  file: File
  paginas: string
}

export interface FerramentasPdfRotateRequest extends FerramentasPdfRequestBase {
  tool: 'rotate'
  file: File
  rotacao: 90 | 180 | 270
}

export interface FerramentasPdfReorderRequest extends FerramentasPdfRequestBase {
  tool: 'reorder'
  file: File
  ordem: string
}

export interface FerramentasPdfImageToPdfRequest extends FerramentasPdfRequestBase {
  tool: 'image-to-pdf'
  files: File[]
}

export type FerramentasPdfRequest =
  | FerramentasPdfMergeRequest
  | FerramentasPdfSplitRequest
  | FerramentasPdfRemovePagesRequest
  | FerramentasPdfRotateRequest
  | FerramentasPdfReorderRequest
  | FerramentasPdfImageToPdfRequest
