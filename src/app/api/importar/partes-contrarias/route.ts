import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiGuard } from '@/lib/auth/api-guard'

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

interface Relatorio {
  total: number
  inseridos: number
  ja_existiam: number
  processos_nao_encontrados: number
  erros: number
  linhas: ResultadoLinha[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normaliza nome para comparação: trim + lowercase */
function normNome(s: string): string {
  return s.trim().toLowerCase()
}

/** Normaliza número de processo para comparação: lowercase + sem espaços extras */
function normNumProc(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '')
}

/** Capitaliza cada palavra para armazenamento padronizado */
function titleCase(s: string): string {
  return s.trim().replace(/\w\S*/g, (w) =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  )
}

// ─── POST /api/importar/partes-contrarias ─────────────────────────────────────
//
// Body: { rows: Array<{ numero_processo: string; parte_contraria: string }> }
//
// Algoritmo (batch — evita query por linha):
//   1. Coleta todos os numero_processo únicos → busca processos em bloco
//   2. Coleta todos os nomes únicos de partes → upsert em `pessoas` em bloco
//   3. Busca pares (processo_id, pessoa_id) já existentes em partes_processo
//   4. Insere apenas os pares novos em batch
//
// Idempotente: rodar a mesma planilha N vezes NÃO duplica dados.

export async function POST(request: NextRequest) {

  // ── Autorização ──
  const auth = await apiGuard(['administrativo', 'advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  // ── Validação do body ──
  let rows: InputRow[]
  try {
    const body = await request.json()
    if (!Array.isArray(body?.rows)) {
      return NextResponse.json({ error: 'Body deve conter { rows: [...] }' }, { status: 400 })
    }
    rows = body.rows
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Filtra linhas vazias ou inválidas antes de processar
  const linhasValidas = rows
    .map((r, i) => ({ ...r, _linha: i + 2 }))
    .filter(r => r.numero_processo?.trim() && r.parte_contraria?.trim())

  const relatorio: Relatorio = {
    total: rows.length,
    inseridos: 0,
    ja_existiam: 0,
    processos_nao_encontrados: 0,
    erros: 0,
    linhas: [],
  }

  if (linhasValidas.length === 0) {
    return NextResponse.json(relatorio)
  }

  const supabase = await createClient()

  // ─── Passo 1: Buscar processos em bloco ──────────────────────────────────────

  const numerosUnicos = [...new Set(linhasValidas.map(r => r.numero_processo.trim()))]

  const { data: processosDB, error: errProcessos } = await supabase
    .from('processos')
    .select('id, numero_processo')
    .in('numero_processo', numerosUnicos)  // busca exata (índice); normalização feita no Map abaixo

  if (errProcessos) {
    return NextResponse.json({ error: `Erro ao buscar processos: ${errProcessos.message}` }, { status: 500 })
  }

  // Map: numero_processo → processo_id
  // Normalização: remove espaços e compara sem distinção de maiúsculas/minúsculas,
  // evitando falha por diferença de formatação entre CSV e banco (ex: espaços extras).
  const processoMap = new Map<string, string>(
    (processosDB ?? []).map(p => [normNumProc(p.numero_processo ?? ''), p.id])
  )

  // ─── Passo 2: Upsert pessoas em bloco ────────────────────────────────────────
  //
  // Para cada nome único (normalizado), encontra ou cria em `pessoas`.
  // Usa lower(trim(nome)) como chave de deduplicação (índice único no banco).

  const nomesUnicos = [
    ...new Set(linhasValidas.map(r => normNome(r.parte_contraria)))
  ]

  // Busca as que já existem usando o mesmo padrão de capitalização que o banco armazena
  // (titleCase). Supabase .in() é case-sensitive, então normalizar para o mesmo formato
  // garante que 'banco do brasil' encontre 'Banco Do Brasil' já gravado.
  const { data: pessoasExistentes } = await supabase
    .from('pessoas')
    .select('id, nome')
    .in('nome', nomesUnicos.map(titleCase))

  // Constrói mapa normNome → pessoa_id a partir das entradas já existentes no banco
  const pessoaMap = new Map<string, string>()

  for (const nomeNorm of nomesUnicos) {
    const existente = (pessoasExistentes ?? []).find(
      p => normNome(p.nome) === nomeNorm
    )
    if (existente) {
      pessoaMap.set(nomeNorm, existente.id)
    }
  }

  // Cria os que não existem (em batch)
  const nomesParaCriar = nomesUnicos.filter(n => !pessoaMap.has(n))

  if (nomesParaCriar.length > 0) {
    const novasPessoas = nomesParaCriar.map(n => ({
      nome: titleCase(n), // armazena com capitalização padronizada
    }))

    const { data: criadas, error: errCriacao } = await supabase
      .from('pessoas')
      .insert(novasPessoas)
      .select('id, nome')

    if (errCriacao) {
      // Conflito de unicidade — pode acontecer em corridas paralelas.
      // Re-busca os que falharam.
      const { data: reFetch } = await supabase
        .from('pessoas')
        .select('id, nome')
        .in('nome', nomesParaCriar.map(n => titleCase(n)))

      for (const p of reFetch ?? []) {
        pessoaMap.set(normNome(p.nome), p.id)
      }
    } else {
      for (const p of criadas ?? []) {
        pessoaMap.set(normNome(p.nome), p.id)
      }
    }
  }

  // ─── Passo 3: Verificar pares já existentes em partes_processo ───────────────

  const processoIds  = [...new Set([...processoMap.values()])]
  const pessoaIds    = [...new Set([...pessoaMap.values()])]

  let paresExistentes = new Set<string>() // "processo_id|pessoa_id"

  if (processoIds.length > 0 && pessoaIds.length > 0) {
    const { data: existentes } = await supabase
      .from('partes_processo')
      .select('processo_id, pessoa_id')
      .in('processo_id', processoIds)
      .in('pessoa_id', pessoaIds)

    for (const e of existentes ?? []) {
      if (e.pessoa_id) {
        paresExistentes.add(`${e.processo_id}|${e.pessoa_id}`)
      }
    }
  }

  // ─── Passo 4: Montar inserts e processar cada linha ──────────────────────────

  const novosRegistros: {
    processo_id: string
    pessoa_id: string
    pessoa_nome: string
    tipo_parte: string
  }[] = []

  for (const row of linhasValidas) {
    const numProc   = row.numero_processo.trim()
    const nomeNorm  = normNome(row.parte_contraria)
    const processoId = processoMap.get(normNumProc(numProc))
    const pessoaId   = pessoaMap.get(nomeNorm)

    if (!processoId) {
      relatorio.processos_nao_encontrados++
      relatorio.linhas.push({
        linha:           row._linha,
        numero_processo: numProc,
        parte_contraria: row.parte_contraria.trim(),
        status:          'processo_nao_encontrado',
        mensagem:        `Processo "${numProc}" não encontrado no sistema`,
      })
      continue
    }

    if (!pessoaId) {
      relatorio.erros++
      relatorio.linhas.push({
        linha:           row._linha,
        numero_processo: numProc,
        parte_contraria: row.parte_contraria.trim(),
        status:          'erro',
        mensagem:        `Não foi possível criar a pessoa "${row.parte_contraria.trim()}"`,
      })
      continue
    }

    const parKey = `${processoId}|${pessoaId}`

    if (paresExistentes.has(parKey)) {
      relatorio.ja_existiam++
      relatorio.linhas.push({
        linha:           row._linha,
        numero_processo: numProc,
        parte_contraria: row.parte_contraria.trim(),
        status:          'ja_existia',
        mensagem:        `"${row.parte_contraria.trim()}" já é parte do processo "${numProc}"`,
      })
      continue
    }

    // Marca como existente para evitar duplicação dentro do mesmo batch
    paresExistentes.add(parKey)

    novosRegistros.push({
      processo_id: processoId,
      pessoa_id:   pessoaId,
      pessoa_nome: titleCase(row.parte_contraria),
      tipo_parte:  'reu',
    })

    relatorio.linhas.push({
      linha:           row._linha,
      numero_processo: numProc,
      parte_contraria: titleCase(row.parte_contraria),
      status:          'inserido',
      mensagem:        `"${titleCase(row.parte_contraria)}" vinculada ao processo "${numProc}"`,
    })
  }

  // ─── Passo 5: Insert batch ────────────────────────────────────────────────────

  if (novosRegistros.length > 0) {
    const { error: errInsert } = await supabase
      .from('partes_processo')
      .insert(novosRegistros)

    if (errInsert) {
      // Se houver conflito de unicidade (corrida paralela), trata linha a linha
      if (errInsert.code === '23505') {
        // Todas as que teriam gerado conflito já existiam — reconta como ja_existiam
        relatorio.linhas = relatorio.linhas.map(l =>
          l.status === 'inserido'
            ? { ...l, status: 'ja_existia' as const, mensagem: l.mensagem.replace('vinculada', 'já vinculada (conflito)') }
            : l
        )
        relatorio.ja_existiam += novosRegistros.length
      } else {
        // Erro genérico — marca tudo como erro
        relatorio.erros += novosRegistros.length
        relatorio.linhas = relatorio.linhas.map(l =>
          l.status === 'inserido'
            ? { ...l, status: 'erro' as const, mensagem: `Erro ao inserir: ${errInsert.message}` }
            : l
        )
      }
    } else {
      relatorio.inseridos = novosRegistros.length
    }
  }

  // Linhas ignoradas por campos vazios
  const ignoradas = rows.length - linhasValidas.length
  if (ignoradas > 0) {
    relatorio.erros += ignoradas
  }

  return NextResponse.json(relatorio)
}
