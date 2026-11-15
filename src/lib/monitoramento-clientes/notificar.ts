// ─── E-mail-resumo dos alertas de clientes monitorados ──────────────────────
//
// UM e-mail por rodada, agrupado por cliente, para os sócios ativos. Alertas
// ainda sem `avisado_em` (inclusive de rodadas em que o e-mail falhou ou o SMTP
// não estava configurado) entram na próxima rodada. Falha de e-mail nunca
// derruba o cron: vira retorno com `enviado: false`.

import type { SupabaseClient } from '@supabase/supabase-js'
import { dataBR, formatarNumeroCNJ } from './formatar'
import { emailConfigurado, enviarEmail, listaDeEmails, textoParaHtml, type EmailSaida } from '@/lib/email/mailer'

export interface AlertaParaEmail {
  id: string
  numero_processo: string
  tribunal: string | null
  orgao: string | null
  polo: string | null
  tipo_comunicacao: string | null
  data_disponibilizacao: string | null
  link: string | null
  possivel_homonimo: boolean
  cliente: string
}

export interface ResultadoNotificacao {
  enviado: boolean
  alertas: number
  destinatarios: number
  motivo?: string
}

const MAX_ALERTAS_POR_EMAIL = 200

function rotuloPolo(polo: string | null): string {
  if (polo === 'P') return 'POLO PASSIVO (réu)'
  if (polo === 'A') return 'polo ativo (autor)'
  return 'polo não informado'
}

/** Texto e assunto do resumo (puro, testável). */
export function montarEmailResumo(alertas: AlertaParaEmail[]): { subject: string; text: string } {
  const porCliente = new Map<string, AlertaParaEmail[]>()
  for (const a of alertas) porCliente.set(a.cliente, [...(porCliente.get(a.cliente) ?? []), a])

  const total = alertas.length
  const subject = `Clientes monitorados: ${total} processo${total === 1 ? '' : 's'} novo${total === 1 ? '' : 's'} sem cadastro`

  const blocos: string[] = [
    `O monitoramento do DJEN encontrou ${total} processo${total === 1 ? '' : 's'} envolvendo clientes monitorados que ainda não ${total === 1 ? 'está cadastrado' : 'estão cadastrados'} no sistema.`,
  ]
  for (const [cliente, lista] of [...porCliente].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))) {
    const linhas = lista.map(a => [
      `• ${formatarNumeroCNJ(a.numero_processo)} — ${a.tribunal ?? 'tribunal não informado'}${a.orgao ? ` (${a.orgao})` : ''}`,
      `  ${rotuloPolo(a.polo)} · ${a.tipo_comunicacao ?? 'comunicação'} · disponibilizado em ${dataBR(a.data_disponibilizacao)}`,
      a.possivel_homonimo ? '  Atenção: cliente pessoa física, a busca é só pelo nome — pode ser homônimo.' : null,
      a.link ? `  ${a.link}` : null,
    ].filter(Boolean).join('\n'))
    blocos.push(`${cliente}\n${linhas.join('\n')}`)
  }
  blocos.push('Confira e dê o tratamento em Monitoramento › Clientes monitorados (marque como visto, descartado ou "já cadastrei o processo").')
  return { subject, text: blocos.join('\n\n') }
}

export interface OpcoesNotificar {
  supabase: SupabaseClient
  enviar?: (msg: EmailSaida) => Promise<unknown>
  configurado?: () => boolean
}

export async function notificarAlertasPendentes(opcoes: OpcoesNotificar): Promise<ResultadoNotificacao> {
  const { supabase } = opcoes
  const configurado = opcoes.configurado ?? emailConfigurado
  const enviar = opcoes.enviar ?? enviarEmail

  const { data, error } = await supabase
    .from('monitoramento_alertas')
    .select('id, numero_processo, tribunal, orgao, polo, tipo_comunicacao, data_disponibilizacao, link, possivel_homonimo, monitoramento:monitoramento_documentos(nome_principal)')
    .eq('status', 'novo')
    .eq('classificacao', 'novo_processo')
    .is('avisado_em', null)
    .order('created_at', { ascending: true })
    .limit(MAX_ALERTAS_POR_EMAIL)
  if (error) return { enviado: false, alertas: 0, destinatarios: 0, motivo: `Falha ao ler alertas pendentes: ${error.message}` }

  type Linha = Omit<AlertaParaEmail, 'cliente'> & { monitoramento: { nome_principal: string } | Array<{ nome_principal: string }> | null }
  const alertas: AlertaParaEmail[] = ((data ?? []) as unknown as Linha[]).map(l => {
    const mon = Array.isArray(l.monitoramento) ? l.monitoramento[0] : l.monitoramento
    return {
      id: l.id, numero_processo: l.numero_processo, tribunal: l.tribunal, orgao: l.orgao, polo: l.polo,
      tipo_comunicacao: l.tipo_comunicacao, data_disponibilizacao: l.data_disponibilizacao, link: l.link,
      possivel_homonimo: l.possivel_homonimo, cliente: mon?.nome_principal ?? 'Cliente',
    }
  })
  if (alertas.length === 0) return { enviado: false, alertas: 0, destinatarios: 0, motivo: 'Sem alertas pendentes de aviso.' }

  if (!configurado()) return { enviado: false, alertas: alertas.length, destinatarios: 0, motivo: 'SMTP não configurado; os alertas seguem pendentes de aviso.' }

  const { data: perfis, error: erroPerfis } = await supabase
    .from('profiles')
    .select('email')
    .eq('role', 'socio')
    .eq('ativo', true)
  if (erroPerfis) return { enviado: false, alertas: alertas.length, destinatarios: 0, motivo: `Falha ao ler sócios: ${erroPerfis.message}` }

  const { validos } = listaDeEmails(((perfis ?? []) as Array<{ email: string | null }>).map(p => p.email ?? ''))
  if (validos.length === 0) return { enviado: false, alertas: alertas.length, destinatarios: 0, motivo: 'Nenhum sócio ativo com e-mail válido.' }

  const { subject, text } = montarEmailResumo(alertas)
  try {
    await enviar({ to: validos, subject, text, html: textoParaHtml(text) })
  } catch (e) {
    return { enviado: false, alertas: alertas.length, destinatarios: validos.length, motivo: `Falha no envio: ${e instanceof Error ? e.message : String(e)}` }
  }

  const { error: erroMarca } = await supabase
    .from('monitoramento_alertas')
    .update({ avisado_em: new Date().toISOString() })
    .in('id', alertas.map(a => a.id))
  return {
    enviado: true,
    alertas: alertas.length,
    destinatarios: validos.length,
    ...(erroMarca ? { motivo: `E-mail enviado, mas não foi possível marcar avisado_em: ${erroMarca.message}` } : {}),
  }
}
