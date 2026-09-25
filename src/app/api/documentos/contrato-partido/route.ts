import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import { gerarPecaPdfBytes, type Assinante } from '@/lib/documentos-pecas/pdf'
import {
  corpoContratoPartido, camposFaltantesContratante,
  type ContratanteQualificacao,
} from '@/lib/documentos-pecas/contrato-partido'

function slugify(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'contrato'
}

const SELECT_CLIENTE = 'id, nome, tipo_pessoa, cpf_cnpj, rg, nacionalidade, estado_civil, profissao, endereco, numero, complemento, bairro, cidade, uf, cep'

export async function GET(req: NextRequest) {
  const auth = await apiGuard(['advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const params = req.nextUrl.searchParams
  const clienteIds = (params.get('cliente_ids') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const dataInicioStr = params.get('data_inicio')
  const salariosMinimosStr = params.get('salarios_minimos')

  if (clienteIds.length === 0) return NextResponse.json({ error: 'Selecione ao menos 1 cliente' }, { status: 400 })
  if (!dataInicioStr) return NextResponse.json({ error: 'data_inicio é obrigatório' }, { status: 400 })
  if (!salariosMinimosStr) return NextResponse.json({ error: 'salarios_minimos é obrigatório' }, { status: 400 })

  const salariosMinimos = Number(salariosMinimosStr.replace(',', '.'))
  if (!Number.isFinite(salariosMinimos) || salariosMinimos <= 0) {
    return NextResponse.json({ error: 'salarios_minimos inválido' }, { status: 400 })
  }

  const representante = params.get('representante')?.trim() || undefined
  if (clienteIds.length > 1 && !representante) {
    return NextResponse.json({ error: 'Informe quem representa os contratantes (representante)' }, { status: 400 })
  }

  const diaPagamento    = params.get('dia_pagamento') ? Number(params.get('dia_pagamento')) : undefined
  const percentualExito = params.get('percentual_exito') ? Number(params.get('percentual_exito')) : undefined
  const anoParcelaExtra = params.get('ano_parcela_extra') ? Number(params.get('ano_parcela_extra')) : undefined

  const supabase = await createClient()

  const { data: clientesRaw, error } = await supabase.from('clientes').select(SELECT_CLIENTE).in('id', clienteIds)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const porId = new Map((clientesRaw ?? []).map(c => [c.id, c as ContratanteQualificacao & { id: string }]))
  const faltando404 = clienteIds.filter(id => !porId.has(id))
  if (faltando404.length > 0) return NextResponse.json({ error: `Cliente(s) não encontrado(s): ${faltando404.join(', ')}` }, { status: 404 })

  const contratantes = clienteIds.map(id => porId.get(id)!)

  const camposFaltantesPorCliente: Record<string, string[]> = {}
  for (const c of contratantes) {
    const faltando = camposFaltantesContratante(c)
    if (faltando.length > 0) camposFaltantesPorCliente[c.nome] = faltando
  }
  if (Object.keys(camposFaltantesPorCliente).length > 0) {
    return NextResponse.json({
      error: 'Faltam dados de qualificação de um ou mais contratantes',
      camposFaltantesPorCliente,
    }, { status: 422 })
  }

  const dataInicio = new Date(dataInicioStr + 'T00:00:00')
  if (Number.isNaN(dataInicio.getTime())) return NextResponse.json({ error: 'data_inicio inválida' }, { status: 400 })

  const { paragrafos, localData, nomeAssinanteContratante } = corpoContratoPartido({
    contratantes,
    representante,
    dataInicio,
    salariosMinimos,
    diaPagamento,
    percentualExito,
    anoParcelaExtra: anoParcelaExtra ?? null,
  })

  const plural = contratantes.length > 1
  const assinantes: Assinante[] = plural
    ? [
        { nome: nomeAssinanteContratante, linha2: 'Pelos Contratantes' },
        { nome: 'PESSOA E DO VAL ADVOCACIA', linha2: 'Contratado' },
      ]
    : [{ nome: 'CONTRATANTE' }, { nome: 'CONTRATADO' }]

  const bytes = await gerarPecaPdfBytes({
    titulo: 'CONTRATO DE HONORÁRIOS',
    tituloEspacado: false,
    paragrafos,
    localData,
    assinantes,
    testemunhas: true,
  })

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="contrato-honorarios-${slugify(contratantes[0].nome)}.pdf"`,
      'cache-control': 'no-store',
    },
  })
}
