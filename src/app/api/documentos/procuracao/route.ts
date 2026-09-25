import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { gerarPecaPdfBytes } from '@/lib/documentos-pecas/pdf'
import { corpoProcuracao } from '@/lib/documentos-pecas/procuracao'
import { camposFaltantesPF, type ClienteQualificacao } from '@/lib/documentos-pecas/qualificacao'

function slugify(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'documento'
}

function hojeExtenso() {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  const d = new Date()
  return `Belo Horizonte, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}.`
}

export async function GET(req: NextRequest) {
  const auth = await apiGuard(['advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  const poderes    = req.nextUrl.searchParams.get('poderes') ?? undefined
  if (!clienteId) return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 })

  const supabase = await createClient()

  // Campos de qualificação soltos na querystring (rg/nacionalidade/estado_civil/profissao):
  // se vierem preenchidos, atualiza o cadastro do cliente antes de gerar — assim só precisa
  // informar uma vez.
  const patch: Record<string, string> = {}
  for (const campo of ['rg', 'nacionalidade', 'estado_civil', 'profissao'] as const) {
    const valor = req.nextUrl.searchParams.get(campo)
    if (valor) patch[campo] = valor
  }
  if (Object.keys(patch).length > 0) {
    await supabase.from('clientes').update(patch).eq('id', clienteId)
  }

  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('nome, tipo_pessoa, cpf_cnpj, rg, nacionalidade, estado_civil, profissao, socio_representante, endereco, numero, complemento, bairro, cidade, uf, cep')
    .eq('id', clienteId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

  const c = cliente as ClienteQualificacao
  if (c.tipo_pessoa !== 'pj') {
    const faltando = camposFaltantesPF(c)
    if (faltando.length > 0) {
      return NextResponse.json({ error: `Faltam dados do cliente: ${faltando.join(', ')}`, camposFaltantes: faltando }, { status: 422 })
    }
  }

  const bytes = await gerarPecaPdfBytes({
    titulo:     'PROCURAÇÃO',
    paragrafos: [corpoProcuracao(c, poderes)],
    localData:  hojeExtenso(),
    assinantes: [{ nome: c.nome }],
  })

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="procuracao-${slugify(c.nome)}.pdf"`,
      'cache-control': 'no-store',
    },
  })
}
