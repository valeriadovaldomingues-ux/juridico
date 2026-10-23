import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isUUID } from '@/lib/portal/validate'
import { CENTRAL_ARQUIVOS_BUCKET } from '@/lib/central-arquivos/types'
import { emailConfigurado, enviarEmail, listaDeEmails, textoParaHtml } from '@/lib/email/mailer'
import { montarEmailPosAudiencia } from '@/lib/email/templates'
import { copiaObrigatoria, juntarCopias } from '@/lib/email/copia'

const PAPEIS = ['administrativo', 'advogado', 'gerente', 'socio'] as const

async function carregar(id: string, ataId: string, userId: string) {
  const supabase = await createClient()
  const { data: ata } = await supabase
    .from('atas_audiencia')
    .select('id, data_audiencia, resumo, arquivo_path, arquivo_nome, obrigacoes_cliente')
    .eq('id', ataId).eq('processo_id', id).maybeSingle()
  if (!ata) return null

  const { data: processo } = await supabase
    .from('processos')
    .select('id, cliente_id, titulo, numero_processo, advogado_responsavel_id, cliente:clientes!cliente_id(nome, email)')
    .eq('id', id).maybeSingle()
  if (!processo) return null

  const cliente = (Array.isArray(processo.cliente) ? processo.cliente[0] : processo.cliente) as { nome?: string; email?: string | null } | null

  // E-mail e nome do advogado do processo (ou, sem advogado definido, de quem está enviando).
  const service = createServiceClient()
  const { data: advogado } = await service
    .from('profiles').select('nome, email')
    .eq('id', processo.advogado_responsavel_id ?? userId).maybeSingle()

  const { data: enviados } = await supabase
    .from('emails_cliente')
    .select('id, enviado_em, para, status')
    .eq('ata_id', ataId).order('enviado_em', { ascending: false })

  return { supabase, service, ata, processo, cliente, advogado, enviados: enviados ?? [] }
}

// GET — rascunho pronto para revisar (nada é enviado aqui).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; ataId: string }> }) {
  const auth = await apiGuard([...PAPEIS])
  if (auth instanceof NextResponse) return auth
  const { id, ataId } = await params
  if (!isUUID(id) || !isUUID(ataId)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })

  const ctx = await carregar(id, ataId, auth.userId)
  if (!ctx) return NextResponse.json({ error: 'Ata não encontrada.' }, { status: 404 })

  const rascunho = montarEmailPosAudiencia({
    clienteNome: ctx.cliente?.nome ?? 'cliente',
    numeroProcesso: ctx.processo.numero_processo ?? null,
    dataAudiencia: ctx.ata.data_audiencia,
    resumo: ctx.ata.resumo,
    obrigacoes: (ctx.ata.obrigacoes_cliente ?? []) as never[],
    advogadoNome: ctx.advogado?.nome ?? null,
    temAnexo: !!ctx.ata.arquivo_path,
  })

  const { copias, erro: erroCopia } = await copiaObrigatoria(ctx.processo.advogado_responsavel_id ?? null, auth.userId)
  return NextResponse.json({
    para: ctx.cliente?.email ? [ctx.cliente.email] : [],
    cc: [],
    cc_obrigatorios: copias,
    erro_copia: erroCopia ?? null,
    assunto: rascunho.assunto,
    corpo: rascunho.corpo,
    anexo: ctx.ata.arquivo_path ? { nome: ctx.ata.arquivo_nome } : null,
    smtp_configurado: emailConfigurado(),
    enviados: ctx.enviados,
  })
}

// POST — envia o e-mail já revisado pelo advogado e registra o envio.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; ataId: string }> }) {
  const auth = await apiGuard([...PAPEIS])
  if (auth instanceof NextResponse) return auth
  const { id, ataId } = await params
  if (!isUUID(id) || !isUUID(ataId)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })

  if (!emailConfigurado()) {
    return NextResponse.json({ error: 'O envio de e-mail ainda não foi ligado (falta configurar a caixa do escritório). Copie o texto e envie pelo seu e-mail por enquanto.' }, { status: 503 })
  }

  const body = await req.json().catch(() => null)
  const para = listaDeEmails(body?.para)
  const cc = listaDeEmails(body?.cc)
  const assunto = String(body?.assunto ?? '').trim()
  const corpo = String(body?.corpo ?? '').trim()
  if (para.invalidos.length || cc.invalidos.length) {
    return NextResponse.json({ error: `E-mail inválido: ${[...para.invalidos, ...cc.invalidos].join(', ')}` }, { status: 400 })
  }
  if (para.validos.length === 0) return NextResponse.json({ error: 'Informe o e-mail do cliente (campo "Para").' }, { status: 400 })
  if (para.validos.length + cc.validos.length + 2 > 10) return NextResponse.json({ error: 'Muitos destinatários (máx. 10).' }, { status: 400 })
  if (!assunto || !corpo) return NextResponse.json({ error: 'Assunto e texto são obrigatórios.' }, { status: 400 })

  const ctx = await carregar(id, ataId, auth.userId)
  if (!ctx) return NextResponse.json({ error: 'Ata não encontrada.' }, { status: 404 })

  // O advogado responsável e quem envia sempre vão em cópia (decidido aqui, não no formulário).
  const obrig = await copiaObrigatoria(ctx.processo.advogado_responsavel_id ?? null, auth.userId)
  if (obrig.erro) return NextResponse.json({ error: obrig.erro }, { status: 400 })
  const ccFinal = juntarCopias(obrig.copias.map(c => c.email), cc.validos, para.validos)

  const anexos: { filename: string; content: Buffer }[] = []
  if (body?.incluir_anexo !== false && ctx.ata.arquivo_path) {
    const { data: arquivo, error } = await ctx.service.storage.from(CENTRAL_ARQUIVOS_BUCKET).download(ctx.ata.arquivo_path)
    if (error || !arquivo) return NextResponse.json({ error: 'Não consegui abrir o arquivo da ata para anexar. Desmarque o anexo ou tente de novo.' }, { status: 502 })
    anexos.push({ filename: ctx.ata.arquivo_nome ?? 'ata-audiencia', content: Buffer.from(await arquivo.arrayBuffer()) })
  }

  let erro: string | null = null
  let messageId: string | null = null
  try {
    const r = await enviarEmail({
      to: para.validos, cc: ccFinal, replyTo: ctx.advogado?.email ?? undefined, remetenteNome: ctx.advogado?.nome ?? undefined,
      subject: assunto, text: corpo, html: textoParaHtml(corpo), attachments: anexos,
    })
    messageId = r.messageId
  } catch (err) {
    erro = err instanceof Error ? err.message : 'Falha no envio.'
    console.error('[email ata]', err)
  }

  await ctx.supabase.from('emails_cliente').insert({
    tipo: 'ata', processo_id: id, cliente_id: ctx.processo.cliente_id ?? null, ata_id: ataId,
    para: para.validos, cc: ccFinal, assunto, corpo,
    anexos: anexos.map(a => ({ nome: a.filename })),
    status: erro ? 'erro' : 'enviado', erro, message_id: messageId, enviado_por: auth.userId,
  })

  if (erro) return NextResponse.json({ error: `Não foi possível enviar: ${erro}` }, { status: 502 })
  return NextResponse.json({ ok: true })
}
