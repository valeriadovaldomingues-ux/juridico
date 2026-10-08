// ─────────────────────────────────────────────────────────────────────────────
// src/lib/agenda-import/vinculos.ts
//
// Liga cada evento importado ao PROCESSO e ao CLIENTE do sistema.
//
//  - Processo: compara só os dígitos do número (o EasyJur e o cadastro às vezes
//    trazem aspas, pontos e traços diferentes). Número que aparece em mais de
//    um processo é ambíguo e não é ligado.
//  - Cliente: 1º o cliente do processo encontrado; 2º CPF/CNPJ vindo de
//    "Dados do Cliente" do EasyJur; 3º nome igual (sem acento/pontuação/caixa),
//    só se for único. Nada é adivinhado.
// ─────────────────────────────────────────────────────────────────────────────

export const soDigitos = (s: string | null | undefined): string => (s ?? '').replace(/\D/g, '')

/** Extrai o CPF/CNPJ de textos como "IRRICOM LTDA - DOC.:17.294.960/0001-04". */
export function extrairDocumento(dados: string | null | undefined): string | null {
  const m = /DOC\.?\s*:\s*([\d./-]+)/i.exec(dados ?? '')
  const digitos = soDigitos(m?.[1])
  return digitos.length === 11 || digitos.length === 14 ? digitos : null
}

export function normalizarNome(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export interface ProcessoRef { id: string; numero_processo: string | null; cliente_id: string | null }
export interface ClienteRef  { id: string; nome: string; cpf_cnpj: string | null }

export interface IndiceVinculos {
  processos: Map<string, ProcessoRef | null>   // dígitos → processo (null = ambíguo)
  clientesPorDoc: Map<string, string | null>   // dígitos → cliente_id (null = ambíguo)
  clientesPorNome: Map<string, string | null>  // nome normalizado → cliente_id (null = ambíguo)
}

function adicionar<V>(map: Map<string, V | null>, chave: string, valor: V) {
  if (!chave) return
  map.set(chave, map.has(chave) ? null : valor)
}

export function montarIndice(processos: ProcessoRef[], clientes: ClienteRef[]): IndiceVinculos {
  const idx: IndiceVinculos = { processos: new Map(), clientesPorDoc: new Map(), clientesPorNome: new Map() }
  for (const p of processos) {
    const d = soDigitos(p.numero_processo)
    if (d.length >= 15) adicionar(idx.processos, d, p)
  }
  for (const c of clientes) {
    const doc = soDigitos(c.cpf_cnpj)
    if (doc.length === 11 || doc.length === 14) adicionar(idx.clientesPorDoc, doc, c.id)
    adicionar(idx.clientesPorNome, normalizarNome(c.nome), c.id)
  }
  return idx
}

export function resolverVinculos(
  evento: { process_number: string | null; client_name: string | null; client_doc: string | null },
  idx: IndiceVinculos,
): { processo_id: string | null; cliente_id: string | null } {
  const digitos  = soDigitos(evento.process_number)
  const processo = digitos.length >= 15 ? idx.processos.get(digitos) ?? null : null

  const cliente_id =
    processo?.cliente_id ??
    (evento.client_doc ? idx.clientesPorDoc.get(evento.client_doc) ?? null : null) ??
    idx.clientesPorNome.get(normalizarNome(evento.client_name)) ??
    null

  return { processo_id: processo?.id ?? null, cliente_id }
}
