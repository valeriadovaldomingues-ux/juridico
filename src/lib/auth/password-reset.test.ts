import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  PASSWORD_RESET_GENERIC_MESSAGE,
  getPasswordResetRedirectTo,
  requestPasswordResetEmail,
  updatePasswordWithConfirmation,
  validateNewPassword,
} from './password-reset'

describe('password-reset', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
  })

  it('usa a origem local/IP local no redirect para funcionar fora de localhost', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.pessoaedoval.com.br'

    expect(getPasswordResetRedirectTo('http://192.168.1.210:3000')).toBe(
      'http://192.168.1.210:3000/redefinir-senha'
    )
    expect(getPasswordResetRedirectTo('http://localhost:3000')).toBe(
      'http://localhost:3000/redefinir-senha'
    )
  })

  it('usa NEXT_PUBLIC_APP_URL como redirect canônico fora de origem local', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.pessoaedoval.com.br/'

    expect(getPasswordResetRedirectTo('https://sistema.pessoaedoval.com.br')).toBe(
      'https://app.pessoaedoval.com.br/redefinir-senha'
    )
  })

  it('chama resetPasswordForEmail com redirect para /redefinir-senha e retorna mensagem genérica', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })

    const result = await requestPasswordResetEmail(
      { resetPasswordForEmail },
      ' socio@pessoaedoval.com.br ',
      'http://localhost:3000'
    )

    expect(resetPasswordForEmail).toHaveBeenCalledWith('socio@pessoaedoval.com.br', {
      redirectTo: 'http://localhost:3000/redefinir-senha',
    })
    expect(result).toEqual({ message: PASSWORD_RESET_GENERIC_MESSAGE, failed: false })
  })

  it('não revela erro do Supabase no pedido de recuperação', async () => {
    const resetPasswordForEmail = vi.fn().mockRejectedValue(new Error('User not found'))

    const result = await requestPasswordResetEmail(
      { resetPasswordForEmail },
      'nao-cadastrado@pessoaedoval.com.br',
      'http://localhost:3000'
    )

    expect(result.message).toBe(PASSWORD_RESET_GENERIC_MESSAGE)
    expect(result.failed).toBe(true)
  })

  it('trata error retornado por resetPasswordForEmail sem expor erro ao usuário', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({
      data: null,
      error: { name: 'AuthApiError', status: 400, message: 'Redirect URL not allowed' },
    })

    const result = await requestPasswordResetEmail(
      { resetPasswordForEmail },
      'socio@pessoaedoval.com.br',
      'http://192.168.1.210:3000'
    )

    expect(result.message).toBe(PASSWORD_RESET_GENERIC_MESSAGE)
    expect(result.failed).toBe(true)
    expect(result.error).toEqual({
      name: 'AuthApiError',
      status: 400,
      message: 'Redirect URL not allowed',
    })
  })

  it('valida senhas diferentes antes de chamar updateUser', async () => {
    const updateUser = vi.fn()

    const result = await updatePasswordWithConfirmation({ updateUser }, 'senha123', 'senha456')

    expect(result).toEqual({ ok: false, error: 'As senhas informadas não coincidem.' })
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('chama updateUser quando a nova senha é válida', async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null })

    const result = await updatePasswordWithConfirmation({ updateUser }, 'senha123', 'senha123')

    expect(updateUser).toHaveBeenCalledWith({ password: 'senha123' })
    expect(result).toEqual({ ok: true })
  })

  it('exige senha com pelo menos 6 caracteres', () => {
    expect(validateNewPassword('12345', '12345')).toBe('A nova senha deve ter pelo menos 6 caracteres.')
  })
})
