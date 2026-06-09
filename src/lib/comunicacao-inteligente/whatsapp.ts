import type { ComunicacaoInteligenteDraft } from './types'

export interface WhatsAppDestinatario {
  id?: string
  nome: string
  telefone: string
  origem: 'cliente' | 'contato'
}

export function normalizeWhatsAppTelefone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}

export function isWhatsAppTelefoneValido(value: string) {
  const digits = normalizeWhatsAppTelefone(value)
  return digits.length >= 12
}

export function buildWhatsAppMensagem(comunicacao: Pick<
  ComunicacaoInteligenteDraft,
  'titulo' | 'mensagemCliente' | 'resumoExecutivo' | 'oQueAconteceu' | 'oQueIssoSignifica' | 'proximosPassos' | 'acaoNecessariaCliente'
>) {
  const blocos = [
    comunicacao.titulo ? `Assunto: ${comunicacao.titulo}` : null,
    comunicacao.mensagemCliente?.trim() || null,
    comunicacao.resumoExecutivo ? `Resumo executivo:\n${comunicacao.resumoExecutivo}` : null,
    comunicacao.oQueAconteceu ? `O que aconteceu:\n${comunicacao.oQueAconteceu}` : null,
    comunicacao.oQueIssoSignifica ? `O que isso significa:\n${comunicacao.oQueIssoSignifica}` : null,
    comunicacao.proximosPassos?.length
      ? `Próximos passos:\n${comunicacao.proximosPassos.map(item => `- ${item}`).join('\n')}`
      : null,
    comunicacao.acaoNecessariaCliente ? `Ação necessária do cliente:\n${comunicacao.acaoNecessariaCliente}` : null,
  ].filter(Boolean)

  return blocos.join('\n\n').trim()
}

export function buildWhatsAppUrl(telefone: string, mensagem: string) {
  const normalizado = normalizeWhatsAppTelefone(telefone)
  if (!normalizado) return ''
  return `https://wa.me/${normalizado}?text=${encodeURIComponent(mensagem)}`
}
