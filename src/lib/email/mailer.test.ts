import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn()
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) }
})
vi.mock('nodemailer', () => ({ default: { createTransport } }))

import { emailConfigurado, enviarEmail } from './mailer'

const VARS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'] as const
const guardadas: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const v of VARS) { guardadas[v] = process.env[v]; delete process.env[v] }
  sendMail.mockReset(); createTransport.mockClear()
})
afterEach(() => {
  for (const v of VARS) { if (guardadas[v] === undefined) delete process.env[v]; else process.env[v] = guardadas[v] }
})

describe('emailConfigurado / enviarEmail', () => {
  it('sem SMTP configurado, não envia e avisa', async () => {
    expect(emailConfigurado()).toBe(false)
    await expect(enviarEmail({ to: ['a@b.com'], subject: 's', text: 't' })).rejects.toThrow(/SMTP/)
    expect(createTransport).not.toHaveBeenCalled()
  })

  it('com SMTP, usa SSL na porta 465 e envia com anexo e cópia', async () => {
    Object.assign(process.env, { SMTP_HOST: 'mail.exemplo.com', SMTP_PORT: '465', SMTP_USER: 'pedv@x.com', SMTP_PASSWORD: 'segredo', SMTP_FROM: 'Escritório <pedv@x.com>' })
    sendMail.mockResolvedValue({ messageId: '<id-1>' })
    expect(emailConfigurado()).toBe(true)
    const r = await enviarEmail({ to: ['cliente@c.com'], cc: ['adv@x.com'], replyTo: 'adv@x.com', subject: 'Assunto', text: 'Corpo', attachments: [{ filename: 'ata.docx', content: Buffer.from('x') }] })
    expect(r.messageId).toBe('<id-1>')
    expect(createTransport).toHaveBeenCalledWith({ host: 'mail.exemplo.com', port: 465, secure: true, auth: { user: 'pedv@x.com', pass: 'segredo' } })
    const msg = sendMail.mock.calls[0][0]
    expect(msg).toMatchObject({ from: 'Escritório <pedv@x.com>', to: ['cliente@c.com'], cc: ['adv@x.com'], replyTo: 'adv@x.com', subject: 'Assunto' })
    expect(msg.attachments[0].filename).toBe('ata.docx')
  })

  it('mostra o nome do advogado no remetente, mas envia pela caixa do escritório', async () => {
    Object.assign(process.env, { SMTP_HOST: 'h', SMTP_PORT: '465', SMTP_USER: 'u', SMTP_PASSWORD: 'p', SMTP_FROM: 'Pessoa e do Val <pedv@x.com>' })
    sendMail.mockResolvedValue({ messageId: 'x' })
    await enviarEmail({ to: ['a@b.com'], subject: 's', text: 't', remetenteNome: 'Débora Brito' })
    expect(sendMail.mock.calls[0][0].from).toEqual({ name: 'Débora Brito — Pessoa e do Val Advocacia', address: 'pedv@x.com' })
  })

  it('porta 587 não usa SSL direto (STARTTLS)', async () => {
    Object.assign(process.env, { SMTP_HOST: 'h', SMTP_PORT: '587', SMTP_USER: 'u', SMTP_PASSWORD: 'p', SMTP_FROM: 'f@x.com' })
    sendMail.mockResolvedValue({ messageId: 'x' })
    await enviarEmail({ to: ['a@b.com'], subject: 's', text: 't' })
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 587, secure: false }))
  })
})
