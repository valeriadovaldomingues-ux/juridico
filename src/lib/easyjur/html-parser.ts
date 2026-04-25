/**
 * src/lib/easyjur/html-parser.ts
 *
 * Parser do Relatório Analítico do EasyJur (HTML).
 *
 * ESTRUTURA REAL MAPEADA DO HTML (app.easyjur.com):
 *
 *  <div class="container-processo">
 *    <div>                                    ← wrapper (1º filho)
 *      <div class="header p-3 text-center">
 *        <h5><strong>PROCESSO N° XXX</strong></h5>
 *      </div>
 *      <table>                                ← sem class (campos principais)
 *        <tbody><tr>
 *          <td><ul>
 *            <li><p><strong>Label:</strong> Valor</p></li>
 *            <li><p><strong>Descrição:</strong> </p><p>Texto longo</p></li>
 *          </ul></td>
 *          <td><ul>...</ul></td>
 *        </tr></tbody>
 *      </table>
 *    </div>
 *
 *    <div><hr><h5><strong>Partes</strong></h5>     ← seção
 *      <div class="my-2">                           ← item da seção
 *        <table class="tamanho-table">
 *          <tbody><tr><td><ul><li>...</li></ul></td></tr></tbody>
 *        </table>
 *      </div>
 *    </div>
 *    ... (Agendamentos, Andamentos, Receitas, Despesas, etc.)
 *  </div>
 *
 * ATENÇÃO: devido a </div> faltando em alguns blocos, os container-processo
 * ficam aninhados no DOM. Mas como cada seção é um sub-árvore isolada,
 * as extrações por seção funcionam corretamente.
 */

import type {
  EasyJurAndamento,
  EasyJurHonorario,
  EasyJurParseResult,
  EasyJurProcesso,
  EasyJurPrazo,
} from '@/types/easyjur'

// ── Utilitários ───────────────────────────────────────────────────────────────

function limpar(s: string | null | undefined): string {
  return (s ?? '').replace(/&nbsp;/g, ' ').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/\p{M}/gu, '')   // remove acentos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function parseMoeda(s: string): number | null {
  const cleaned = s.replace(/[^\d,]/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// ── Extração de campo de <li> ─────────────────────────────────────────────────
//
// Formato A (valor inline no mesmo <p>):
//   <li><p><strong>Cliente:</strong> Nome do cliente</p></li>
//
// Formato B (valor em <p> separado — textos longos):
//   <li>
//     <p class="text-justify"><strong>Descrição:</strong> </p>
//     <p>Texto da descrição.</p>
//   </li>

function extrairCampoLi(li: Element): { chave: string; valor: string } | null {
  const strong = li.querySelector('strong')
  if (!strong) return null

  const chave = limpar(strong.textContent ?? '').replace(/:$/, '')
  if (!chave) return null

  // Valor inline: texto nos nós de texto irmãos do <strong> dentro do mesmo <p>
  let valor = ''
  const parentP = strong.parentElement
  if (parentP) {
    for (const node of Array.from(parentP.childNodes)) {
      if (node.nodeType === 3 /* Node.TEXT_NODE */) {
        valor += node.textContent ?? ''
      }
    }
    valor = valor.trim()

    // Formato B: sem valor inline → busca <p> irmãos seguintes dentro do <li>
    if (!valor) {
      let sib = parentP.nextElementSibling
      const parts: string[] = []
      while (sib && sib.tagName === 'P') {
        const t = limpar(sib.textContent)
        if (t) parts.push(t)
        sib = sib.nextElementSibling
      }
      valor = parts.join(' ')
    }
  }

  return { chave, valor: limpar(valor) }
}

// ── Extrai todos os campos de <li> de um container ───────────────────────────

function extrairCampos(container: Element): Record<string, string> {
  const campos: Record<string, string> = {}
  for (const li of Array.from(container.querySelectorAll('li'))) {
    const r = extrairCampoLi(li)
    if (!r || !r.chave) continue
    const k = normalizeKey(r.chave)
    if (r.valor) {
      campos[k] = campos[k] ? campos[k] + ' ' + r.valor : r.valor
    }
  }
  return campos
}

// ── Encontra seção pelo nome do heading ──────────────────────────────────────
//
// Cada seção tem a estrutura:
//   <div>
//     <hr>
//     <h5 class="..."><strong>Nome da Seção</strong></h5>
//     ... conteúdo ...
//   </div>

function encontrarSecao(root: Element, nome: string): Element | null {
  for (const h5 of Array.from(root.querySelectorAll('h5'))) {
    // Interrompe se este h5 está dentro de um container-processo aninhado
    // (i.e., de um processo diferente)
    const closestCP = h5.closest('.container-processo')
    if (closestCP && closestCP !== root) continue

    const texto = limpar(h5.querySelector('strong')?.textContent ?? h5.textContent ?? '')
    if (texto.toLowerCase() === nome.toLowerCase()) {
      return h5.parentElement   // a <div> que contém hr + h5 + itens
    }
  }
  return null
}

// ── Extrai itens de uma seção ─────────────────────────────────────────────────
// Cada item é um <div class="my-2 [zebra-table]"> com uma tabela dentro

function extrairItensSecao(secaoEl: Element): Array<Record<string, string>> {
  const itens: Array<Record<string, string>> = []
  for (const itemDiv of Array.from(secaoEl.querySelectorAll('.my-2'))) {
    // Ignora itens de seções aninhadas (outros processos)
    const closestCP = itemDiv.closest('.container-processo')
    const secaoCP   = secaoEl.closest('.container-processo')
    if (closestCP && secaoCP && closestCP !== secaoCP) continue

    const campos = extrairCampos(itemDiv)
    if (Object.keys(campos).length > 0) itens.push(campos)
  }
  return itens
}

// ── Mapeadores de tipo ────────────────────────────────────────────────────────

function mapTipoEvento(raw: string | undefined): EasyJurPrazo['tipo'] {
  const n = (raw ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
  if (/audiencia|julgamento|sessao/.test(n)) return 'audiencia'
  if (/prazo/.test(n))                       return 'prazo'
  if (/tarefa/.test(n))                      return 'tarefa'
  return 'outro'
}

function mapStatusAgenda(raw: string | undefined): string {
  const n = (raw ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
  if (/conclu|realiz|done|execut/.test(n)) return 'concluido'
  if (/cancel/.test(n))                    return 'cancelado'
  return 'pendente'
}

// ── Parser de um bloco de processo ───────────────────────────────────────────

function parseBloco(processoDiv: Element): EasyJurProcesso {
  const naoEncontrados: string[] = []
  const avisos: string[] = []

  // ── 1. Número do processo (header) ─────────────────────────────────────────
  const headerEl  = processoDiv.querySelector('.header strong, .header h5')
  const headerTxt = limpar(headerEl?.textContent ?? '')
  const numMatch  = headerTxt.match(/\d{4,}[\d.\-/]+\d/)
  const numero_processo = numMatch ? limpar(numMatch[0]) : null

  // ── 2. Tabela principal de campos ──────────────────────────────────────────
  // A tabela de campos não tem class; as tabelas de seção têm class="tamanho-table"
  const mainTable = processoDiv.querySelector('table:not(.tamanho-table)')
  const campos    = mainTable ? extrairCampos(mainTable) : {}

  // Mapeamento exato dos labels do EasyJur
  const cliente        = campos['cliente']           || null
  const parteContraria = campos['contrario']         || null   // EasyJur usa "Contrário"
  const responsavel    = campos['advogado']          || null   // EasyJur usa "Advogado"
  const titulo         = campos['titulo']            || null
  const tipoAcao       = campos['tipo_de_acao']      || null
  const qualificacao   = campos['qualificacao']      || null   // Autor | Reu
  const areaDireito    = campos['area']              || null
  const statusRaw      = campos['status_processo']   || null
  const tribunal       = campos['tribunal']          || null
  const vara           = campos['vara']              || null
  const comarca        = campos['comarca']           || null
  const uf             = campos['uf']                || null
  const instancia      = campos['instancia']         || null
  const fase           = campos['fase_atual']        || null
  const valorCausa     = campos['valor_da_causa']    || null
  const dataDist       = campos['data_de_distribuicao'] || null
  const observacoes    = campos['observacoes']       || null
  const cpfCnpj        = campos['cpf_cnpj'] || campos['cpf'] || campos['cnpj'] || null

  // Polo ativo / passivo derivado da Qualificação
  let poloAtivo: string | null = null
  let poloPassivo: string | null = null
  if (qualificacao) {
    const q = qualificacao.toLowerCase()
    if (q.includes('autor') || q.includes('exequente') || q.includes('reclamante') || q.includes('requerente')) {
      poloAtivo  = cliente
      poloPassivo = parteContraria
    } else {
      poloAtivo  = parteContraria
      poloPassivo = cliente
    }
  }

  if (!cliente)        naoEncontrados.push('cliente')
  if (!parteContraria) naoEncontrados.push('parte_contraria')
  if (!responsavel)    naoEncontrados.push('responsavel')

  // ── 3. Seção "Partes" → partes vinculadas ─────────────────────────────────
  const partesVinculadas: string[] = []
  const secaoPartes = encontrarSecao(processoDiv, 'Partes')
  if (secaoPartes) {
    for (const item of extrairItensSecao(secaoPartes)) {
      const nome = limpar(item['nome_da_parte'] ?? '')
      const qual = (item['qualificacao'] ?? '').toLowerCase()
      if (nome && qual !== 'autor' && qual !== 'reu' &&
          qual !== 'exequente' && qual !== 'executado' &&
          qual !== 'reclamante' && qual !== 'reclamado') {
        partesVinculadas.push(nome)
      }
    }
  }

  // ── 4. Andamentos ──────────────────────────────────────────────────────────
  // Item 1/N = mais recente (EasyJur ordena do mais novo ao mais antigo)
  const andamentos: EasyJurAndamento[] = []
  const secaoAnd = encontrarSecao(processoDiv, 'Andamentos')
  if (secaoAnd) {
    for (const item of extrairItensSecao(secaoAnd)) {
      andamentos.push({
        data:      item['data_andamento'] || null,
        tipo:      item['tipo_do_andamento'] || null,
        descricao: item['descricao'] || '',
      })
    }
  }
  const ultimoAndamento = andamentos.length > 0
    ? [andamentos[0].data, andamentos[0].tipo, andamentos[0].descricao].filter(Boolean).join(' — ')
    : null

  // ── 5. Agendamentos → prazos / audiências / tarefas ───────────────────────
  const prazos:    EasyJurPrazo[] = []
  const audiencias: EasyJurPrazo[] = []
  const tarefas:   EasyJurPrazo[] = []

  const secaoAg = encontrarSecao(processoDiv, 'Agendamentos')
  if (secaoAg) {
    for (const item of extrairItensSecao(secaoAg)) {
      const tipo = mapTipoEvento(item['tipo_evento'])
      const prazo: EasyJurPrazo = {
        titulo:    item['descricao'] || item['tipo_evento'] || 'Agendamento',
        data:      item['data_fatal'] || item['data_interna'] || null,
        tipo,
        status:    mapStatusAgenda(item['status']),
        prioridade: null,
        local:     null,
      }
      if (tipo === 'audiencia')   audiencias.push(prazo)
      else if (tipo === 'tarefa') tarefas.push(prazo)
      else                        prazos.push(prazo)
    }
  }

  // ── 6. Financeiro ──────────────────────────────────────────────────────────
  const honorarios: EasyJurHonorario[] = []
  const custas:     EasyJurHonorario[] = []
  const alvaras:    EasyJurHonorario[] = []

  const secaoRec = encontrarSecao(processoDiv, 'Receitas')
  if (secaoRec) {
    for (const item of extrairItensSecao(secaoRec)) {
      const valStr = Object.values(item).find(v => /r\$/i.test(v)) ?? ''
      honorarios.push({
        descricao: item['descricao'] || item['tipo'] || item['historico'] || '',
        valor:     parseMoeda(valStr),
        data:      item['data'] || item['data_vencimento'] || null,
        status:    item['status'] || null,
      })
    }
  }

  const secaoDes = encontrarSecao(processoDiv, 'Despesas')
  if (secaoDes) {
    for (const item of extrairItensSecao(secaoDes)) {
      const valStr = Object.values(item).find(v => /r\$/i.test(v)) ?? ''
      custas.push({
        descricao: item['descricao'] || item['tipo'] || item['historico'] || '',
        valor:     parseMoeda(valStr),
        data:      item['data'] || item['data_vencimento'] || null,
        status:    item['status'] || null,
      })
    }
  }

  const secaoAlv = encontrarSecao(processoDiv, 'Alvarás e Depósitos')
  if (secaoAlv) {
    for (const item of extrairItensSecao(secaoAlv)) {
      const valStr = Object.values(item).find(v => /r\$/i.test(v)) ?? ''
      alvaras.push({
        descricao: item['descricao'] || item['tipo'] || '',
        valor:     parseMoeda(valStr),
        data:      item['data'] || null,
        status:    item['status'] || null,
      })
    }
  }

  // ── 7. Processos Vinculados ────────────────────────────────────────────────
  const processosApensados: string[] = []
  const secaoVin = encontrarSecao(processoDiv, 'Processos Vinculados')
  if (secaoVin) {
    const nums = (limpar(secaoVin.textContent ?? '')).match(/\d{4,}[\d.\-/]+\d/g) ?? []
    processosApensados.push(...nums.filter(n => n !== numero_processo))
  }

  // ── 8. Pedidos ────────────────────────────────────────────────────────────
  const pedidos: string[] = []
  const secaoPed = encontrarSecao(processoDiv, 'Pedidos')
  if (secaoPed) {
    for (const item of extrairItensSecao(secaoPed)) {
      const t = Object.values(item).join(' ').trim()
      if (t) pedidos.push(t)
    }
  }

  // ── 9. Documentos Anexados ────────────────────────────────────────────────
  const documentos: string[] = []
  const secaoDoc = encontrarSecao(processoDiv, 'Documentos Anexados')
  if (secaoDoc) {
    for (const item of extrairItensSecao(secaoDoc)) {
      const arq  = item['arquivo'] || ''
      const data = item['data']    || ''
      if (arq) documentos.push([data, arq].filter(Boolean).join(' — '))
    }
  }

  // ── 10. Incidentes ────────────────────────────────────────────────────────
  const incidentes: string[] = []
  const secaoInc = encontrarSecao(processoDiv, 'Incidentes Vinculados')
    ?? encontrarSecao(processoDiv, 'Incidentes')
  if (secaoInc) {
    for (const item of extrairItensSecao(secaoInc)) {
      const t = Object.values(item).filter(Boolean).join(' ')
      if (t) incidentes.push(t)
    }
  }

  return {
    numero_processo,
    titulo:              titulo || (cliente ? `Processo — ${cliente}` : null),
    area_direito:        areaDireito,
    status:              statusRaw,
    tribunal,
    vara:                vara || comarca,
    cliente,
    cpf_cnpj_cliente:    cpfCnpj,
    parte_contraria:     parteContraria,
    partes_vinculadas:   partesVinculadas,
    responsavel,
    andamentos,
    ultimo_andamento:    ultimoAndamento,
    prazos,
    audiencias,
    tarefas,
    honorarios,
    custas,
    alvaras,
    incidentes,
    processos_apensados: processosApensados,
    pedidos,
    documentos,
    campos_nao_encontrados: naoEncontrados,
    avisos,
    // Campos extras salvos nos avisos para rastreabilidade
    _extra: {
      tipo_acao:    tipoAcao,
      qualificacao,
      polo_ativo:   poloAtivo,
      polo_passivo: poloPassivo,
      instancia,
      fase_processual: fase,
      valor_causa:  valorCausa,
      data_distribuicao: dataDist,
      observacoes,
      uf,
    },
  } as EasyJurProcesso & { _extra: Record<string, string | null> }
}

// ── Ponto de entrada público ──────────────────────────────────────────────────

export function parseEasyJurHtml(htmlText: string, arquivoNome: string): EasyJurParseResult {
  const erros: string[] = []

  let doc: Document
  try {
    doc = new DOMParser().parseFromString(htmlText.replace(/^﻿/, ''), 'text/html')
  } catch {
    return { processos: [], arquivo_nome: arquivoNome, total_encontrados: 0, erros_parse: ['Erro ao interpretar o HTML.'] }
  }

  const containers = Array.from(doc.querySelectorAll('.container-processo'))

  if (containers.length === 0) {
    erros.push(
      'Nenhum bloco de processo encontrado (.container-processo). ' +
      'Salve o relatório como "Página Web Completa" (não como "Arquivo HTML Único").'
    )
    return { processos: [], arquivo_nome: arquivoNome, total_encontrados: 0, erros_parse: erros }
  }

  const processos = containers
    .map(div => parseBloco(div))
    .filter(p => p.numero_processo !== null)

  if (processos.length === 0) {
    erros.push(`Encontrei ${containers.length} blocos mas nenhum continha número de processo válido.`)
  }

  return {
    processos,
    arquivo_nome:      arquivoNome,
    total_encontrados: processos.length,
    erros_parse:       erros,
  }
}
