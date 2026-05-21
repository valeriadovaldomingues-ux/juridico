import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('LoginPage', () => {
  it('exibe link para recuperação de senha', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/login/page.tsx'), 'utf8')

    expect(source).toContain('Esqueci minha senha')
    expect(source).toContain('href="/esqueci-senha"')
  })
})
