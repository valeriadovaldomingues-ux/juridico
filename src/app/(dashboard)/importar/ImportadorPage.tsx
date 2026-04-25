'use client'

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import {
  Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle,
  AlertTriangle, Users, Scale, ChevronRight, Loader2, RotateCcw, UserX, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import CsvJuridicoImporter from './CsvJuridicoImporter'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TipoImportacao = 'clientes' | 'processos' | 'partes_contrarias' | 'csv_juridico'
type RowStatus = 'ok' | 'erro' | 'aviso' | 'duplicado'

interface ParteContrariaRow {
  _linha: number
  _status: RowStatus
  _erros: string[]
  numero_processo: string
  parte_contraria: string
}

interface ClienteRow {
  _linha: number
  _status: RowStatus
  _erros: string[]
  nome: string
  cpf_cnpj: string
  telefone: string
  email: string
  tipo_pessoa?: string
}

interface ProcessoRow {
  _linha: number
  _status: RowStatus
  _erros: string[]
  _rawRow: Record<string, string> // linha original normalizada — usada na re-detecção durante import
  numero_processo: string
  titulo: string
  vara: string
  tribunal: string
  status: string
  area_direito: string
  cliente: string // nome detectado no parse (pode ser '' se coluna não reconhecida)
}

interface LogImportacao {
  total: number
  inseridos: number
  duplicados: number
  erros: number
  detalhes: { linha: number; mensagem: string; tipo: 'erro' | 'aviso' | 'ok' }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_VALIDOS = ['ativo', 'suspenso', 'arquivado', 'encerrado']
const AREA_VALIDAS = ['civil', 'trabalhista', 'criminal', 'tributario', 'previdenciario', 'administrativo', 'familia', 'empresarial', 'outro']

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')                    // remove BOM (arquivos Excel gerados no Windows)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')           // remove acentos
    .trim()
    .replace(/[\s\u00a0]+/g, '_')              // espaço normal e non-breaking → underscore
    .replace(/[^a-z0-9_]/g, '')               // remove caracteres não-alfanuméricos
    .replace(/^_+|_+$/g, '')                  // remove underscores no início/fim
}

function parseSheet(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
          defval: '',
          raw: false,
        })
        // normaliza cabeçalhos
        const normalized = rows.map((row) => {
          const out: Record<string, string> = {}
          for (const key of Object.keys(row)) {
            out[normalizeHeader(key)] = String(row[key] ?? '').trim()
          }
          return out
        })
        resolve(normalized)
      } catch {
        reject(new Error('Não foi possível ler o arquivo. Verifique se é .xlsx ou .csv válido.'))
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'))
    reader.readAsArrayBuffer(file)
  })
}

function str(v: string | undefined) { return (v ?? '').trim() }

// Tenta múltiplos aliases no row (já com chaves normalizadas)
function pick(row: Record<string, string>, ...aliases: string[]): string {
  for (const alias of aliases) {
    const key = normalizeHeader(alias)
    if (row[key] !== undefined && row[key] !== '') return str(row[key])
  }
  return ''
}

// ─── Validações ───────────────────────────────────────────────────────────────

function validarClienteRow(row: Record<string, string>, linha: number): ClienteRow {
  const erros: string[] = []

  const nome = pick(row, 'nome', 'nome_completo', 'razao_social', 'empresa')
  const cpf_cnpj = pick(row, 'cpf_cnpj', 'cpf', 'cnpj', 'documento')
  const telefone = pick(row, 'telefone', 'celular', 'fone', 'tel')
  const email = pick(row, 'email', 'e-mail', 'email_contato')
  const tipo_pessoa = pick(row, 'tipo_pessoa', 'tipo')

  if (!nome) erros.push('Nome obrigatório')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.push('E-mail inválido')

  return {
    _linha: linha,
    _status: erros.length > 0 ? 'erro' : 'ok',
    _erros: erros,
    nome,
    cpf_cnpj,
    telefone,
    email,
    tipo_pessoa: tipo_pessoa || 'fisica',
  }
}

// Aliases para número do processo (normalizados pelo normalizeHeader)
const ALIASES_NUMERO_PROCESSO = [
  'numero_processo',
  'numero processo',
  'número do processo',
  'numero do processo',
  'numero',
  'numeroProcesso',
  'processo',
  'proc',
  'nro_processo',
  'nr_processo',
  'n_processo',
]

// Aliases para cliente — todos normalizados via normalizeHeader no momento da comparação.
// IMPORTANTE: NÃO incluir aliases de parte contrária aqui (parte_contraria, parte_adversa,
// reclamado, requerido, executado) — eles têm fluxo próprio de importação e NÃO devem
// criar registros em `clientes`.
const ALIASES_CLIENTE = [
  // genéricos
  'cliente', 'nome_cliente', 'nome_do_cliente', 'nome do cliente', 'nome',
  // trabalhista (polo ativo — quem contratou o escritório)
  'reclamante', 'parte', 'autor',
  // cível / geral (polo ativo)
  'requerente', 'exequente', 'polo_ativo', 'polo ativo',
  // empresarial
  'empresa', 'razao_social', 'razão social', 'contratante',
  // outros
  'credor', 'litisconsorte',
  'cpf_cnpj_cliente', 'cpf_cliente',
]

// Fragmentos de palavras para fallback fuzzy: detecta qualquer coluna cujo nome
// CONTENHA um desses fragmentos (após normalização).
const CLIENTE_KEYWORDS = [
  'cliente', 'nome', 'parte', 'autor',
  'reclamante', 'reclamado', 'empresa', 'razao',
  'requerente', 'requerido', 'exequente', 'executado',
  'contratante', 'contratado', 'devedor', 'credor', 'polo',
]

// Retorna true se o valor parece um nome de pessoa ou empresa
function looksLikeNome(value: string): boolean {
  const v = value.trim()
  if (v.length < 3) return false
  if (!/[A-Za-zÀ-ÿ]/.test(v)) return false                       // precisa ter letras
  if (/^\d{2}\/\d{2}\/\d{4}/.test(v)) return false               // parece data
  if (/^R\$|^\d+[.,]\d{2}$/.test(v)) return false                // parece valor monetário
  if (/^\+?\(?\d[\d\s\-().]{5,}$/.test(v)) return false          // parece telefone
  if (STATUS_VALIDOS.includes(v.toLowerCase())) return false      // status de processo
  if (AREA_VALIDAS.includes(v.toLowerCase())) return false        // área do direito
  return true
}

// Detecta o nome do cliente em uma linha normalizada.
// knownValues: valores já atribuídos a outros campos (para não repetir).
// Três passagens em ordem de confiança:
//   1ª — alias exato normalizado
//   2ª — fuzzy: coluna cujo NOME contém uma keyword
//   3ª — varredura por valor: qualquer coluna não-conhecida com valor que parece nome
function pickCliente(
  row: Record<string, string>,
  knownValues?: Set<string>
): { value: string; coluna: string | null } {

  // 1ª passagem: alias exato
  for (const alias of ALIASES_CLIENTE) {
    const key = normalizeHeader(alias)
    if (row[key] !== undefined && row[key] !== '') {
      return { value: str(row[key]), coluna: `${key} (alias)` }
    }
  }

  // 2ª passagem: fuzzy pelo nome da coluna
  for (const keyword of CLIENTE_KEYWORDS) {
    for (const key of Object.keys(row)) {
      if (key.includes(keyword) && row[key] !== '') {
        return { value: str(row[key]), coluna: `${key} (keyword:${keyword})` }
      }
    }
  }

  // 3ª passagem: varredura por valor — coluna cujo valor parece um nome de pessoa/empresa
  // e cujo valor não pertence a nenhum outro campo já extraído
  const known = knownValues ?? new Set<string>()
  for (const [key, value] of Object.entries(row)) {
    const trimmed = value.trim()
    if (!trimmed) continue
    if (known.has(trimmed)) continue   // valor já usado em outro campo
    if (looksLikeNome(trimmed)) {
      return { value: trimmed, coluna: `${key} (valor-scan)` }
    }
  }

  return { value: '', coluna: null }
}

function validarProcessoRow(row: Record<string, string>, linha: number): ProcessoRow {
  const erros: string[] = []

  const numero_processo = pick(row, ...ALIASES_NUMERO_PROCESSO)
  const tituloFromRow   = pick(row, 'titulo', 'título')
  const titulo          = tituloFromRow || numero_processo || `Processo linha ${linha}`
  const vara            = pick(row, 'vara', 'vara_judicial', 'juizo')
  const tribunal        = pick(row, 'tribunal', 'orgao', 'órgão')
  const statusRaw       = pick(row, 'status').toLowerCase()
  const status          = STATUS_VALIDOS.includes(statusRaw) ? statusRaw : 'ativo'
  const areaRaw         = pick(row, 'area_direito', 'area', 'área', 'área do direito', 'area do direito').toLowerCase()
  const area_direito    = AREA_VALIDAS.includes(areaRaw) ? areaRaw : 'civil'

  // Conjunto de valores já atribuídos a outros campos — impede a 3ª passagem de
  // confundir o título, número ou vara com o nome do cliente.
  const knownValues = new Set(
    [numero_processo, tituloFromRow, vara, tribunal, statusRaw, areaRaw].filter(Boolean)
  )

  const { value: cliente, coluna: clienteColuna } = pickCliente(row, knownValues)

  console.log(
    `[Importador] Linha ${linha}: cliente="${cliente || '(vazio)'}"`,
    clienteColuna ? `← ${clienteColuna}` : '← nenhuma coluna detectada',
    `| colunas: [${Object.keys(row).join(', ')}]`
  )

  if (!numero_processo && !titulo) erros.push('Número do processo ou título obrigatório')

  return {
    _linha: linha,
    _status: erros.length > 0 ? 'erro' : 'ok',
    _erros: erros,
    _rawRow: row,
    numero_processo,
    titulo,
    vara,
    tribunal,
    status,
    area_direito,
    cliente,
  }
}

// ─── Validação partes contrárias ─────────────────────────────────────────────

function validarParteContrariaRow(row: Record<string, string>, linha: number): ParteContrariaRow {
  const erros: string[] = []

  const numero_processo = pick(row, ...ALIASES_NUMERO_PROCESSO)
  const parte_contraria = pick(
    row,
    'parte_contraria', 'parte contraria', 'parte_adversa', 'parte adversa',
    'reclamado', 'requerido', 'executado', 'reu', 'réu',
    'contraparte', 'contra_parte', 'nome_parte', 'parte',
  )

  if (!numero_processo) erros.push('Número do processo obrigatório')
  if (!parte_contraria) erros.push('Parte contrária obrigatória')

  return {
    _linha: linha,
    _status: erros.length > 0 ? 'erro' : 'ok',
    _erros: erros,
    numero_processo,
    parte_contraria,
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ImportadorPage() {
  const [tipo, setTipo] = useState<TipoImportacao>('clientes')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [clientesRows, setClientesRows] = useState<ClienteRow[]>([])
  const [processosRows, setProcessosRows] = useState<ProcessoRow[]>([])
  const [partesRows, setPartesRows] = useState<ParteContrariaRow[]>([])
  const [etapa, setEtapa] = useState<'upload' | 'preview' | 'importando' | 'resultado'>('upload')
  const [log, setLog] = useState<LogImportacao | null>(null)
  const [erroArquivo, setErroArquivo] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const rows = tipo === 'clientes' ? clientesRows
    : tipo === 'processos' ? processosRows
    : partesRows
  const totalErros = rows.filter(r => r._status === 'erro').length
  const totalOk = rows.filter(r => r._status === 'ok').length

  // ── Drop zone ──
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }, [tipo])

  async function processFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      setErroArquivo('Formato inválido. Use .xlsx, .xls ou .csv')
      return
    }
    setErroArquivo('')
    setArquivo(f)
    try {
      const rows = await parseSheet(f)
      if (rows.length === 0) { setErroArquivo('Arquivo vazio ou sem dados.'); return }

      // Log de colunas detectadas e mapeamento
      if (rows.length > 0) {
        const colunasDetectadas = Object.keys(rows[0])
        console.group(`[Importador] Arquivo: ${f.name}`)
        console.log('Colunas detectadas (normalizadas):', colunasDetectadas)

        if (tipo === 'processos') {
          const mappingNumero = ALIASES_NUMERO_PROCESSO.map(a => normalizeHeader(a))
            .find(k => colunasDetectadas.includes(k))

          // Alias exato
          const mappingClienteExato = ALIASES_CLIENTE.map(a => normalizeHeader(a))
            .find(k => colunasDetectadas.includes(k))

          // Fuzzy: qualquer coluna que contenha uma keyword
          const mappingClienteFuzzy = mappingClienteExato ? null :
            (() => {
              for (const keyword of CLIENTE_KEYWORDS) {
                const found = colunasDetectadas.find(k => k.includes(keyword))
                if (found) return found
              }
              return null
            })()

          console.log('Mapeamento numero_processo → coluna:', mappingNumero ?? '(nenhuma)')
          console.log('Mapeamento cliente (exato) → coluna:', mappingClienteExato ?? '(nenhuma)')
          if (mappingClienteFuzzy) {
            console.log('Mapeamento cliente (fuzzy) → coluna:', mappingClienteFuzzy, '⚠ detectado por palavra-chave')
          }
          if (!mappingClienteExato && !mappingClienteFuzzy) {
            console.warn('Mapeamento cliente: NENHUMA coluna detectada. Colunas disponíveis:', colunasDetectadas)
          }
        }

        console.groupEnd()
      }

      if (tipo === 'clientes') {
        setClientesRows(rows.map((r, i) => validarClienteRow(r, i + 2)))
      } else if (tipo === 'processos') {
        setProcessosRows(rows.map((r, i) => validarProcessoRow(r, i + 2)))
      } else {
        setPartesRows(rows.map((r, i) => validarParteContrariaRow(r, i + 2)))
      }
      setEtapa('preview')
    } catch (e: any) {
      setErroArquivo(e.message)
    }
  }

  function resetar() {
    setArquivo(null)
    setClientesRows([])
    setProcessosRows([])
    setPartesRows([])
    setEtapa('upload')
    setLog(null)
    setErroArquivo('')
  }

  // ── Importar clientes ──
  async function importarClientes() {
    const supabase = createClient()
    const log: LogImportacao = { total: clientesRows.length, inseridos: 0, duplicados: 0, erros: 0, detalhes: [] }
    const validos = clientesRows.filter(r => r._status !== 'erro')

    for (const row of validos) {
      // checar duplicidade por cpf_cnpj
      if (row.cpf_cnpj) {
        const { data: exists } = await supabase
          .from('clientes')
          .select('id')
          .eq('cpf_cnpj', row.cpf_cnpj)
          .maybeSingle()

        if (exists) {
          log.duplicados++
          log.detalhes.push({ linha: row._linha, mensagem: `"${row.nome}" já existe (CPF/CNPJ duplicado) — ignorado`, tipo: 'aviso' })
          continue
        }
      }

      const { error } = await supabase.from('clientes').insert({
        nome: row.nome,
        cpf_cnpj: row.cpf_cnpj || null,
        telefone: row.telefone || null,
        email: row.email || null,
        tipo_pessoa: row.tipo_pessoa === 'juridica' ? 'juridica' : 'fisica',
        ativo: true,
      })

      if (error) {
        log.erros++
        log.detalhes.push({ linha: row._linha, mensagem: `Erro ao inserir "${row.nome}": ${error.message}`, tipo: 'erro' })
      } else {
        log.inseridos++
        log.detalhes.push({ linha: row._linha, mensagem: `"${row.nome}" importado com sucesso`, tipo: 'ok' })
      }
    }

    // linhas com erro de validação
    for (const row of clientesRows.filter(r => r._status === 'erro')) {
      log.erros++
      log.detalhes.push({ linha: row._linha, mensagem: `"${row.nome || '(sem nome)'}" ignorado: ${row._erros.join(', ')}`, tipo: 'erro' })
    }

    return log
  }

  // ── Importar processos ──
  async function importarProcessos() {
    const supabase = createClient()
    const log: LogImportacao = { total: processosRows.length, inseridos: 0, duplicados: 0, erros: 0, detalhes: [] }
    const validos = processosRows.filter(r => r._status !== 'erro')

    for (const row of validos) {
      console.group(`[Import] Linha ${row._linha} — "${row.titulo}"`)

      // ── 1. Detectar nome do cliente ───────────────────────────────────────
      let nomeCliente = row.cliente.trim()

      if (!nomeCliente) {
        const knownValues = new Set(
          [row.numero_processo, row.titulo, row.vara, row.tribunal, row.status, row.area_direito].filter(Boolean)
        )
        const { value: fresh, coluna: freshCol } = pickCliente(row._rawRow, knownValues)
        if (fresh) {
          nomeCliente = fresh
          console.log(`cliente re-detectado via _rawRow: "${fresh}" (${freshCol})`)
        } else {
          console.warn(
            `cliente NÃO detectado.`,
            `Colunas: [${Object.keys(row._rawRow).join(', ')}]`,
            `Valores: ${Object.entries(row._rawRow).map(([k, v]) => `${k}="${v}"`).join(' | ')}`
          )
        }
      }

      console.log(`[1] nomeCliente="${nomeCliente || '(vazio)'}"`)

      // ── 2. Resolver cliente_id ────────────────────────────────────────────
      let cliente_id: string | null = null

      if (nomeCliente) {
        const nome = nomeCliente.trim()

        // 2a. Busca por CPF/CNPJ
        if (/^[\d.\-\/]+$/.test(nome)) {
          const { data, error } = await supabase
            .from('clientes').select('id').eq('cpf_cnpj', nome).maybeSingle()
          console.log(`[2a] busca por CPF/CNPJ: data=${JSON.stringify(data)} error=${error?.message}`)
          if (data?.id) cliente_id = data.id
        }

        // 2b. Busca por nome exato (case-insensitive)
        if (!cliente_id) {
          const { data, error } = await supabase
            .from('clientes').select('id').ilike('nome', nome).maybeSingle()
          console.log(`[2b] busca nome exato "${nome}": data=${JSON.stringify(data)} error=${error?.message}`)
          if (data?.id) cliente_id = data.id
        }

        // 2c. Busca por nome parcial
        if (!cliente_id) {
          const { data, error } = await supabase
            .from('clientes').select('id').ilike('nome', `%${nome}%`).limit(1).maybeSingle()
          console.log(`[2c] busca nome parcial "%${nome}%": data=${JSON.stringify(data)} error=${error?.message}`)
          if (data?.id) cliente_id = data.id
        }

        // 2d. Criar automaticamente
        if (!cliente_id) {
          console.log(`[2d] cliente não encontrado — criando "${nome}"...`)
          const { data: novo, error: erroCriacao } = await supabase
            .from('clientes')
            .insert({ nome, ativo: true, tipo_pessoa: 'fisica' })
            .select('id')
            .single()

          console.log(`[2d] resultado criação: data=${JSON.stringify(novo)} error=${erroCriacao?.message}`)

          if (novo?.id) {
            cliente_id = novo.id
            log.detalhes.push({
              linha: row._linha,
              mensagem: `Cliente "${nome}" criado (id: ${novo.id})`,
              tipo: 'aviso',
            })
          } else {
            const motivo = erroCriacao?.message ?? 'resposta vazia do banco'
            log.erros++
            log.detalhes.push({
              linha: row._linha,
              mensagem: `ERRO ao criar cliente "${nome}": ${motivo} — processo ignorado`,
              tipo: 'erro',
            })
            console.error(`[2d] FALHA ao criar cliente. Processo ignorado.`)
            console.groupEnd()
            continue
          }
        }

        console.log(`[2] cliente_id resolvido: ${cliente_id}`)
      }
      // ─────────────────────────────────────────────────────────────────────

      // ── 3. Verificar duplicidade por numero_processo ──────────────────────
      if (row.numero_processo) {
        const { data: existe, error: erroCheck } = await supabase
          .from('processos')
          .select('id, cliente_id')
          .eq('numero_processo', row.numero_processo)
          .maybeSingle()

        console.log(`[3] duplicidade "${row.numero_processo}": existe=${JSON.stringify(existe)} error=${erroCheck?.message}`)

        if (existe) {
          // Se já existe mas sem cliente e agora temos um → atualizar
          if (!existe.cliente_id && cliente_id) {
            const { error: erroUpdate } = await supabase
              .from('processos')
              .update({ cliente_id })
              .eq('id', existe.id)

            if (erroUpdate) {
              log.erros++
              log.detalhes.push({
                linha: row._linha,
                mensagem: `Processo "${row.numero_processo}" existe — ERRO ao atualizar cliente: ${erroUpdate.message}`,
                tipo: 'erro',
              })
            } else {
              log.inseridos++
              log.detalhes.push({
                linha: row._linha,
                mensagem: `Processo "${row.numero_processo}" atualizado com cliente "${nomeCliente}" (${cliente_id})`,
                tipo: 'ok',
              })
            }
          } else {
            log.duplicados++
            log.detalhes.push({
              linha: row._linha,
              mensagem: `Processo "${row.numero_processo}" já existe — ignorado`,
              tipo: 'aviso',
            })
          }
          console.groupEnd()
          continue
        }
      }

      // ── 4. Inserir processo ───────────────────────────────────────────────
      const payload = {
        numero_processo: row.numero_processo || null,
        titulo:          row.titulo,
        vara:            row.vara || null,
        tribunal:        row.tribunal || null,
        status:          row.status,
        area_direito:    row.area_direito,
        cliente_id,
      }

      console.log(`[4] INSERT processos payload:`, payload)

      const { error: erroInsert } = await supabase.from('processos').insert(payload)

      console.log(`[4] INSERT resultado: error=${erroInsert?.message ?? 'ok'}`)

      if (erroInsert) {
        log.erros++
        log.detalhes.push({
          linha: row._linha,
          mensagem: `ERRO ao inserir "${row.titulo}": ${erroInsert.message}`,
          tipo: 'erro',
        })
      } else {
        log.inseridos++
        log.detalhes.push({
          linha: row._linha,
          mensagem: `"${row.titulo}" importado | cliente: "${nomeCliente || '—'}" → ${cliente_id ?? 'sem vínculo'}`,
          tipo: 'ok',
        })
      }

      console.groupEnd()
    }

    for (const row of processosRows.filter(r => r._status === 'erro')) {
      log.erros++
      log.detalhes.push({
        linha: row._linha,
        mensagem: `Linha ${row._linha} ignorada: ${row._erros.join(', ')}`,
        tipo: 'erro',
      })
    }

    return log
  }

  // ── Importar partes contrárias (via API route server-side) ──
  async function importarPartesContrarias(): Promise<LogImportacao> {
    const validas = partesRows.filter(r => r._status !== 'erro')
    const invalidas = partesRows.filter(r => r._status === 'erro')

    const body = {
      rows: validas.map(r => ({
        numero_processo: r.numero_processo,
        parte_contraria: r.parte_contraria,
      })),
    }

    const res = await fetch('/api/importar/partes-contrarias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const log: LogImportacao = {
      total: partesRows.length,
      inseridos: 0,
      duplicados: 0,
      erros: invalidas.length,
      detalhes: [],
    }

    // Erros de validação local
    for (const row of invalidas) {
      log.detalhes.push({
        linha: row._linha,
        mensagem: `Linha ${row._linha} ignorada: ${row._erros.join(', ')}`,
        tipo: 'erro',
      })
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
      log.erros++
      log.detalhes.push({ linha: 0, mensagem: `Erro na importação: ${err.error}`, tipo: 'erro' })
      return log
    }

    const relatorio = await res.json()

    log.inseridos  = relatorio.inseridos ?? 0
    log.duplicados = relatorio.ja_existiam ?? 0
    log.erros     += (relatorio.erros ?? 0) + (relatorio.processos_nao_encontrados ?? 0)

    for (const linha of relatorio.linhas ?? []) {
      log.detalhes.push({
        linha:     linha.linha,
        mensagem:  linha.mensagem,
        tipo:      linha.status === 'inserido'  ? 'ok'
                 : linha.status === 'ja_existia' ? 'aviso'
                 : 'erro',
      })
    }

    return log
  }

  async function confirmarImportacao() {
    setEtapa('importando')
    const resultado = tipo === 'clientes'          ? await importarClientes()
                    : tipo === 'processos'          ? await importarProcessos()
                    : await importarPartesContrarias()
    setLog(resultado)
    setEtapa('resultado')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1a1d23]">Importar Dados</h1>
          <p className="text-sm text-[#6b7280] mt-0.5">Importe clientes e processos via Excel ou CSV</p>
        </div>
        {etapa !== 'upload' && (
          <button onClick={resetar} className="flex items-center gap-2 text-sm text-[#6b7280] hover:text-[#1a1d23] transition-colors">
            <RotateCcw size={14} /> Nova importação
          </button>
        )}
      </div>

      {/* Seletor de tipo */}
      {etapa === 'upload' && (
        <div className="flex gap-3 flex-wrap">
          <TipoCard
            ativo={tipo === 'clientes'}
            icon={<Users size={18} />}
            label="Clientes"
            desc="nome, cpf_cnpj, telefone, email"
            onClick={() => setTipo('clientes')}
          />
          <TipoCard
            ativo={tipo === 'processos'}
            icon={<Scale size={18} />}
            label="Processos"
            desc="numero_processo, vara, tribunal, status, cliente"
            onClick={() => setTipo('processos')}
          />
          <TipoCard
            ativo={tipo === 'partes_contrarias'}
            icon={<UserX size={18} />}
            label="Partes Contrárias"
            desc="numero_processo, parte_contraria"
            onClick={() => setTipo('partes_contrarias')}
          />
          <TipoCard
            ativo={tipo === 'csv_juridico'}
            icon={<FileText size={18} />}
            label="CSV Jurídico"
            desc="Importação completa via CSV padronizado do Trello"
            onClick={() => setTipo('csv_juridico')}
          />
        </div>
      )}

      {/* CSV Jurídico — fluxo próprio */}
      {tipo === 'csv_juridico' && etapa === 'upload' && (
        <CsvJuridicoImporter />
      )}

      {/* Upload */}
      {etapa === 'upload' && tipo !== 'csv_juridico' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'bg-white rounded-2xl border-2 border-dashed p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all',
            dragging ? 'border-[#145A5B] bg-[#145A5B]/4' : 'border-[#e5e7eb] hover:border-[#145A5B]/40 hover:bg-[#f9fafb]'
          )}
        >
          <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', dragging ? 'bg-[#145A5B]/10' : 'bg-[#f3f4f6]')}>
            <Upload size={24} className={dragging ? 'text-[#145A5B]' : 'text-[#9ca3af]'} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[#1a1d23]">
              {dragging ? 'Solte o arquivo aqui' : 'Clique ou arraste o arquivo'}
            </p>
            <p className="text-xs text-[#9ca3af] mt-1">Suporta .xlsx, .xls e .csv</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }}
          />
        </div>
      )}

      {erroArquivo && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
          <AlertCircle size={15} /> {erroArquivo}
        </div>
      )}

      {/* Referência de colunas */}
      {etapa === 'upload' && tipo !== 'csv_juridico' && (
        <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
          <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">
            Colunas esperadas — {tipo === 'clientes' ? 'Clientes' : 'Processos'}
          </p>
          {tipo === 'clientes' ? (
            <ColunasRef cols={[
              { nome: 'nome', req: true, desc: 'Nome completo ou razão social' },
              { nome: 'cpf_cnpj', req: false, desc: 'CPF ou CNPJ (usado para evitar duplicidade)' },
              { nome: 'telefone', req: false, desc: 'Telefone ou celular' },
              { nome: 'email', req: false, desc: 'E-mail de contato' },
              { nome: 'tipo_pessoa', req: false, desc: '"fisica" ou "juridica" (padrão: fisica)' },
            ]} />
          ) : tipo === 'processos' ? (
            <ColunasRef cols={[
              { nome: 'numero_processo', req: false, desc: 'Número CNJ do processo' },
              { nome: 'titulo', req: false, desc: 'Título (usa número se vazio)' },
              { nome: 'vara', req: false, desc: 'Vara onde corre o processo' },
              { nome: 'tribunal', req: false, desc: 'Ex: TJSP, TRT-2' },
              { nome: 'status', req: false, desc: 'ativo | suspenso | arquivado | encerrado' },
              { nome: 'area_direito', req: false, desc: 'civil | trabalhista | criminal | etc.' },
              { nome: 'cliente', req: false, desc: 'Nome ou CPF/CNPJ do cliente (cria se não existir)' },
            ]} />
          ) : (
            <ColunasRef cols={[
              { nome: 'numero_processo', req: true,  desc: 'Número CNJ do processo (deve existir no sistema)' },
              { nome: 'parte_contraria', req: true,  desc: 'Nome da parte contrária (réu, reclamado, requerido…)' },
            ]} />
          )}
        </div>
      )}

      {/* Preview */}
      {etapa === 'preview' && (
        <>
          <PreviewHeader arquivo={arquivo!} total={rows.length} ok={totalOk} erros={totalErros} />

          <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
            <div className="overflow-x-auto">
              {tipo === 'clientes'   ? <TabelaClientes rows={clientesRows} />
              : tipo === 'processos' ? <TabelaProcessos rows={processosRows} />
              : <TabelaPartesContrarias rows={partesRows} />}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-between">
            <button onClick={resetar} className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
              <X size={14} /> Cancelar
            </button>
            <div className="flex items-center gap-3">
              {totalErros > 0 && (
                <p className="text-sm text-amber-600">
                  {totalErros} linha{totalErros > 1 ? 's' : ''} com erro {totalErros < rows.length ? '(serão ignoradas)' : '(nenhuma será importada)'}
                </p>
              )}
              <button
                onClick={confirmarImportacao}
                disabled={totalOk === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#145A5B] hover:bg-[#1B6E70] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={15} />
                Confirmar Importação ({totalOk} registro{totalOk !== 1 ? 's' : ''})
              </button>
            </div>
          </div>
        </>
      )}

      {/* Importando */}
      {etapa === 'importando' && (
        <div className="bg-white rounded-2xl border border-[#e5e7eb] py-20 flex flex-col items-center gap-4">
          <Loader2 size={32} className="text-[#145A5B] animate-spin" />
          <p className="text-sm font-medium text-[#374151]">Importando dados...</p>
          <p className="text-xs text-[#9ca3af]">Não feche esta janela</p>
        </div>
      )}

      {/* Resultado */}
      {etapa === 'resultado' && log && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total" value={log.total} cor="gray" />
            <StatCard label="Importados" value={log.inseridos} cor="green" />
            <StatCard label="Duplicados" value={log.duplicados} cor="amber" />
            <StatCard label="Erros" value={log.erros} cor="red" />
          </div>

          <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f3f4f6]">
              <h2 className="text-sm font-semibold text-[#1a1d23]">Log de importação</h2>
            </div>
            <div className="divide-y divide-[#f9fafb] max-h-96 overflow-y-auto">
              {log.detalhes.map((d, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3">
                  {d.tipo === 'ok' && <CheckCircle2 size={15} className="text-green-500 mt-0.5 flex-shrink-0" />}
                  {d.tipo === 'erro' && <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />}
                  {d.tipo === 'aviso' && <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />}
                  <div>
                    <span className="text-xs text-[#9ca3af] mr-2">Linha {d.linha}</span>
                    <span className="text-sm text-[#374151]">{d.mensagem}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={resetar} className="flex items-center gap-2 px-5 py-2.5 bg-[#145A5B] hover:bg-[#1B6E70] text-white text-sm font-medium rounded-xl transition-colors">
              <RotateCcw size={14} /> Nova importação
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function TipoCard({ ativo, icon, label, desc, onClick }: { ativo: boolean; icon: React.ReactNode; label: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all',
        ativo ? 'border-[#145A5B] bg-[#145A5B]/4' : 'border-[#e5e7eb] bg-white hover:border-[#145A5B]/30'
      )}
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', ativo ? 'bg-[#145A5B] text-white' : 'bg-[#f3f4f6] text-[#6b7280]')}>
        {icon}
      </div>
      <div>
        <p className={cn('text-sm font-semibold', ativo ? 'text-[#145A5B]' : 'text-[#1a1d23]')}>{label}</p>
        <p className="text-xs text-[#9ca3af] font-mono mt-0.5">{desc}</p>
      </div>
    </button>
  )
}

function ColunasRef({ cols }: { cols: { nome: string; req: boolean; desc: string }[] }) {
  return (
    <div className="space-y-2">
      {cols.map((c) => (
        <div key={c.nome} className="flex items-center gap-3">
          <code className="text-xs bg-[#f3f4f6] text-[#145A5B] px-2 py-0.5 rounded font-mono min-w-[160px]">{c.nome}</code>
          {c.req && <span className="text-xs text-red-500 font-medium">obrigatório</span>}
          <span className="text-xs text-[#6b7280]">{c.desc}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewHeader({ arquivo, total, ok, erros }: { arquivo: File; total: number; ok: number; erros: number }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
        <FileSpreadsheet size={18} className="text-green-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1a1d23] truncate">{arquivo.name}</p>
        <p className="text-xs text-[#9ca3af]">{total} linhas encontradas</p>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-green-600 font-medium">
          <CheckCircle2 size={13} /> {ok} ok
        </span>
        {erros > 0 && (
          <span className="flex items-center gap-1 text-red-500 font-medium">
            <AlertCircle size={13} /> {erros} erro{erros > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ row }: { row: { _status: RowStatus; _erros: string[] } }) {
  if (row._status === 'erro') return (
    <span title={row._erros.join(', ')} className="flex items-center gap-1 text-xs text-red-600 font-medium cursor-help">
      <AlertCircle size={13} /> Erro
    </span>
  )
  return <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 size={13} /> OK</span>
}

function TabelaClientes({ rows }: { rows: ClienteRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[#f3f4f6] bg-[#f9fafb]">
          <Th>#</Th><Th>Status</Th><Th>Nome</Th><Th>CPF / CNPJ</Th><Th>Telefone</Th><Th>E-mail</Th><Th>Tipo</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r._linha} className={cn('border-b border-[#f9fafb]', r._status === 'erro' ? 'bg-red-50/40' : '')}>
            <Td muted>{r._linha}</Td>
            <Td><StatusBadge row={r} /></Td>
            <Td bold>{r.nome || <span className="text-red-400 italic">vazio</span>}</Td>
            <Td muted>{r.cpf_cnpj || '—'}</Td>
            <Td muted>{r.telefone || '—'}</Td>
            <Td muted>{r.email || '—'}</Td>
            <Td muted>{r.tipo_pessoa || 'fisica'}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TabelaProcessos({ rows }: { rows: ProcessoRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[#f3f4f6] bg-[#f9fafb]">
          <Th>#</Th><Th>Status</Th><Th>Título</Th><Th>Nº Processo</Th><Th>Vara</Th><Th>Tribunal</Th><Th>Área</Th><Th>Cliente</Th><Th>Status Proc.</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r._linha} className={cn('border-b border-[#f9fafb]', r._status === 'erro' ? 'bg-red-50/40' : '')}>
            <Td muted>{r._linha}</Td>
            <Td><StatusBadge row={r} /></Td>
            <Td bold>{r.titulo || <span className="text-red-400 italic">vazio</span>}</Td>
            <Td muted><span className="font-mono text-xs">{r.numero_processo || '—'}</span></Td>
            <Td muted>{r.vara || '—'}</Td>
            <Td muted>{r.tribunal || '—'}</Td>
            <Td muted>{r.area_direito}</Td>
            <Td muted>
              {r.cliente
                ? r.cliente
                : <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium"><AlertTriangle size={12} /> não detectado</span>
              }
            </Td>
            <Td>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', {
                'bg-green-100 text-green-700': r.status === 'ativo',
                'bg-amber-100 text-amber-700': r.status === 'suspenso',
                'bg-gray-100 text-gray-600': r.status === 'arquivado',
                'bg-red-100 text-red-700': r.status === 'encerrado',
              })}>
                {r.status}
              </span>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TabelaPartesContrarias({ rows }: { rows: ParteContrariaRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[#f3f4f6] bg-[#f9fafb]">
          <Th>#</Th><Th>Status</Th><Th>Nº Processo</Th><Th>Parte Contrária</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r._linha} className={cn('border-b border-[#f9fafb]', r._status === 'erro' ? 'bg-red-50/40' : '')}>
            <Td muted>{r._linha}</Td>
            <Td><StatusBadge row={r} /></Td>
            <Td muted><span className="font-mono text-xs">{r.numero_processo || <span className="text-red-400 italic">vazio</span>}</span></Td>
            <Td bold>{r.parte_contraria || <span className="text-red-400 italic">vazio</span>}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StatCard({ label, value, cor }: { label: string; value: number; cor: 'gray' | 'green' | 'amber' | 'red' }) {
  const cores = {
    gray: 'text-[#1a1d23]',
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  }
  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
      <p className="text-xs text-[#9ca3af] mb-2">{label}</p>
      <p className={cn('text-3xl font-bold', cores[cor])}>{value}</p>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-xs font-semibold text-[#9ca3af] uppercase tracking-wider px-4 py-3">{children}</th>
}

function Td({ children, muted, bold }: { children: React.ReactNode; muted?: boolean; bold?: boolean }) {
  return (
    <td className={cn('px-4 py-2.5', muted ? 'text-[#6b7280]' : '', bold ? 'font-medium text-[#1a1d23]' : '')}>
      {children}
    </td>
  )
}
