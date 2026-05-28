import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SECURITY_MESSAGE } from './IntegracoesProcessuaisPage'

describe('/configuracoes/integracoes-processuais', () => {
  it('mantem aviso de seguranca obrigatorio', () => {
    expect(SECURITY_MESSAGE).toBe(
      'Este sistema não automatiza login em tribunais, certificado digital, gov.br, jus.br ou MFA. Para atos processuais, use sempre o sistema oficial do tribunal.',
    )
  })

  it('nao expoe campos de senha, token ou certificado na tela', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/(dashboard)/configuracoes/integracoes-processuais/IntegracoesProcessuaisPage.tsx'), 'utf8')

    expect(source).not.toMatch(/type=["']password["']/i)
    expect(source).not.toMatch(/placeholder=["'][^"']*(senha|token|certificado|cookie|mfa)/i)
    expect(source).not.toContain('JUSBRASIL_API_TOKEN')
  })
})
