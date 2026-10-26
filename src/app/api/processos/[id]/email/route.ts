import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isUUID } from '@/lib/portal/validate'
import { emailConfigurado, enviarEmail, listaDeEmails, textoParaHtml } from '@/lib/email/mailer'
import { montarEmailLivre } from '@/lib/email/templates'
import { copiaObrigatoria, juntarCopias } from '@/lib/email/copia'

// E-mail avulso ao cliente do processo — a qualquer momento, sem depender de ata.
// GET: rascunho (saudação + assinatura) e histórico; POST: envia o que o advogado escreveu e registra.
const PAPEIS = ['administrativo', 'advogado', 'gerente', 'socio'] as const
const MAX_ANEXOS = 5
const MAX_BYTES = 15 * 1024 * 1024

async function carregar(id: string, userId: string) {
  const supabase = await createClient()
  const { data: processo } = await supabase
    .from('processos')
    .select('id, cliente_id, titulo, numero_processo, advogado_responsavel_id, advogado_caso_id, cliente:clientes!cliente_id(nome, email)')
    .eq('id', id).maybeSingle()
  if (!processo) return null
  const cliente = (Array.isArray(processo.cliente) ? processo.cliente[0] : processo.cliente) as { nome?: string; email?: string | null } | null
  const { data: advogado } = await createServiceClient()
    .from('profiles').select('nome, email')
    .eq('id', processo.advogado_caso_id ?? processo.advogado_responsavel_id ?? userId).maybeSingle()
  return { supabase, processo, cliente, advogado }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard([...PAPEIS])
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!isUUID(id)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  const ctx = await carregar(id, auth.userId)
  if (!ctx) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })

  const rascunho = montarEmailLivre({
    clienteNome: ctx.cliente?.nome ?? 'cliente',
    numeroProcesso: ctx.processo.numero_processo ?? null,
    advogadoNome: ctx.advogado?.nome ?? null,
  })
  const { data: enviados } = await ctx.supabase
    .from('emails_cliente')
    .select('id, enviado_em, para, assunto, status')
    .eq('processo_id', id).order('enviado_em', { ascending: false }).limit(8)

  const { copias, erro: erroCopia } = await copiaObrigatoria(ctx.processo.advogado_responsavel_id ?? null, auth.userId, ctx.processo.advogado_caso_id ?? null)
  return NextResponse.json({
    para: ctx.cliente?.email ? [ctx.cliente.email] : [],
    cc: [],
    cc_obrigatorios: copias,
    erro_copia: erroCopia ?? null,
    assunto: rascunho.assunto,
    corpo: rascunho.corpo,
    smtp_configurado: emailConfigurado(),
    enviados: enviados ?? [],
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard([...PAPEIS])
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!isUUID(id)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  if (!emailConfigurado()) {
    return NextResponse.json({ error: 'O envio de e-mail ainda não foi ligado (falta configurar a caixa do escritório). Copie o texto e envie pelo seu e-mail por enquanto.' }, { status: 503 })
  }

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  const para = listaDeEmails(String(form.get('para') ?? ''))
  const cc = listaDeEmails(String(form.get('cc') ?? ''))
  const assunto = String(form.get('assunto') ?? '').trim()
  const corpo = String(form.get('corpo') ?? '').trim()
  if (para.invalidos.length || cc.invalidos.length) {
    return NextResponse.json({ error: `E-mail inválido: ${[...para.invalidos, ...cc.invalidos].join(', ')}` }, { status: 400 })
  }
  if (para.validos.length === 0) return NextResponse.json({ error: 'Informe o e-mail do cliente (campo "Para").' }, { status: 400 })
  if (para.validos.length + cc.validos.length + 2 > 10) return NextResponse.json({ error: 'Muitos destinatários (máx. 10).' }, { status: 400 })
  if (!assunto || !corpo) return NextResponse.json({ error: 'Assunto e texto são obrigatórios.' }, { status: 400 })

  const arquivos = form.getAll('anexos').filter((f): f is File => f instanceof File && f.size > 0)
  if (arquivos.length > MAX_ANEXOS) return NextResponse.json({ error: `Máximo de ${MAX_ANEXOS} anexos.` }, { status: 400 })
  if (arquivos.reduce((a, f) => a + f.size, 0) > MAX_BYTES) return NextResponse.json({ error: 'Os anexos passam de 15 MB no total.' }, { status: 400 })
  const anexos = await Promise.all(arquivos.map(async f => ({ filename: f.name, content: Buffer.from(await f.arrayBuffer()) })))

  const ctx = await carregar(id, auth.userId)
  if (!ctx) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })

  // O advogado responsável e quem envia sempre vão em cópia (decidido aqui, não no formulário).
  const obrig = await copiaObrigatoria(ctx.processo.advogado_responsavel_id ?? null, auth.userId, ctx.processo.advogado_caso_id ?? null)
  if (obrig.erro) return NextResponse.json({ error: obrig.erro }, { status: 400 })
  const ccFinal = juntarCopias(obrig.copias.map(c => c.email), cc.validos, para.validos)

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
    console.error('[email processo]', err)
  }

  await ctx.supabase.from('emails_cliente').insert({
    tipo: 'andamento', processo_id: id, cliente_id: ctx.processo.cliente_id ?? null,
    para: para.validos, cc: ccFinal, assunto, corpo,
    anexos: anexos.map(a => ({ nome: a.filename })),
    status: erro ? 'erro' : 'enviado', erro, message_id: messageId, enviado_por: auth.userId,
  })

  if (erro) return NextResponse.json({ error: `Não foi possível enviar: ${erro}` }, { status: 502 })
  return NextResponse.json({ ok: true })
}
