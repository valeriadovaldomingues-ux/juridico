import type { ClienteContatoFormValues, ClienteContatoWriteInput } from './types'

export class ClienteContatoValidationError extends Error {
  constructor(
    message: string,
    public field?: keyof ClienteContatoFormValues,
  ) {
    super(message)
    this.name = 'ClienteContatoValidationError'
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function normalizeBool(value: unknown) {
  return Boolean(value)
}

export function normalizeClienteContatoInput(input: Partial<ClienteContatoFormValues>): ClienteContatoWriteInput {
  return {
    nome: normalizeText(input.nome),
    cargo: normalizeText(input.cargo),
    area_responsavel: normalizeText(input.area_responsavel),
    celular: normalizeText(input.celular),
    email: normalizeText(input.email),
    observacoes: normalizeText(input.observacoes),
    contato_principal: normalizeBool(input.contato_principal),
    ativo: input.ativo === undefined ? true : normalizeBool(input.ativo),
    recebe_juridico: normalizeBool(input.recebe_juridico),
    recebe_financeiro: normalizeBool(input.recebe_financeiro),
    recebe_documentos: normalizeBool(input.recebe_documentos),
    recebe_comunicados: normalizeBool(input.recebe_comunicados),
  }
}

export function validateClienteContatoInput(input: ClienteContatoWriteInput) {
  if (!input.nome) {
    throw new ClienteContatoValidationError('Informe o nome do contato.', 'nome')
  }

  if (input.email && !EMAIL_RE.test(input.email)) {
    throw new ClienteContatoValidationError('E-mail inválido.', 'email')
  }

  const digits = input.celular.replace(/\D/g, '')
  if (input.celular && digits.length < 10) {
    throw new ClienteContatoValidationError('Celular/WhatsApp inválido.', 'celular')
  }

  return input
}
