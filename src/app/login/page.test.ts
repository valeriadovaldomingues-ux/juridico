import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('LoginPage', () => {
  it('exibe link para recuperação de senha', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/login/page.tsx'), 'utf8')

    expect(source).toContain('Esqueci minha senha')
    expect(source).toContain('href="/esqueci-senha"')
  })

  it('mantém redirecionamento pós-login relativo ao host atual', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/login/page.tsx'), 'utf8')

    expect(source).toContain("router.push(redirect)")
    expect(source).not.toContain('NEXT_PUBLIC_APP_URL')
    expect(source).not.toContain('localhost:3000')
  })

  it('registra erro de signInWithPassword em development sem registrar senha', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/login/page.tsx'), 'utf8')

    expect(source).toContain('signInWithPassword')
    expect(source).toContain("console.error('[auth] Falha no login por senha.'")
    expect(source).toContain('sanitizeAuthError(error)')
    const logBlock = source.slice(
      source.indexOf("console.error('[auth] Falha no login por senha.'"),
      source.indexOf("setError('E-mail ou senha incorretos.')")
    )
    expect(logBlock).not.toContain('password')
  })
})
