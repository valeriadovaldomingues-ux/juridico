import type { MyAiDriveOperation } from './types'

export class MyAiDriveError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly operation?: MyAiDriveOperation,
  ) {
    super(message)
    this.name = 'MyAiDriveError'
  }
}

export class MyAiDriveAuthError extends MyAiDriveError {
  constructor(message = 'A integração My AI Drive exige autenticação válida.') {
    super('oauth_unauthorized', message, 401)
    this.name = 'MyAiDriveAuthError'
  }
}

export class MyAiDriveConfigError extends MyAiDriveError {
  constructor(message = 'A integração My AI Drive ainda não foi configurada.') {
    super('config_error', message, 500)
    this.name = 'MyAiDriveConfigError'
  }
}

export class MyAiDriveUnavailableError extends MyAiDriveError {
  constructor(message = 'My AI Drive ainda não está disponível nesta fase.') {
    super('not_configured', message, 501)
    this.name = 'MyAiDriveUnavailableError'
  }
}

export class MyAiDriveValidationError extends MyAiDriveError {
  constructor(message = 'Os dados enviados para o My AI Drive são inválidos.') {
    super('validation_error', message, 400)
    this.name = 'MyAiDriveValidationError'
  }
}

export function isMyAiDriveError(error: unknown): error is MyAiDriveError {
  return error instanceof MyAiDriveError
}
