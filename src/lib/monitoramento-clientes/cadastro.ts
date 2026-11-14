// ─── Cadastro de documentos monitorados: validação e "colar em lote" ─────────
//
// Puro (sem rede/banco): usado pela API e pela tela.

import { validarDocumento, type TipoDocumento } from './documento'
import { nomesUnicos, normalizarNome } from './nomes'

export interface EntradaDocumento {
  documento?: unknown
  nome_principal?: unknown
  nomes_busca?: unknown
  contrato_ref?: unknown
  vigencia_inicio?: unknown
  vigencia_fim?: unknown
  observacoes?: unknown
}

export interface DocumentoValidado {
  documento: string
  tipo: TipoDocumento
  nome_principal: string
  /** Variações ALÉM do nome principal (o principal sempre é buscado). */
  nomes_busca: string[]
  contrato_ref: string | null
  vigencia_inicio: string | null
  vigencia_fim: string | null
  observacoes: string | null
}

export type ResultadoValidacao =
  | { ok: true; valor: DocumentoValidado }
  | { ok: false; erro: string }

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

function textoOuNull(v: unknown): string | null {
  const t = typeof v === 'string' ? v.trim() : ''
  return t ? t : null
}

export function dataValida(v: string): boolean {
  if (!DATA_RE.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** Lista de nomes vinda como array de strings ou como texto separado por ";", "|" ou quebra de linha. */
export function listaDeNomes(v: unknown): string[] {
  const bruto = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[;|\n]/) : []
  return bruto.filter((x): x is string => typeof x === 'string')
}

/** Valida UM documento a cadastrar. Não consulta nada externo: o nome é obrigatório. */
export function validarEntradaDocumento(entrada: EntradaDocumento): ResultadoValidacao {
  const doc = validarDocumento(typeof entrada.documento === 'string' ? entrada.documento : String(entrada.documento ?? ''))
  if (!doc.ok) return { ok: false, erro: doc.erro }

  const nomePrincipal = typeof entrada.nome_principal === 'string' ? entrada.nome_principal.replace(/\s+/g, ' ').trim() : ''
  if (!nomePrincipal) return { ok: false, erro: 'Informe o nome do cliente (nome_principal): a busca no DJEN é feita pelo nome.' }
  if (normalizarNome(nomePrincipal).length < 3) return { ok: false, erro: 'O nome do cliente é curto demais para uma busca confiável.' }

  const principalNorm = normalizarNome(nomePrincipal)
  const variacoes = nomesUnicos(listaDeNomes(entrada.nomes_busca)).filter(n => normalizarNome(n) !== principalNorm)

  const inicio = textoOuNull(entrada.vigencia_inicio)
  const fim = textoOuNull(entrada.vigencia_fim)
  if (inicio && !dataValida(inicio)) return { ok: false, erro: 'Início da vigência inválido (use AAAA-MM-DD).' }
  if (fim && !dataValida(fim)) return { ok: false, erro: 'Fim da vigência inválido (use AAAA-MM-DD).' }
  if (inicio && fim && fim < inicio) return { ok: false, erro: 'O fim da vigência é anterior ao início.' }

  return {
    ok: true,
    valor: {
      documento: doc.documento,
      tipo: doc.tipo,
      nome_principal: nomePrincipal,
      nomes_busca: variacoes,
      contrato_ref: textoOuNull(entrada.contrato_ref),
      vigencia_inicio: inicio,
      vigencia_fim: fim,
      observacoes: textoOuNull(entrada.observacoes),
    },
  }
}

// ─── Colar em lote ───────────────────────────────────────────────────────────

export interface LinhaLote {
  /** Número da linha no texto colado (1-based). */
  linha: number
  documento: string
  nome_principal: string
  nomes_busca: string[]
}

export interface ErroLote {
  linha: number
  texto: string
  erro: string
}

export interface ResultadoLote {
  linhas: LinhaLote[]
  erros: ErroLote[]
}

/**
 * Uma linha por documento: `CNPJ ou CPF; nome do cliente; nome alternativo opcional`.
 * Campos extras (3º em diante) são outros nomes alternativos. Aceita também TAB
 * (colar de planilha). Linhas em branco e que começam com "#" são ignoradas.
 * Valida o dígito verificador; linhas inválidas vão para `erros` sem barrar as boas.
 */
export function parseLote(texto: string): ResultadoLote {
  const linhas: LinhaLote[] = []
  const erros: ErroLote[] = []

  texto.split(/\r?\n/).forEach((bruta, i) => {
    const conteudo = bruta.trim()
    if (!conteudo || conteudo.startsWith('#')) return
    const campos = conteudo.split(/[;\t]/).map(c => c.trim())
    const [doc, nome, ...alternativos] = campos

    const validacao = validarEntradaDocumento({ documento: doc, nome_principal: nome, nomes_busca: alternativos })
    if (!validacao.ok) {
      erros.push({ linha: i + 1, texto: conteudo, erro: validacao.erro })
      return
    }
    linhas.push({
      linha: i + 1,
      documento: validacao.valor.documento,
      nome_principal: validacao.valor.nome_principal,
      nomes_busca: validacao.valor.nomes_busca,
    })
  })

  // o mesmo documento duas vezes no lote: mantém a primeira, avisa nas demais
  const vistos = new Set<string>()
  const unicas: LinhaLote[] = []
  for (const l of linhas) {
    if (vistos.has(l.documento)) {
      erros.push({ linha: l.linha, texto: `${l.documento}; ${l.nome_principal}`, erro: 'Documento repetido no lote (mantida a primeira linha).' })
    } else {
      vistos.add(l.documento)
      unicas.push(l)
    }
  }
  erros.sort((a, b) => a.linha - b.linha)
  return { linhas: unicas, erros }
}
