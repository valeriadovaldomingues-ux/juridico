// Receita Partido mês a mês: cada cliente da grade tem um valor mensal padrão e, por mês, um registro opcional
// (valor e status daquele mês). Sem registro: mês atual/futuro vale o padrão como "pendente"; mês passado fica "sem registro".

export type StatusMes = 'pendente' | 'pago' | 'vencido'
export type StatusCelula = StatusMes | 'sem_registro'

export interface RegistroMes { grade_id: string; mes: string; valor: number | null; status: StatusMes }

export interface CelulaMes { valor: number | null; status: StatusCelula; registrado: boolean }

/** "2026-10" (ano-mês) do dia dado. */
export function anoMes(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

export function somarMesYM(ym: string, delta: number): string {
  const [a, m] = ym.split('-').map(Number)
  const t = a * 12 + (m - 1) + delta
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

export function mesesDoAno(ano: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`)
}

export function resolverCelula(valorPadrao: number | null, registro: Pick<RegistroMes, 'valor' | 'status'> | undefined, mes: string, mesAtual: string): CelulaMes {
  if (registro) return { valor: registro.valor ?? valorPadrao, status: registro.status, registrado: true }
  return { valor: valorPadrao, status: mes >= mesAtual ? 'pendente' : 'sem_registro', registrado: false }
}

/** Clique na célula: sem registro/pendente → pago → vencido → pendente. */
export function proximoStatus(atual: StatusCelula): StatusMes {
  if (atual === 'pago') return 'vencido'
  if (atual === 'vencido') return 'pendente'
  return 'pago'
}

export interface ResumoGrade { total: number; pago: number; pendente: number; vencido: number; semRegistro: number }

export function resumirCelulas(celulas: CelulaMes[]): ResumoGrade {
  const r: ResumoGrade = { total: 0, pago: 0, pendente: 0, vencido: 0, semRegistro: 0 }
  for (const c of celulas) {
    const v = c.valor ?? 0
    r.total += v
    if (c.status === 'pago') r.pago += v
    else if (c.status === 'pendente') r.pendente += v
    else if (c.status === 'vencido') r.vencido += v
    else r.semRegistro += v
  }
  return r
}
