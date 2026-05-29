import type { FerramentasPdfErrorCode } from './types'

export class FerramentasPdfError extends Error {
  constructor(
    public code: FerramentasPdfErrorCode,
    message: string,
    public status: number = 400,
  ) {
    super(message)
    this.name = 'FerramentasPdfError'
  }
}

export function isFerramentasPdfError(error: unknown): error is FerramentasPdfError {
  return error instanceof FerramentasPdfError
}
