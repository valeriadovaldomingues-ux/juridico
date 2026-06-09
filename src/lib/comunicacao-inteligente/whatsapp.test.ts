import { describe, expect, it } from 'vitest'
import { buildWhatsAppMensagem, buildWhatsAppUrl, isWhatsAppTelefoneValido, normalizeWhatsAppTelefone } from './whatsapp'

describe('whatsapp helpers', () => {
  it('normaliza telefone brasileiro para formato wa.me', () => {
    expect(normalizeWhatsAppTelefone('(11) 99999-8888')).toBe('5511999998888')
    expect(normalizeWhatsAppTelefone('5511999998888')).toBe('5511999998888')
    expect(isWhatsAppTelefoneValido('(11) 99999-8888')).toBe(true)
  })

  it('monta mensagem sem observacoes internas', () => {
    const mensagem = buildWhatsAppMensagem({
      titulo: 'Atualização do processo',
      mensagemCliente: 'Mensagem ao cliente.',
      resumoExecutivo: 'Resumo simples.',
      oQueAconteceu: 'Houve movimentação.',
      oQueIssoSignifica: 'O escritório vai acompanhar.',
      proximosPassos: ['Aguardar intimação'],
      acaoNecessariaCliente: 'Nenhuma providência é necessária neste momento.',
      observacoesInternas: 'Segredo interno',
    } as never)

    expect(mensagem).toContain('Assunto: Atualização do processo')
    expect(mensagem).toContain('Mensagem ao cliente.')
    expect(mensagem).not.toContain('Segredo interno')
  })

  it('gera link wa.me', () => {
    expect(buildWhatsAppUrl('11999998888', 'Olá mundo')).toBe('https://wa.me/5511999998888?text=Ol%C3%A1%20mundo')
  })
})
