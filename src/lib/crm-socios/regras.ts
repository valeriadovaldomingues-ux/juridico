// ─────────────────────────────────────────────────────────────────────────────
// CRM Cris e Val — regras puras (sem banco, sem React). Tudo testável.
// ─────────────────────────────────────────────────────────────────────────────

import {
  CRM_SOCIOS_DIAS_PARADA,
  CRM_SOCIOS_QTD_PROXIMAS_ACOES,
  ETAPAS,
  ETAPA_GANHO,
  ETAPA_IDS,
  ETAPA_PERDIDO,
  ETAPA_PROPOSTA,
  type EtapaId,
  type StatusOportunidade,
  type StatusProposta,
} from './constants'

/** Subconjunto de campos que as regras precisam — a UI e a API passam o registro completo. */
export interface OportunidadeBase {
  id: string
  nome: string
  etapa: EtapaId
  status: StatusOportunidade
  valor_estimado: number | null
  responsavel_id: string | null
  proxima_acao: string | null
  proxima_acao_data: string | null
  ultimo_contato_em: string | null
  created_at: string
  contato_nome?: string | null
  contato_telefone?: string | null
  contato_email?: string | null
  origem?: string | null
  indicado_por?: string | null
  area_interesse?: string | null
}

// ─── Etapas / status ─────────────────────────────────────────────────────────

export function ehEtapaValida(valor: unknown): valor is EtapaId {
  return typeof valor === 'string' && (ETAPA_IDS as readonly string[]).includes(valor)
}

export function ehEtapaTerminal(etapa: EtapaId): boolean {
  return ETAPAS.find(e => e.id === etapa)?.terminal ?? false
}

/** O status é sempre derivado da etapa: fechado → ganho, perdido → perdido, demais → aberto. */
export function statusDaEtapa(etapa: EtapaId): StatusOportunidade {
  if (etapa === ETAPA_GANHO) return 'ganho'
  if (etapa === ETAPA_PERDIDO) return 'perdido'
  return 'aberto'
}

export type ResultadoMovimento =
  | { ok: true; etapa: EtapaId; status: StatusOportunidade; motivo_perda: string | null; fechada: boolean; reaberta: boolean }
  | { ok: false; erro: string }

/**
 * Valida a mudança de etapa (arrastar no quadro ou editar na ficha).
 * Regras:
 *  - etapa de destino precisa existir;
 *  - qualquer etapa pode ir para qualquer outra (o quadro é livre), inclusive reabrir uma oportunidade fechada/perdida;
 *  - ir para "Perdido" exige o motivo da perda;
 *  - sair de "Perdido" limpa o motivo; ir para etapa aberta limpa a data de fechamento (feito pela API via `fechada`/`reaberta`).
 */
export function validarMovimento(
  de: EtapaId,
  para: unknown,
  motivoPerda?: string | null,
): ResultadoMovimento {
  if (!ehEtapaValida(para)) return { ok: false, erro: 'Etapa inválida.' }
  const motivo = (motivoPerda ?? '').trim()
  if (para === ETAPA_PERDIDO && !motivo) {
    return { ok: false, erro: 'Informe o motivo da perda.' }
  }
  return {
    ok: true,
    etapa: para,
    status: statusDaEtapa(para),
    motivo_perda: para === ETAPA_PERDIDO ? motivo : null,
    fechada: ehEtapaTerminal(para),
    reaberta: ehEtapaTerminal(de) && !ehEtapaTerminal(para),
  }
}

const ETAPAS_ANTES_DA_PROPOSTA: readonly EtapaId[] = ['contato_inicial', 'reuniao_marcada', 'reuniao_feita']

/**
 * Sugestão (nunca automática — a UI pede confirmação) de etapa quando uma proposta muda de status:
 *  - aceita → "Fechado (ganho)", se a oportunidade ainda não estiver ganha;
 *  - enviada → "Proposta enviada", se a oportunidade ainda estiver antes dessa etapa.
 * Devolve `null` quando não há o que sugerir.
 */
export function sugerirEtapaPorProposta(
  novoStatusProposta: StatusProposta,
  etapaOportunidade: EtapaId,
): EtapaId | null {
  if (novoStatusProposta === 'aceita' && etapaOportunidade !== ETAPA_GANHO) return ETAPA_GANHO
  if (novoStatusProposta === 'enviada' && ETAPAS_ANTES_DA_PROPOSTA.includes(etapaOportunidade)) return ETAPA_PROPOSTA
  return null
}

// ─── Datas ───────────────────────────────────────────────────────────────────

/** yyyy-mm-dd na hora local (o escritório é no Brasil; usar UTC viraria o dia às 21h). */
export function dataISOLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/

export function ehDataISO(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !SO_DATA.test(valor)) return false
  const d = new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor
}

const MS_DIA = 86_400_000

/** Dias inteiros desde `iso` até `hoje` (>= 0). Aceita timestamp ISO ou yyyy-mm-dd. */
export function diasDesde(iso: string, hoje: Date = new Date()): number {
  const t = SO_DATA.test(iso) ? new Date(`${iso}T00:00:00`).getTime() : new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((hoje.getTime() - t) / MS_DIA))
}

// ─── Parada / ação vencida ───────────────────────────────────────────────────

export function ehAberta(op: Pick<OportunidadeBase, 'status'>): boolean {
  return op.status === 'aberto'
}

/** Último contato; se nunca houve, vale a data de criação. */
export function referenciaDeContato(op: Pick<OportunidadeBase, 'ultimo_contato_em' | 'created_at'>): string {
  return op.ultimo_contato_em ?? op.created_at
}

export function diasSemInteracao(
  op: Pick<OportunidadeBase, 'ultimo_contato_em' | 'created_at'>,
  hoje: Date = new Date(),
): number {
  return diasDesde(referenciaDeContato(op), hoje)
}

/** Parada = aberta e sem interação há `limite` dias ou mais. */
export function estaParada(
  op: Pick<OportunidadeBase, 'status' | 'ultimo_contato_em' | 'created_at'>,
  hoje: Date = new Date(),
  limite: number = CRM_SOCIOS_DIAS_PARADA,
): boolean {
  return ehAberta(op) && diasSemInteracao(op, hoje) >= limite
}

/** Ação vencida = aberta, com data de próxima ação anterior a hoje. */
export function acaoVencida(
  op: Pick<OportunidadeBase, 'status' | 'proxima_acao_data'>,
  hoje: Date = new Date(),
): boolean {
  if (!ehAberta(op) || !op.proxima_acao_data) return false
  return op.proxima_acao_data < dataISOLocal(hoje)
}

export function acaoHoje(
  op: Pick<OportunidadeBase, 'status' | 'proxima_acao_data'>,
  hoje: Date = new Date(),
): boolean {
  return ehAberta(op) && op.proxima_acao_data === dataISOLocal(hoje)
}

// ─── Totais ──────────────────────────────────────────────────────────────────

export interface TotaisEtapa {
  qtd: number
  valor: number
  paradas: number
  vencidas: number
}

export function totaisPorEtapa(
  ops: Pick<OportunidadeBase, 'etapa' | 'status' | 'valor_estimado' | 'ultimo_contato_em' | 'created_at' | 'proxima_acao_data'>[],
  hoje: Date = new Date(),
  limiteParada: number = CRM_SOCIOS_DIAS_PARADA,
): Record<EtapaId, TotaisEtapa> {
  const out = Object.fromEntries(
    ETAPAS.map(e => [e.id, { qtd: 0, valor: 0, paradas: 0, vencidas: 0 }]),
  ) as Record<EtapaId, TotaisEtapa>
  for (const op of ops) {
    const t = out[op.etapa]
    if (!t) continue
    t.qtd += 1
    t.valor += op.valor_estimado ?? 0
    if (estaParada(op, hoje, limiteParada)) t.paradas += 1
    if (acaoVencida(op, hoje)) t.vencidas += 1
  }
  return out
}

export interface ResumoFunil {
  abertas: number
  valorEmAberto: number
  ganhas: number
  valorGanho: number
  perdidas: number
  paradas: number
  acoesVencidas: number
}

export function resumoFunil(
  ops: Pick<OportunidadeBase, 'status' | 'valor_estimado' | 'ultimo_contato_em' | 'created_at' | 'proxima_acao_data'>[],
  hoje: Date = new Date(),
  limiteParada: number = CRM_SOCIOS_DIAS_PARADA,
): ResumoFunil {
  const r: ResumoFunil = { abertas: 0, valorEmAberto: 0, ganhas: 0, valorGanho: 0, perdidas: 0, paradas: 0, acoesVencidas: 0 }
  for (const op of ops) {
    if (op.status === 'aberto') {
      r.abertas += 1
      r.valorEmAberto += op.valor_estimado ?? 0
      if (estaParada(op, hoje, limiteParada)) r.paradas += 1
      if (acaoVencida(op, hoje)) r.acoesVencidas += 1
    } else if (op.status === 'ganho') {
      r.ganhas += 1
      r.valorGanho += op.valor_estimado ?? 0
    } else if (op.status === 'perdido') {
      r.perdidas += 1
    }
  }
  return r
}

// ─── Próximas ações ──────────────────────────────────────────────────────────

/**
 * As `n` ações mais urgentes: só oportunidades abertas com data de próxima ação,
 * da mais antiga (vencidas primeiro) para a mais distante. Empate: maior valor primeiro, depois nome.
 */
export function proximasAcoes<T extends Pick<OportunidadeBase, 'nome' | 'status' | 'proxima_acao_data' | 'valor_estimado'>>(
  ops: T[],
  n: number = CRM_SOCIOS_QTD_PROXIMAS_ACOES,
): T[] {
  return ops
    .filter(op => ehAberta(op) && !!op.proxima_acao_data)
    .sort((a, b) => {
      const da = a.proxima_acao_data as string
      const db = b.proxima_acao_data as string
      if (da !== db) return da < db ? -1 : 1
      const va = a.valor_estimado ?? 0
      const vb = b.valor_estimado ?? 0
      if (va !== vb) return vb - va
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
    .slice(0, n)
}

// ─── Busca e filtros (lista) ─────────────────────────────────────────────────

export function normalizarTexto(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export interface FiltrosOportunidades {
  busca?: string
  etapa?: EtapaId | ''
  responsavelId?: string
  status?: StatusOportunidade | ''
  /** Só as que pedem atenção: paradas (sem interação há X dias) ou com ação vencida. */
  alerta?: 'paradas' | 'vencidas' | ''
}

export function filtrarOportunidades<T extends OportunidadeBase>(
  ops: T[],
  f: FiltrosOportunidades,
  hoje: Date = new Date(),
): T[] {
  const q = normalizarTexto(f.busca)
  return ops.filter(op => {
    if (f.etapa && op.etapa !== f.etapa) return false
    if (f.status && op.status !== f.status) return false
    if (f.responsavelId && op.responsavel_id !== f.responsavelId) return false
    if (f.alerta === 'paradas' && !estaParada(op, hoje)) return false
    if (f.alerta === 'vencidas' && !acaoVencida(op, hoje)) return false
    if (q) {
      const alvo = normalizarTexto([
        op.nome, op.contato_nome, op.contato_telefone, op.contato_email,
        op.origem, op.indicado_por, op.area_interesse, op.proxima_acao,
      ].filter(Boolean).join(' '))
      if (!alvo.includes(q)) return false
    }
    return true
  })
}
