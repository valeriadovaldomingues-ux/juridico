/**
 * src/lib/easyjur/html-parser.ts
 *
 * Parser do Relatório Analítico do EasyJur (HTML).
 * Baseado na estrutura real do export: app.easyjur.com
 *
 * ESTRUTURA REAL DO EASYJUR:
 *
 * <div class="container-processo">
 *   <div class="header p-3 text-center">
 *     <h5><strong>PROCESSO N° 0000000-00.0000.0.00.0000</strong></h5>
 *   </div>
 *
 *   <table>          ← campos principais (2 colunas de <ul><li>)
 *     <td><ul>
 *       <li><p><strong>Cliente:</strong> Nome do cliente</p></li>
 *       <li><p><strong>Contrário:</strong> Parte contrária</p></li>  ← NÃO "Parte Contrária"
 *       <li><p><strong>Advogado:</strong> Nome</p></li>              ← NÃO "Responsável"
 *       <li><p><strong>Área:</strong> Trabalhista</p></li>
 *       <li><p><strong>Status Processo:</strong> Substabelecido</p></li>
 *       <li><p><strong>Tribunal:</strong> TRT03</p></li>
 *     </ul></td>
 *     <td><ul>
 *       <li><p><strong>Vara:</strong> 11ª Vara</p></li>
 *       ...
 *     </ul></td>
 *   </table>
 *
 *   <div><hr><h5><strong>Partes</strong></h5>
 *     <div class="my-2"><table><li>Nome da Parte / Qualificação</li></table></div>
 *   </div>
 *
 *   <div><hr><h5><strong>Agendamentos</strong></h5>
 *     <div class="my-2"><table>
 *       <li>Tipo Evento / Status / Descrição / Data Fatal / Data Interna</li>
 *     </table></div>
 *   </div>
 *
 *   <div><hr><h5><strong>Andamentos</strong></h5>
 *     <div class="my-2"><table>
 *       <li>Responsável / Tipo do Andamento / Data Andamento / Descrição</li>
 *     </table></div>
 *     ← Item 1/N é o mais recente
 *   </div>
 *
 *   <div><hr><h5><strong>Documentos Anexados</strong></h5>
 *     <div class="my-2"><table><li>Data / Arquivo</li></table></div>
 *   </div>
 * </div>
 */

import type {
  EasyJurAndamento,
  EasyJurHonorario,
  EasyJurParseResult,
  EasyJurProcesso,
  EasyJurPrazo,
} from '@/types/easyjur'

// ── Utilitários básicos ────────────────────────────────────────────────────────

function limpar(s: string | null | undefined): string {
  return (s ?? '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function parseMoeda(s: string): number | null {
  const digits = s.replace(/[^\d,]/g, '').replace(',', '.')
  const n = parseFloat(digits)
  return isNaN(n) ? null : n
}

// ── Extração de campo de um <li> do EasyJur ───────────────────────────────────
//
// Dois formatos encontrados:
//
// Formato A (valor inline):
//   <li><p><strong>Cliente:</strong> Nome do cliente</p></li>
//
// Formato B (valor em p separado):
//   <li>
//     <p class="text-justify"><strong>Descrição:</strong> </p>
//     <p>Texto da descrição aqui.</p>
//     <p></p>
//   </li>

function extrairCampoLi(li: Element): { chave: string; valor: string } | null {
  const strong = li.querySelector('strong')
  if (!strong) return null

  const chave = limpar(strong.textContent ?? '').replace(/:$/, '')
  if (!chave) return null

  // Valor inline: texto após </strong> no mesmo <p>
  const parentP = strong.parentElement
  let valor = ''

  if (parentP) {
    // Itera nos filhos do <p> ignorando o próprio <strong>
    for (const node of Array.from(parentP.childNodes)) {
      if (node.nodeType === 3 /* TEXT_NODE */) {
        valor += node.textContent ?? ''
      }
    }
    valor = valor.trim()

    // Formato B: valor em <p> seguintes
    if (!valor) {
      let sib = parentP.nextElementSibling
      const partes: string[] = []
      while (sib && sib.tagName === 'P') {
        const t = limpar(sib.textContent)
        if (t) partes.push(t)
        sib = sib.nextElementSibling
      }
      valor = partes.join(' ')
    }
  }

  return { chave, valor: limpar(valor) }
}

// ── Extração de todos os campos de <li> de um container ───────────────────────

function extrairCamposDoContainer(container: Element): Record<string, string> {
  const campos: Record<string, string> = {}
  for (const li of Array.from(container.querySelectorAll('li'))) {
    const resultado = extrairCampoLi(li)
    if (resultado && resultado.chave) {
      const k = normalizeKey(resultado.chave)
      // Agrega valores para campos de descrição com múltiplas linhas
      if (campos[k] && resultado.valor) {
        campos[k] += ' ' + resultado.valor
      } else if (resultado.valor) {
        campos[k] = resultado.valor
      }
    }
  }
  return campos
}

// ── Encontra seção pelo texto do heading ───────────────────────────────────────
//
// Seções têm: <div><hr><h5 class="..."><strong>Nome da Seção</strong></h5>...</div>
// O conteúdo dos itens é o sibling div (ou filhos da mesma div).

function encontrarSecao(processoDiv: Element, nomeExato: string): Element | null {
  for (const h5 of Array.from(processoDiv.querySelectorAll('h5'))) {
    const texto = limpar(h5.querySelector('strong')?.textContent ?? h5.textContent ?? '')
    if (texto.toLowerCase() === nomeExato.toLowerCase()) {
      return h5.parentElement   // a div que contém o h5 e os itens
    }
  }
  return null
}

// ── Extrai itens de uma seção (cada item = <div class="my-2 ..."> ─────────────

function extrairItensSecao(secaoEl: Element): Array<Record<string, string>> {
  const itens: Array<Record<string, string>> = []
  for (const itemDiv of Array.from(secaoEl.querySelectorAll('.my-2'))) {
    const campos = extrairCamposDoContainer(itemDiv)
    if (Object.keys(campos).length > 0) itens.push(campos)
  }
  return itens
}

// ── Mapeamentos de tipo ────────────────────────────────────────────────────────

function mapTipoEvento(raw: string | undefined): EasyJurPrazo['tipo'] {
  if (!raw) return 'outro'
  const n = raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
  if (/audiencia|julgamento/.test(n)) return 'audiencia'
  if (/prazo/.test(n))               return 'prazo'
  if (/tarefa/.test(n))              return 'tarefa'
  return 'outro'
}

function mapStatusAgenda(raw: string | undefined): string {
  const n = (raw ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
  if (/conclu|realiz|done/.test(n)) return 'concluido'
  return 'pendente'
}

// ── Parser do bloco de um processo ────────────────────────────────────────────

function parseProcesso(processoDiv: Element): EasyJurProcesso {
  const naoEncontrados: string[] = []
  const avisos: string[] = []

  // ── 1. Número do processo (do header) ──────────────────────────────────────
  const headerEl = processoDiv.querySelector('.header h5 strong, .header strong')
  const headerText = limpar(headerEl?.textContent ?? '')
  const numeroMatch = headerText.match(/\d[\d\-./]+\d/)
  const numero_processo = numeroMatch ? limpar(numeroMatch[0]) : null

  // ── 2. Campos principais (tabela logo após o header) ───────────────────────
  // A tabela de campos fica dentro do primeiro <div> filho (sem class="header")
  const mainTable = processoDiv.querySelector(':scope > div:not([class*="header"]) > table, :scope > div > div > table')
  const campos: Record<string, string> = mainTable
    ? extrairCamposDoContainer(mainTable)
    : {}

  // Aliases exatos do EasyJur → nosso sistema
  const cliente           = campos['cliente']          || null
  const parteContraria    = campos['contrario']        || null   // ← "Contrário", não "Parte Contrária"
  const responsavel       = campos['advogado']         || null   // ← "Advogado", não "Responsável"
  const titulo            = campos['titulo']           || null
  const areaRaw           = campos['area']             || null
  const statusRaw         = campos['status_processo']  || null
  const tribunal          = campos['tribunal']         || null
  const vara              = campos['vara']             || null
  const comarca           = campos['comarca']          || null
  const uf                = campos['uf']               || null
  const cpfCnpj           = campos['cpf_cnpj']        || campos['cpf'] || campos['cnpj'] || null
  const valorCausa        = campos['valor_da_causa']   || null
  const dataDistribuicao  = campos['data_de_distribuicao'] || null
  const fase              = campos['fase_atual']       || null
  const observacoes       = campos['observacoes']      || null

  if (!cliente)        naoEncontrados.push('cliente')
  if (!parteContraria) naoEncontrados.push('parte_contraria')
  if (!responsavel)    naoEncontrados.push('responsavel')

  // ── 3. Partes (seção "Partes") ──────────────────────────────────────────────
  const partesVinculadas: string[] = []
  const secaoPartes = encontrarSecao(processoDiv, 'Partes')
  if (secaoPartes) {
    for (const item of extrairItensSecao(secaoPartes)) {
      const nome = item['nome_da_parte']?.trim()
      const qual = (item['qualificacao'] ?? '').trim().toLowerCase()
      if (nome) {
        // Autor = cliente (já extraído dos campos principais)
        // Reu = parte contrária (já extraído)
        // Outros = partes vinculadas
        if (qual !== 'autor' && qual !== 'reu') {
          partesVinculadas.push(nome)
        } else if (qual === 'reu' && !parteContraria) {
          // fallback: se não encontrou contrário no header, pega da seção Partes
        }
      }
    }
  }

  // ── 4. Andamentos (item 1 = mais recente) ─────────────────────────────────
  let andamentos: EasyJurAndamento[] = []
  const secaoAnd = encontrarSecao(processoDiv, 'Andamentos')
  if (secaoAnd) {
    for (const item of extrairItensSecao(secaoAnd)) {
      andamentos.push({
        data:      item['data_andamento'] || null,
        tipo:      item['tipo_do_andamento'] || null,
        descricao: item['descricao'] || item['descricao_'] || '',
      })
    }
  }

  // Último andamento real = primeiro da lista (EasyJur ordena do mais recente para o mais antigo)
  const ultimoAndamento = andamentos.length > 0
    ? [andamentos[0].data, andamentos[0].tipo, andamentos[0].descricao].filter(Boolean).join(' — ')
    : null

  // ── 5. Agendamentos (prazos + audiências + tarefas) ───────────────────────
  const prazos:    EasyJurPrazo[] = []
  const audiencias: EasyJurPrazo[] = []
  const tarefas:   EasyJurPrazo[] = []

  const secaoAg = encontrarSecao(processoDiv, 'Agendamentos')
  if (secaoAg) {
    for (const item of extrairItensSecao(secaoAg)) {
      const tipoEvento = mapTipoEvento(item['tipo_evento'])
      const prazo: EasyJurPrazo = {
        titulo:    item['descricao'] || item['tipo_evento'] || 'Agendamento',
        data:      item['data_fatal'] || item['data_interna'] || null,
        tipo:      tipoEvento,
        status:    mapStatusAgenda(item['status']),
        prioridade: null,
        local:     null,
      }
      if (tipoEvento === 'audiencia') audiencias.push(prazo)
      else if (tipoEvento === 'tarefa') tarefas.push(prazo)
      else prazos.push(prazo)
    }
  }

  // ── 6. Honorários / Receitas ───────────────────────────────────────────────
  const honorarios: EasyJurHonorario[] = []
  const secaoRec = encontrarSecao(processoDiv, 'Receitas')
  if (secaoRec) {
    for (const item of extrairItensSecao(secaoRec)) {
      const desc  = item['descricao'] || item['historico'] || item['tipo'] || ''
      const valor = Object.values(item).find(v => /r\$/.test(v.toLowerCase()))
      honorarios.push({
        descricao: desc,
        valor:     valor ? parseMoeda(valor) : null,
        data:      item['data'] || item['data_vencimento'] || null,
        status:    item['status'] || null,
      })
    }
  }

  // ── 7. Custas / Despesas ───────────────────────────────────────────────────
  const custas: EasyJurHonorario[] = []
  const secaoDes = encontrarSecao(processoDiv, 'Despesas')
  if (secaoDes) {
    for (const item of extrairItensSecao(secaoDes)) {
      const desc  = item['descricao'] || item['historico'] || item['tipo'] || ''
      const valor = Object.values(item).find(v => /r\$/.test(v.toLowerCase()))
      custas.push({
        descricao: desc,
        valor:     valor ? parseMoeda(valor) : null,
        data:      item['data'] || item['data_vencimento'] || null,
        status:    item['status'] || null,
      })
    }
  }

  // ── 8. Alvarás e Depósitos ─────────────────────────────────────────────────
  const alvaras: EasyJurHonorario[] = []
  const secaoAlv = encontrarSecao(processoDiv, 'Alvarás e Depósitos')
  if (secaoAlv) {
    for (const item of extrairItensSecao(secaoAlv)) {
      alvaras.push({
        descricao: item['descricao'] || item['tipo'] || '',
        valor:     item['valor'] ? parseMoeda(item['valor']) : null,
        data:      item['data'] || null,
        status:    item['status'] || null,
      })
    }
  }

  // ── 9. Processos Vinculados ────────────────────────────────────────────────
  const processosApensados: string[] = []
  const secaoVin = encontrarSecao(processoDiv, 'Processos Vinculados')
  if (secaoVin) {
    const textoVin = limpar(secaoVin.textContent ?? '')
    const nums = textoVin.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) ?? []
    processosApensados.push(...nums)
  }

  // ── 10. Pedidos ────────────────────────────────────────────────────────────
  const pedidos: string[] = []
  const secaoPed = encontrarSecao(processoDiv, 'Pedidos')
  if (secaoPed) {
    for (const item of extrairItensSecao(secaoPed)) {
      const texto = Object.values(item).join(' ').trim()
      if (texto) pedidos.push(texto)
    }
  }

  // ── 11. Documentos Anexados ────────────────────────────────────────────────
  const documentos: string[] = []
  const secaoDoc = encontrarSecao(processoDiv, 'Documentos Anexados')
  if (secaoDoc) {
    for (const item of extrairItensSecao(secaoDoc)) {
      const arquivo = item['arquivo'] || ''
      const data    = item['data']    || ''
      if (arquivo) documentos.push(`${data} — ${arquivo}`.trim().replace(/^— /, ''))
    }
  }

  return {
    numero_processo,
    titulo,
    area_direito:       areaRaw,
    status:             statusRaw,
    tribunal,
    vara:               vara || comarca,        // comarca como fallback de vara
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
    incidentes:         [],
    processos_apensados: processosApensados,
    pedidos,
    documentos,
    campos_nao_encontrados: naoEncontrados,
    avisos,
  }
}

// ── Ponto de entrada público ──────────────────────────────────────────────────

/**
 * Faz o parse do HTML do Relatório Analítico do EasyJur.
 * Roda no browser — usa DOMParser nativo, sem dependências extras.
 */
export function parseEasyJurHtml(htmlText: string, arquivoNome: string): EasyJurParseResult {
  const errosGlobais: string[] = []

  const clean = htmlText.replace(/^﻿/, '')   // remove BOM
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(clean, 'text/html')
  } catch {
    return {
      processos: [],
      arquivo_nome: arquivoNome,
      total_encontrados: 0,
      erros_parse: ['Falha ao interpretar o HTML — arquivo inválido ou corrompido.'],
    }
  }

  // Cada processo está em <div class="container-processo">
  const containers = Array.from(doc.querySelectorAll('.container-processo'))

  if (containers.length === 0) {
    errosGlobais.push(
      'Nenhum bloco de processo encontrado. ' +
      'Verifique se o arquivo é o Relatório Analítico do EasyJur salvo como HTML completo.'
    )
    return { processos: [], arquivo_nome: arquivoNome, total_encontrados: 0, erros_parse: errosGlobais }
  }

  const processos = containers
    .map(div => parseProcesso(div))
    .filter(p => p.numero_processo !== null)    // descarta blocos sem número

  return {
    processos,
    arquivo_nome:      arquivoNome,
    total_encontrados: processos.length,
    erros_parse:       errosGlobais,
  }
}
