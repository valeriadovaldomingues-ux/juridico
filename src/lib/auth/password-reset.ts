export const PASSWORD_RESET_GENERIC_MESSAGE =
  'Se este e-mail estiver cadastrado, enviaremos instruções para redefinir sua senha.'

const DEFAULT_LOCAL_URL = 'http://localhost:3000'

type ResetPasswordAuth = {
  resetPasswordForEmail: (
    email: string,
    options: { redirectTo: string }
  ) => Promise<{ data?: unknown; error?: AuthErrorLike | null }>
}

type UpdatePasswordAuth = {
  updateUser: (attributes: { password: string }) => Promise<{ error?: { message?: string } | null }>
}

export type AuthErrorLike = {
  name?: string
  status?: number
  message?: string
}

export type SanitizedAuthError = {
  name: string
  status?: number
  message: string
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function isLocalOrPrivateOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    )
  } catch {
    return false
  }
}

export function getPasswordResetRedirectTo(currentOrigin?: string): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  const origin = currentOrigin?.trim()

  const baseUrl =
    origin && isLocalOrPrivateOrigin(origin)
      ? normalizeBaseUrl(origin)
      : envUrl
        ? normalizeBaseUrl(envUrl)
        : origin
          ? normalizeBaseUrl(origin)
          : DEFAULT_LOCAL_URL

  return `${baseUrl}/redefinir-senha`
}

export function sanitizeAuthError(error: unknown): SanitizedAuthError {
  if (error && typeof error === 'object') {
    const candidate = error as AuthErrorLike
    return {
      name: candidate.name ?? 'AuthError',
      status: candidate.status,
      message: candidate.message ?? 'Erro de autenticação sem mensagem.',
    }
  }

  return {
    name: 'AuthError',
    message: 'Erro de autenticação desconhecido.',
  }
}

export async function requestPasswordResetEmail(
  auth: ResetPasswordAuth,
  email: string,
  currentOrigin?: string
): Promise<{ message: string; failed: boolean; error?: SanitizedAuthError }> {
  try {
    const { error } = await auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getPasswordResetRedirectTo(currentOrigin),
    })

    if (error) {
      return {
        message: PASSWORD_RESET_GENERIC_MESSAGE,
        failed: true,
        error: sanitizeAuthError(error),
      }
    }

    return { message: PASSWORD_RESET_GENERIC_MESSAGE, failed: false }
  } catch (error) {
    return {
      message: PASSWORD_RESET_GENERIC_MESSAGE,
      failed: true,
      error: sanitizeAuthError(error),
    }
  }
}

export function validateNewPassword(password: string, confirmPassword: string): string | null {
  if (password.length < 6) return 'A nova senha deve ter pelo menos 6 caracteres.'
  if (password !== confirmPassword) return 'As senhas informadas não coincidem.'
  return null
}

export async function updatePasswordWithConfirmation(
  auth: UpdatePasswordAuth,
  password: string,
  confirmPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validationError = validateNewPassword(password, confirmPassword)
  if (validationError) return { ok: false, error: validationError }

  const { error } = await auth.updateUser({ password })
  if (error) {
    return {
      ok: false,
      error: 'Não foi possível redefinir a senha. Solicite um novo link e tente novamente.',
    }
  }

  return { ok: true }
}
