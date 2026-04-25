/**
 * src/lib/easyjur/html-parser.ts
 *
 * Parser do Relatório Analítico do EasyJur exportado como HTML.
 * Roda no browser (usa DOMParser nativo — sem dependências extras).
 *
 * Estratégias de extração (em ordem de prioridade):
 *  1. Células de label→valor em tabelas (padrão dominante do EasyJur)
 *  2. Seções com headings h3/h4/h5 seguidas de tabelas
 *  3. Regex no texto bruto do documento (fallback)
 *
 * O parser é tolerante: extrai o que encontra e registra o que não achou.
 */

import type { EasyJurAndamento, EasyJurHonorario, EasyJurParseResult, EasyJurProcesso, EasyJurPrazo } from '@/types/easyjur'

// ── Regex ─────────────────────────────────────────────────────────────────────

/** Número de processo CNJ: 0000000-00.0000.0.00.0000 */
const RE_PROCESSO = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g

/** CPF: 000.000.000-00 ou 00000000000 */
const RE_CPF = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/

/** CNPJ: 00.000.000/0000-00 */
const RE_CNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?0001-?\d{2}/

/** Data brasileira: DD/MM/AAAA */
const RE_DATA_BR = /\d{2}\/\d{2}\/\d{4}/

/** Valor monetário R$ 0.000,00 */
const RE_VALOR = /R\$\s*[\d.,]+/i

// ── Normalização de texto ─────────────────────────────────────────────────────

function limpar(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function parseMoeda(s: string): number | null {
  const match = s.match(/[\d.,]+/)
  if (!match) return null
  const n = parseFloat(match[0].replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

// ── Mapa de labels conhecidos do EasyJur ──────────────────────────────────────

const LABEL_MAP: Record<string, string> = {
  // Identificação do processo
  'numero_do_processo':     'numero_processo',
  'no_do_processo':         'numero_processo',
  'n_do_processo':          'numero_processo',
  'numero':                 'numero_processo',
  'processo':               'numero_processo',

  // Partes
  'cliente':                'cliente',
  'requerente':             'cliente',
  'autor':                  'cliente',
  'parte_ativa':            'cliente',

  'parte_contraria':        'parte_contraria',
  'reu':                    'parte_contraria',
  'requerido':              'parte_contraria',
  'parte_passiva':          'parte_contraria',
  'demandado':              'parte_contraria',

  // Responsável
  'responsavel':            'responsavel',
  'advogado_responsavel':   'responsavel',
  'advogado':               'responsavel',
  'profissional':           'responsavel',

  // Classificação
  'status':                 'status',
  'situacao':               'status',
  'fase':                   'status',
  'area':                   'area_direito',
  'area_do_direito':        'area_direito',
  'especialidade':          'area_direito',
  'materia':                'area_direito',

  // Tribunal e vara
  'tribunal':               'tribunal',
  'orgao_julgador':         'tribunal',
  'justica':                'tribunal',
  'vara':                   'vara',
  'juizo':                  'vara',
  'comarca':                'vara',

  // CPF/CNPJ
  'cpf':                    'cpf_cnpj_cliente',
  'cnpj':                   'cpf_cnpj_cliente',
  'cpf_cnpj':               'cpf_cnpj_cliente',
  'documento':              'cpf_cnpj_cliente',
}

// Alias para seções de blocos
const SECAO_ANDAMENTOS  = /andamento|movimenta|historico/i
const SECAO_PRAZOS      = /prazo|vencimento|deadline/i
const SECAO_AUDIENCIAS  = /audiencia|sessao|julgamento/i
const SECAO_TAREFAS     = /tarefa|task|atividade/i
const SECAO_HONORARIOS  = /honorario|honorar/i
const SECAO_CUSTAS      = /custa|despesa|taxa/i
const SECAO_ALVARAS     = /alvara|deposito|levantamento/i
const SECAO_INCIDENTES  = /incidente|recurso/i
const SECAO_APENSADOS   = /apensad|apenso|conexo/i
const SECAO_PEDIDOS     = /pedido|objeto|pretensao/i
const SECAO_DOCUMENTOS  = /documento|anexo|arquivo/i

// ── Extração de campos de uma tabela de cabeçalho ─────────────────────────────

/**
 * Extrai pares label→valor de qualquer tabela do EasyJur.
 * Suporta 2 layouts:
 *  A) <td>Label:</td><td>Valor</td> (células adjacentes na mesma linha)
 *  B) <th>Label</th> na primeira coluna com <td>Valor</td>
 */
function extrairParesDaTabela(table: Element): Record<string, string> {
  const campos: Record<string, string> = {}

  for (const row of Array.from(table.querySelectorAll('tr'))) {
    const cells = Array.from(row.querySelectorAll('td, th'))
    let i = 0
    while (i < cells.length - 1) {
      const cellText = limpar(cells[i].textContent).replace(/:$/, '')
      const key = LABEL_MAP[normalizeLabel(cellText)]
      if (key) {
        campos[key] = limpar(cells[i + 1].textContent)
        i += 2
      } else {
        i++
      }
    }
  }

  return campos
}

// ── Extração de tabelas de seção ──────────────────────────────────────────────

interface TabelaSecao {
  headers: string[]
  rows:    string[][]
}

function extrairTabelaSecao(table: Element): TabelaSecao {
  const headers: string[] = []
  const rows:    string[][] = []

  const headRow = table.querySelector('thead tr') ?? table.querySelector('tr')
  if (headRow) {
    for (const th of Array.from(headRow.querySelectorAll('th, td'))) {
      headers.push(limpar(th.textContent))
    }
  }

  const bodyRows = table.querySelectorAll('tbody tr, tr')
  for (const row of Array.from(bodyRows)) {
    if (row === headRow) continue
    const cells = Array.from(row.querySelectorAll('td')).map(td => limpar(td.textContent))
    if (cells.some(c => c.length > 0)) rows.push(cells)
  }

  return { headers, rows }
}

// ── Parsers de seção específicos ──────────────────────────────────────────────

function parseAndamentos(table: Element): EasyJurAndamento[] {
  const { headers, rows } = extrairTabelaSecao(table)
  const idxData  = headers.findIndex(h => /data/i.test(h))
  const idxTipo  = headers.findIndex(h => /tipo|classe/i.test(h))
  const idxDesc  = headers.findIndex(h => /descri|moviment|texto|hist/i.test(h))

  return rows
    .filter(r => r.length > 0 && r.some(c => c))
    .map(r => ({
      data:     idxData >= 0  ? (r[idxData] || null)  : null,
      tipo:     idxTipo >= 0  ? (r[idxTipo] || null)  : null,
      descricao: idxDesc >= 0 ? (r[idxDesc] || r.join(' ')) : r.join(' '),
    }))
}

function parsePrazos(table: Element, tipo: EasyJurPrazo['tipo']): EasyJurPrazo[] {
  const { headers, rows } = extrairTabelaSecao(table)
  const idxTitulo    = headers.findIndex(h => /descri|titulo|assunto|atividade|tarefa/i.test(h))
  const idxData      = headers.findIndex(h => /data|vencim|prazo/i.test(h))
  const idxStatus    = headers.findIndex(h => /status|situac/i.test(h))
  const idxPrioridade = headers.findIndex(h => /prior|urgent/i.test(h))
  const idxLocal     = headers.findIndex(h => /local|sala|lugar/i.test(h))

  return rows
    .filter(r => r.some(c => c))
    .map(r => ({
      titulo:    idxTitulo >= 0 ? r[idxTitulo] : (r[0] || 'Sem título'),
      data:      idxData >= 0   ? r[idxData]   : null,
      tipo,
      status:    idxStatus >= 0    ? r[idxStatus]    : null,
      prioridade: idxPrioridade >= 0 ? r[idxPrioridade] : null,
      local:     idxLocal >= 0 ? r[idxLocal] : null,
    }))
}

function parseHonorarios(table: Element): EasyJurHonorario[] {
  const { headers, rows } = extrairTabelaSecao(table)
  const idxDesc   = headers.findIndex(h => /descri|hist|tipo/i.test(h))
  const idxValor  = headers.findIndex(h => /valor|montante|quantia/i.test(h))
  const idxData   = headers.findIndex(h => /data|vencim/i.test(h))
  const idxStatus = headers.findIndex(h => /status|situac/i.test(h))

  return rows
    .filter(r => r.some(c => c))
    .map(r => ({
      descricao: idxDesc >= 0  ? r[idxDesc]  : r[0] ?? '',
      valor:     idxValor >= 0 ? parseMoeda(r[idxValor]) : null,
      data:      idxData >= 0  ? r[idxData]  : null,
      status:    idxStatus >= 0 ? r[idxStatus] : null,
    }))
}

function extrairListaTexto(container: Element): string[] {
  const items: string[] = []
  for (const el of Array.from(container.querySelectorAll('li, td, p'))) {
    const t = limpar(el.textContent)
    if (t && t.length > 2) items.push(t)
  }
  if (items.length === 0) {
    const t = limpar(container.textContent)
    if (t) items.push(t)
  }
  return [...new Set(items)]
}

// ── Busca a seção seguinte a um heading ───────────────────────────────────────

function encontrarSecao(doc: Document | Element, re: RegExp): Element | null {
  const headings = Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,th,td,b,strong,span'))
  for (const h of headings) {
    if (re.test(limpar(h.textContent))) {
      // Tenta próximo elemento irmão
      let sib = h.nextElementSibling
      while (sib) {
        if (sib.tagName === 'TABLE' || sib.querySelectorAll('tr').length > 0) return sib
        if (sib.querySelector('table, li, p')) return sib
        sib = sib.nextElementSibling
      }
      // Tenta elemento pai
      const parent = h.parentElement
      if (parent) {
        const table = parent.querySelector('table')
        if (table) return table
      }
    }
  }
  return null
}

// ── Parser de um único bloco de processo ──────────────────────────────────────

/**
 * Extrai todos os campos de um trecho do documento relativo a um processo.
 * `root` pode ser o documento inteiro (relatório de 1 processo) ou
 * uma seção específica (relatório com múltiplos processos).
 */
function parseProcessoBloco(root: Document | Element, numeroProcesso: string): EasyJurProcesso {
  const avisos:  string[] = []
  const naoEncontrados: string[] = []

  // ── 1. Campos de cabeçalho via tabelas de label→valor ──────────────────────
  const campos: Record<string, string> = {}
  for (const table of Array.from(root.querySelectorAll('table'))) {
    Object.assign(campos, extrairParesDaTabela(table))
  }

  // ── 2. Campos não encontrados via regex no texto bruto ─────────────────────
  const textoTotal = limpar(root instanceof Document ? root.body?.textContent : root.textContent)

  function campoOuRegex(key: string, re: RegExp): string | null {
    if (campos[key]) return campos[key]
    const m = textoTotal.match(re)
    return m ? limpar(m[0]) : null
  }

  const cliente       = campos['cliente']       ?? null
  const cpfCnpj       = campoOuRegex('cpf_cnpj_cliente', new RegExp(`(${RE_CPF.source}|${RE_CNPJ.source})`))
  const parteContraria = campos['parte_contraria'] ?? null
  const responsavel   = campos['responsavel']   ?? null
  const status        = campos['status']        ?? null
  const areaDireito   = campos['area_direito']  ?? null
  const tribunal      = campos['tribunal']      ?? null
  const vara          = campos['vara']          ?? null

  // Partes vinculadas: qualquer partes_vinculadas ou terceiros
  const partesVinculadas: string[] = []
  const secaoPartes = encontrarSecao(root, /partes?\s+vinculad|terceiro|litisconsorte/i)
  if (secaoPartes) partesVinculadas.push(...extrairListaTexto(secaoPartes))

  // Campos obrigatórios ausentes
  if (!cliente)       naoEncontrados.push('cliente')
  if (!parteContraria) naoEncontrados.push('parte_contraria')
  if (!responsavel)   naoEncontrados.push('responsavel')
  if (!status)        naoEncontrados.push('status')

  // ── 3. Andamentos ──────────────────────────────────────────────────────────
  let andamentos: EasyJurAndamento[] = []
  const secaoAnd = encontrarSecao(root, SECAO_ANDAMENTOS)
  if (secaoAnd) {
    const tbl = secaoAnd.tagName === 'TABLE' ? secaoAnd : secaoAnd.querySelector('table')
    if (tbl) andamentos = parseAndamentos(tbl)
  }

  // Último andamento real: último da lista (cronológico) ou regex no texto
  let ultimoAndamento: string | null = null
  if (andamentos.length > 0) {
    const last = andamentos[andamentos.length - 1]
    ultimoAndamento = [last.data, last.tipo, last.descricao].filter(Boolean).join(' — ')
  } else {
    // Tenta extrair "Último andamento" como label
    ultimoAndamento = campos['ultimo_andamento'] ?? null
    if (!ultimoAndamento) naoEncontrados.push('ultimo_andamento')
  }

  // ── 4. Prazos ──────────────────────────────────────────────────────────────
  let prazos: EasyJurPrazo[] = []
  const secaoPrazos = encontrarSecao(root, SECAO_PRAZOS)
  if (secaoPrazos) {
    const tbl = secaoPrazos.tagName === 'TABLE' ? secaoPrazos : secaoPrazos.querySelector('table')
    if (tbl) prazos = parsePrazos(tbl, 'prazo')
  }

  // ── 5. Audiências ──────────────────────────────────────────────────────────
  let audiencias: EasyJurPrazo[] = []
  const secaoAud = encontrarSecao(root, SECAO_AUDIENCIAS)
  if (secaoAud) {
    const tbl = secaoAud.tagName === 'TABLE' ? secaoAud : secaoAud.querySelector('table')
    if (tbl) audiencias = parsePrazos(tbl, 'audiencia')
  }

  // ── 6. Tarefas ─────────────────────────────────────────────────────────────
  let tarefas: EasyJurPrazo[] = []
  const secaoTar = encontrarSecao(root, SECAO_TAREFAS)
  if (secaoTar) {
    const tbl = secaoTar.tagName === 'TABLE' ? secaoTar : secaoTar.querySelector('table')
    if (tbl) tarefas = parsePrazos(tbl, 'tarefa')
  }

  // ── 7. Financeiro ──────────────────────────────────────────────────────────
  let honorarios: EasyJurHonorario[] = []
  let custas:     EasyJurHonorario[] = []
  let alvaras:    EasyJurHonorario[] = []

  const secaoHon = encontrarSecao(root, SECAO_HONORARIOS)
  if (secaoHon) {
    const tbl = secaoHon.tagName === 'TABLE' ? secaoHon : secaoHon.querySelector('table')
    if (tbl) honorarios = parseHonorarios(tbl)
  }

  const secaoCus = encontrarSecao(root, SECAO_CUSTAS)
  if (secaoCus) {
    const tbl = secaoCus.tagName === 'TABLE' ? secaoCus : secaoCus.querySelector('table')
    if (tbl) custas = parseHonorarios(tbl)
  }

  const secaoAlv = encontrarSecao(root, SECAO_ALVARAS)
  if (secaoAlv) {
    const tbl = secaoAlv.tagName === 'TABLE' ? secaoAlv : secaoAlv.querySelector('table')
    if (tbl) alvaras = parseHonorarios(tbl)
  }

  // ── 8. Dados complementares ─────────────────────────────────────────────────

  const incidentes: string[] = []
  const secaoInc = encontrarSecao(root, SECAO_INCIDENTES)
  if (secaoInc) incidentes.push(...extrairListaTexto(secaoInc))

  const processoApensados: string[] = []
  const secaoAp = encontrarSecao(root, SECAO_APENSADOS)
  if (secaoAp) {
    const nums = (secaoAp.textContent ?? '').match(RE_PROCESSO) ?? []
    processoApensados.push(...nums)
  }

  const pedidos: string[] = []
  const secaoPed = encontrarSecao(root, SECAO_PEDIDOS)
  if (secaoPed) pedidos.push(...extrairListaTexto(secaoPed))

  const documentos: string[] = []
  const secaoDoc = encontrarSecao(root, SECAO_DOCUMENTOS)
  if (secaoDoc) documentos.push(...extrairListaTexto(secaoDoc))

  return {
    numero_processo:     numeroProcesso,
    titulo:             null,   // gerado pela API com base no número/cliente
    area_direito:       areaDireito,
    status,
    tribunal,
    vara,
    cliente,
    cpf_cnpj_cliente:   cpfCnpj,
    parte_contraria:    parteContraria,
    partes_vinculadas:  partesVinculadas,
    responsavel,
    andamentos,
    ultimo_andamento:   ultimoAndamento,
    prazos,
    audiencias,
    tarefas,
    honorarios,
    custas,
    alvaras,
    incidentes,
    processos_apensados: processoApensados,
    pedidos,
    documentos,
    campos_nao_encontrados: naoEncontrados,
    avisos,
  }
}

// ── Estratégia multi-processo ─────────────────────────────────────────────────

/**
 * Tenta dividir o documento em blocos por processo.
 * Estratégias:
 *  A) Elementos com atributo id/class contendo o número de processo
 *  B) Headings que contêm o número de processo
 *  C) Documento inteiro = 1 processo
 */
function encontrarBlocosProcesso(doc: Document): Array<{ numero: string; root: Element | Document }> {
  const blocos: Array<{ numero: string; root: Element | Document }> = []
  const texto = doc.body?.textContent ?? ''
  const numeros = [...new Set([...texto.matchAll(RE_PROCESSO)].map(m => m[0]))]

  if (numeros.length === 0) return blocos

  if (numeros.length === 1) {
    // Relatório de processo único
    blocos.push({ numero: numeros[0], root: doc })
    return blocos
  }

  // Tenta encontrar seções separadas por heading ou div
  for (const numero of numeros) {
    const re = new RegExp(numero.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    // Busca element que contenha APENAS esse número (para evitar doc inteiro)
    const candidates = Array.from(doc.querySelectorAll('[id],[class],h1,h2,h3,h4,div,section'))
    for (const el of candidates) {
      const idClass = `${el.id ?? ''} ${el.className ?? ''}`
      if (re.test(idClass)) {
        blocos.push({ numero, root: el })
        break
      }
    }
    if (!blocos.find(b => b.numero === numero)) {
      // Fallback: encontra a primeira ocorrência e pega o container pai
      const walker = doc.createTreeWalker(doc.body ?? doc, NodeFilter.SHOW_TEXT)
      let node: Text | null
      while ((node = walker.nextNode() as Text | null)) {
        if (re.test(node.textContent ?? '')) {
          let el: Element | null = node.parentElement
          // Sobe até encontrar um container significativo
          while (el && !['DIV', 'SECTION', 'ARTICLE', 'TD'].includes(el.tagName)) {
            el = el.parentElement
          }
          blocos.push({ numero, root: el ?? doc })
          break
        }
      }
    }
  }

  return blocos
}

// ── Ponto de entrada público ──────────────────────────────────────────────────

/**
 * Faz o parse do HTML do Relatório Analítico do EasyJur.
 * Roda no browser — usa DOMParser (sem dependências extras).
 */
export function parseEasyJurHtml(htmlText: string, arquivoNome: string): EasyJurParseResult {
  const errosGlobais: string[] = []

  // Sanitiza BOM e parse
  const clean = htmlText.replace(/^﻿/, '')
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(clean, 'text/html')
  } catch {
    return { processos: [], arquivo_nome: arquivoNome, total_encontrados: 0, erros_parse: ['Falha ao interpretar o HTML — arquivo inválido ou corrompido.'] }
  }

  if (!doc.body || !doc.body.textContent?.trim()) {
    errosGlobais.push('O arquivo HTML está vazio ou não contém texto legível.')
    return { processos: [], arquivo_nome: arquivoNome, total_encontrados: 0, erros_parse: errosGlobais }
  }

  const blocos = encontrarBlocosProcesso(doc)

  if (blocos.length === 0) {
    errosGlobais.push('Nenhum número de processo (formato CNJ) encontrado no arquivo.')
    return { processos: [], arquivo_nome: arquivoNome, total_encontrados: 0, erros_parse: errosGlobais }
  }

  const processos = blocos.map(({ numero, root }) => parseProcessoBloco(root, numero))

  return {
    processos,
    arquivo_nome:      arquivoNome,
    total_encontrados: processos.length,
    erros_parse:       errosGlobais,
  }
}
