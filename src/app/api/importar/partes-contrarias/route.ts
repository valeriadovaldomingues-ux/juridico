import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'

// POST /api/importar/partes-contrarias
//
// Body: { rows: [{ numero_processo, parte_contraria }], simular?: boolean }
//
// - O processo é achado pelos DÍGITOS do número (aspas/pontos/traços diferentes entre o
//   EasyJur e o cadastro não atrapalham). Número que aparece em mais de um processo é recusado.
// - Só cadastra a parte contrária em processo que AINDA NÃO TEM uma (tipo 'reu'): nunca
//   duplica nem sobrescreve (função registrar_partes_contrarias — idempotente).
// - `simular: true` devolve o mesmo relatório SEM gravar nada.

interface InputRow {
  numero_processo: string
  parte_contraria: string
}

interface ResultadoLinha {
  linha: number
  numero_processo: string
  parte_contraria: string
  status: 'inserido' | 'ja_existia' | 'processo_nao_encontrado' | 'erro'
  mensagem: string
}

const soDigitos = (s: string) => s.replace(/\D/g, '')

async function lerTodos<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const todas: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data } = await pagina(de, de + 999)
    todas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return todas
}

export async function POST(request: NextRequest) {
  const auth = await apiGuard(['administrativo', 'advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  let rows: InputRow[]
  let simular = false
  try {
    const body = await request.json()
    if (!Array.isArray(body?.rows)) {
      return NextResponse.json({ error: 'Body deve conter { rows: [...] }' }, { status: 400 })
    }
    rows = body.rows
    simular = body.simular === true
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const linhas: ResultadoLinha[] = []
  const relatorio = {
    total: rows.length, inseridos: 0, ja_existiam: 0, processos_nao_encontrados: 0, erros: 0,
    simulacao: simular, linhas,
  }

  const validas = rows
    .map((r, i) => ({ numero: String(r.numero_processo ?? '').trim(), parte: String(r.parte_contraria ?? '').trim(), linha: i + 2 }))
    .filter(r => r.numero && r.parte)
  if (validas.length === 0) return NextResponse.json(relatorio)

  const supabase = await createClient()

  // Processos por dígitos do número (ambíguo = mais de um processo com o mesmo número)
  const processos = await lerTodos<{ id: string; numero_processo: string | null }>((de, ate) =>
    supabase.from('processos').select('id, numero_processo').order('id').range(de, ate))
  const porDigitos = new Map<string, string[]>()
  for (const p of processos) {
    const d = soDigitos(p.numero_processo ?? '')
    if (d.length >= 15) porDigitos.set(d, [...(porDigitos.get(d) ?? []), p.id])
  }

  // Processos que já têm parte contrária
  const comReu = new Set(
    (await lerTodos<{ processo_id: string }>((de, ate) =>
      supabase.from('partes_processo').select('processo_id').eq('tipo_parte', 'reu').order('id').range(de, ate)))
      .map(p => p.processo_id),
  )

  const pares: { processo_id: string; nome: string }[] = []
  const jaNoArquivo = new Set<string>()

  for (const r of validas) {
    const base = { linha: r.linha, numero_processo: r.numero, parte_contraria: r.parte }
    const d = soDigitos(r.numero)
    if (d.length < 15) {
      relatorio.erros++
      linhas.push({ ...base, status: 'erro', mensagem: 'Número de processo inválido (menos de 15 dígitos).' })
      continue
    }
    const ids = porDigitos.get(d)
    if (!ids) {
      relatorio.processos_nao_encontrados++
      linhas.push({ ...base, status: 'processo_nao_encontrado', mensagem: 'Processo não encontrado no sistema.' })
      continue
    }
    if (ids.length > 1) {
      relatorio.erros++
      linhas.push({ ...base, status: 'erro', mensagem: 'Número repetido em mais de um processo — não foi possível escolher.' })
      continue
    }
    const pid = ids[0]
    if (comReu.has(pid) || jaNoArquivo.has(pid)) {
      relatorio.ja_existiam++
      linhas.push({ ...base, status: 'ja_existia', mensagem: comReu.has(pid) ? 'Processo já tem parte contrária.' : 'Processo repetido no arquivo (usada a primeira linha).' })
      continue
    }
    jaNoArquivo.add(pid)
    pares.push({ processo_id: pid, nome: r.parte })
    relatorio.inseridos++
    linhas.push({ ...base, status: 'inserido', mensagem: simular ? 'Será cadastrada.' : 'Cadastrada.' })
  }

  if (!simular) {
    for (let i = 0; i < pares.length; i += 500) {
      const { error } = await supabase.rpc('registrar_partes_contrarias', { pares: pares.slice(i, i + 500) })
      if (error) {
        return NextResponse.json({ error: `Erro ao gravar: ${error.message}`, ...relatorio, inseridos: i }, { status: 500 })
      }
    }
  }

  return NextResponse.json(relatorio)
}
