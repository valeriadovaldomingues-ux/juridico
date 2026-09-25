import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { createClient } from '@/lib/supabase/server'
import {
  corpoReciboAdvogado, corpoReciboBeneficio, corpoReciboEstagiario, corpoReciboFuncionario,
  gerarReciboPdfBytes, type DadosPessoais, type TipoBeneficio,
} from '@/lib/recibos/pdf'

function slugify(value: string) {
  return value
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 80) || 'recibo'
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  const { profileId } = await params
  const mes = req.nextUrl.searchParams.get('mes')
  const parte = req.nextUrl.searchParams.get('parte') as TipoBeneficio | 'resto' | null

  if (!profileId || !mes) return NextResponse.json({ error: 'profileId e mes são obrigatórios' }, { status: 400 })

  const supabase = await createClient()

  const [{ data: dadosRow }, { data: folha }] = await Promise.all([
    supabase.from('funcionarios_dados_pessoais').select('*').eq('profile_id', profileId).maybeSingle(),
    supabase.from('folha_pagamento').select('*').eq('profile_id', profileId).eq('mes_referencia', mes).maybeSingle(),
  ])

  if (!dadosRow) return NextResponse.json({ error: 'Dados pessoais não cadastrados — complete CPF/RG/endereço antes de gerar o recibo.' }, { status: 400 })
  if (!folha) return NextResponse.json({ error: 'Folha de pagamento não encontrada para esse mês.' }, { status: 404 })
  if (!dadosRow.cpf || !dadosRow.endereco) {
    return NextResponse.json({ error: 'Faltam dados pessoais (CPF ou endereço) — complete antes de gerar o recibo.' }, { status: 400 })
  }

  const dados: DadosPessoais = {
    nomeCompleto:  dadosRow.nome_completo,
    nacionalidade: dadosRow.nacionalidade,
    estadoCivil:   dadosRow.estado_civil,
    cpf:           dadosRow.cpf,
    rg:            dadosRow.rg,
    oabNumero:     dadosRow.oab_numero,
    oabSecao:      dadosRow.oab_secao,
    endereco:      dadosRow.endereco,
  }

  const total = Number(folha.total ?? 0)
  let corpo: string
  let sufixoArquivo = ''

  if (dadosRow.tipo_recibo === 'advogado') {
    corpo = corpoReciboAdvogado(dados, total, mes)
  } else if (dadosRow.tipo_recibo === 'estagiario') {
    corpo = corpoReciboEstagiario(dados, total, mes)
  } else if (dadosRow.tipo_recibo === 'funcionario_dividido' && (parte === 'transporte' || parte === 'alimentacao')) {
    const valor = parte === 'transporte' ? Number(folha.transporte) : Number(folha.alimentacao)
    corpo = corpoReciboBeneficio(dados, valor, mes, parte)
    sufixoArquivo = `-${parte}`
  } else if (dadosRow.tipo_recibo === 'funcionario_dividido') {
    const resto = Number(folha.salario_base) + Number(folha.extra) + Number(folha.partido_3_5) + Number(folha.partido_20)
      + Number(folha.gratificacao) + Number(folha.ferias_um_terco) - Number(folha.desconto) - Number(folha.adiantamento)
    corpo = corpoReciboFuncionario(dados, resto, mes)
    sufixoArquivo = '-funcionarios-e-terceiros'
  } else {
    corpo = corpoReciboFuncionario(dados, total, mes)
  }

  const bytes = await gerarReciboPdfBytes({ corpo, nomeAssinante: dados.nomeCompleto, mesReferencia: mes })
  const filename = `recibo-${slugify(dados.nomeCompleto)}-${mes}${sufixoArquivo}`

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}.pdf"`,
      'cache-control': 'no-store',
    },
  })
}
