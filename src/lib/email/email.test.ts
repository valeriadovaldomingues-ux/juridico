import { describe, expect, it } from 'vitest'
import { listaDeEmails, textoParaHtml } from './mailer'
import { montarEmailAudienciaMarcada, montarEmailPosAudiencia } from './templates'

describe('listaDeEmails', () => {
  it('separa válidos e inválidos, sem repetir', () => {
    const r = listaDeEmails('Ana@x.com; ana@x.com, joao@y.com.br , sem-arroba, @x.com')
    expect(r.validos).toEqual(['ana@x.com', 'joao@y.com.br'])
    expect(r.invalidos).toEqual(['sem-arroba', '@x.com'])
  })
})

describe('textoParaHtml', () => {
  it('escapa HTML e mantém parágrafos', () => {
    const h = textoParaHtml('Olá <b>\n\nSegundo & último')
    expect(h).toContain('Olá &lt;b&gt;')
    expect(h).toContain('Segundo &amp; último')
    expect(h.match(/<p /g)).toHaveLength(2)
  })
})

describe('montarEmailPosAudiencia', () => {
  const base = { clienteNome: 'Maria', numeroProcesso: '0001234-56.2026.5.03.0109', dataAudiencia: '2026-10-08', resumo: 'Acordo fechado.', advogadoNome: 'Débora Brito', temAnexo: true }

  it('lista as obrigações com valor e data e cita o anexo', () => {
    const e = montarEmailPosAudiencia({
      ...base,
      obrigacoes: [
        { titulo: 'Pagar a parcela 1', valor: 'R$ 1.000,00', data: '2026-11-10' },
        { titulo: 'Entregar as guias', dataTexto: 'em até 10 dias' },
      ],
    })
    expect(e.assunto).toBe('Processo 0001234-56.2026.5.03.0109 — Audiência de 08/10/2026: resumo e próximos passos')
    expect(e.corpo).toContain('1. Pagar a parcela 1 — valor: R$ 1.000,00 — até 10/11/2026.')
    expect(e.corpo).toContain('2. Entregar as guias — em até 10 dias.')
    expect(e.corpo).toContain('Segue em anexo a ata da audiência.')
    expect(e.corpo).toContain('Débora Brito\nPessoa e do Val Advocacia')
  })

  it('sem obrigações diz que não há providência; sem anexo não cita anexo', () => {
    const e = montarEmailPosAudiencia({ ...base, temAnexo: false, obrigacoes: [] })
    expect(e.corpo).toContain('não há nenhuma providência')
    expect(e.corpo).not.toContain('em anexo')
  })
})

describe('montarEmailAudienciaMarcada', () => {
  it('traz data, horário e local', () => {
    const e = montarEmailAudienciaMarcada({ clienteNome: 'Mult', numeroProcesso: null, data: '2026-11-09', hora: '09:00:00', local: 'Sala virtual https://x', advogadoNome: null })
    expect(e.assunto).toBe('Audiência marcada para 09/11/2026')
    expect(e.corpo).toContain('09/11/2026, às 09:00')
    expect(e.corpo).toContain('Local/link: Sala virtual https://x')
  })
})
