// E-mails do portal. Nunca lançam: se o SMTP não estiver configurado, não envia e segue.

import type { Db } from './db'
import { emailConfigurado, enviarEmail, textoParaHtml } from '@/lib/email/mailer'
import { CODIGO_VALIDADE_MS } from './constantes'

/** Envia o código ao e-mail de acesso LIBERADO pelo escritório. Retorna true se saiu. */
export async function enviarCodigoPorEmail(para: string, codigo: string): Promise<boolean> {
  if (!emailConfigurado()) return false
  const minutos = Math.round(CODIGO_VALIDADE_MS / 60000)
  const texto = [
    'Olá!',
    `Seu código de acesso ao Portal do Cliente da Pessoa e do Val Advocacia é:\n\n${codigo}`,
    `Ele vale por ${minutos} minutos e só pode ser usado uma vez. Se você não pediu este código, pode ignorar esta mensagem: ninguém entra no portal sem ele.`,
    'Por segurança, o escritório nunca pede este código por telefone, WhatsApp ou e-mail.',
    'Atenciosamente,\nPessoa e do Val Advocacia',
  ].join('\n\n')
  try {
    await enviarEmail({ to: [para], subject: 'Seu código de acesso ao Portal do Cliente', text: texto, html: textoParaHtml(texto) })
    return true
  } catch {
    return false
  }
}

/** Aviso resumido aos sócios sobre pedido novo (sem dados do solicitante além do final do documento). */
export async function avisarSociosDoPedido(db: Db, documentoParcial: string): Promise<void> {
  try {
    const { data } = await db.from('profiles').select('email').eq('role', 'socio').eq('ativo', true)
    const destinos = [...new Set((data ?? []).map(p => (p.email as string | null)?.trim().toLowerCase()).filter((e): e is string => !!e))]
    if (!destinos.length || !emailConfigurado()) return
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''
    const texto = [
      'Chegou um novo pedido de primeiro acesso ao Portal do Cliente.',
      `Documento informado: ${documentoParcial}.`,
      `Veja e decida em: ${base}/clientes/acesso-portal`,
      'Antes de aprovar, confirme com o cliente por telefone ou WhatsApp.',
    ].join('\n\n')
    await enviarEmail({ to: destinos, subject: 'Portal do Cliente: novo pedido de acesso', text: texto, html: textoParaHtml(texto) })
  } catch {
    // silencioso
  }
}
