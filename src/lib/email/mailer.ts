import nodemailer from 'nodemailer'

// Envio pela caixa do escritório (HostGator) via SMTP. Configuração só por variáveis de ambiente
// (Vercel): SMTP_HOST, SMTP_PORT (465 = SSL; 587 = STARTTLS), SMTP_USER, SMTP_PASSWORD e
// SMTP_FROM (ex.: "Pessoa e do Val Advocacia <pedv@pessoaedoval.com.br>"). Nunca no código.

export function emailConfigurado(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM)
}

const EMAIL_RE = /^[^\s@<>()[\],;:]+@[^\s@<>()[\],;:]+\.[^\s@<>()[\],;:]+$/

export function emailValido(valor: string): boolean {
  return EMAIL_RE.test(valor.trim())
}

/** Aceita lista separada por vírgula/ponto e vírgula; devolve só endereços válidos e sem repetição. */
export function listaDeEmails(entrada: string | string[] | null | undefined): { validos: string[]; invalidos: string[] } {
  const itens = (Array.isArray(entrada) ? entrada : String(entrada ?? '').split(/[;,\n]/))
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  const validos: string[] = []
  const invalidos: string[] = []
  for (const e of itens) {
    if (!emailValido(e)) invalidos.push(e)
    else if (!validos.includes(e)) validos.push(e)
  }
  return { validos, invalidos }
}

export interface EmailSaida {
  to: string[]
  cc?: string[]
  replyTo?: string
  /** Nome de quem assina (advogado). O endereço continua sendo o da caixa do escritório. */
  remetenteNome?: string
  subject: string
  text: string
  html?: string
  attachments?: { filename: string; content: Buffer }[]
}

/** "Nome <a@b.com>" → "a@b.com". */
function enderecoDe(valor: string): string {
  const m = valor.match(/<([^>]+)>/)
  return (m ? m[1] : valor).trim()
}

export async function enviarEmail(msg: EmailSaida): Promise<{ messageId: string }> {
  if (!emailConfigurado()) throw new Error('O envio de e-mail ainda não foi configurado (SMTP).')
  const porta = Number(process.env.SMTP_PORT ?? 465)
  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: porta,
    secure: porta === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  })
  // O servidor só aceita enviar pela caixa autenticada; o nome do advogado aparece como remetente
  // e as respostas vão para o e-mail dele (replyTo).
  const from = msg.remetenteNome
    ? { name: `${msg.remetenteNome} — Pessoa e do Val Advocacia`, address: enderecoDe(process.env.SMTP_FROM as string) }
    : process.env.SMTP_FROM
  const info = await transporte.sendMail({
    from,
    to: msg.to,
    cc: msg.cc?.length ? msg.cc : undefined,
    replyTo: msg.replyTo,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
    attachments: msg.attachments,
  })
  return { messageId: info.messageId }
}

/** Texto simples → HTML simples (parágrafos e quebras de linha), com escape. */
export function textoParaHtml(texto: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1a1d23">${
    texto.split(/\n{2,}/).map(par => `<p style="margin:0 0 12px">${esc(par).replace(/\n/g, '<br>')}</p>`).join('')
  }</div>`
}
