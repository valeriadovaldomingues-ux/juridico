// ─── Cálculo de prazo útil ─────────────────────────────────────────────────────
//
// Função pura: não faz chamadas de rede nem acessa banco de dados.
// Recebe a lista de feriados como parâmetro para poder ser usada
// tanto no servidor (route.ts) quanto no cliente (componentes React).
//
// REGRA JURÍDICA (versão inicial — CPC art. 219):
//   - O prazo começa a correr no PRIMEIRO DIA ÚTIL após a data base.
//   - Cada dia útil conta 1 dia de prazo.
//   - O prazo vence no último dia útil contado.
//   - Se o vencimento cair em dia não útil, prorroga-se para o próximo dia útil.
//   - Dias não úteis: sábados, domingos e feriados cadastrados.
//
// Para prazos em dias CORRIDOS: soma dias corridos e prorroga se necessário.

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoContagem = 'uteis' | 'corridos'

export interface ResultadoPrazo {
  dataFinal:      string   // YYYY-MM-DD
  diasContados:   number   // quantos dias foram efetivamente contados
  dataInicioContagem: string // YYYY-MM-DD — primeiro dia que entrou na contagem
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function parseISO(iso: string): Date {
  // Evita problemas de timezone criando data em horário local ao meio-dia
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

function formatISO(d: Date): string {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

function addDias(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function isNaoUtil(d: Date, feriados: Set<string>): boolean {
  const dow = d.getDay()
  if (dow === 0 || dow === 6) return true          // domingo ou sábado
  return feriados.has(formatISO(d))
}

function proximoDiaUtil(d: Date, feriados: Set<string>): Date {
  let atual = new Date(d)
  while (isNaoUtil(atual, feriados)) {
    atual = addDias(atual, 1)
  }
  return atual
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Calcula a data final de um prazo processual.
 *
 * @param dataBase   YYYY-MM-DD — data da publicação/intimação (dia 0)
 * @param dias       Quantidade de dias do prazo
 * @param tipo       'uteis' | 'corridos'
 * @param feriados   Array de strings YYYY-MM-DD com feriados a excluir
 */
export function calcularPrazoFinal(
  dataBase: string,
  dias: number,
  tipo: TipoContagem,
  feriados: string[] = [],
): ResultadoPrazo {
  if (dias <= 0) {
    return { dataFinal: dataBase, diasContados: 0, dataInicioContagem: dataBase }
  }

  const feriadosSet = new Set(feriados)
  const base        = parseISO(dataBase)

  // ── Dias corridos ─────────────────────────────────────────────────────────
  if (tipo === 'corridos') {
    const inicioContagem = addDias(base, 1) // começa no dia seguinte
    const fim = addDias(base, dias)
    // Se vencer em dia não útil, prorroga para o próximo dia útil
    const finalUtil = isNaoUtil(fim, feriadosSet) ? proximoDiaUtil(fim, feriadosSet) : fim
    return {
      dataFinal:          formatISO(finalUtil),
      diasContados:       dias,
      dataInicioContagem: formatISO(inicioContagem),
    }
  }

  // ── Dias úteis ────────────────────────────────────────────────────────────
  // Regra: o prazo começa no primeiro dia útil APÓS a data base (art. 219 CPC)
  const inicioContagem = proximoDiaUtil(addDias(base, 1), feriadosSet)

  if (dias === 1) {
    return {
      dataFinal:          formatISO(inicioContagem),
      diasContados:       1,
      dataInicioContagem: formatISO(inicioContagem),
    }
  }

  let atual    = new Date(inicioContagem)
  let contados = 1 // o primeiro dia útil já é o dia 1

  while (contados < dias) {
    atual = addDias(atual, 1)
    if (!isNaoUtil(atual, feriadosSet)) contados++
  }

  return {
    dataFinal:          formatISO(atual),
    diasContados:       dias,
    dataInicioContagem: formatISO(inicioContagem),
  }
}

// ─── Utilitários exportados ───────────────────────────────────────────────────

/** Verifica se uma data ISO cai em dia não útil (fim de semana ou feriado). */
export function isDiaUtil(data: string, feriados: string[]): boolean {
  return !isNaoUtil(parseISO(data), new Set(feriados))
}

/** Retorna o próximo dia útil a partir de uma data ISO. */
export function proximoDiaUtilApos(dataBase: string, feriados: string[]): string {
  return formatISO(proximoDiaUtil(addDias(parseISO(dataBase), 1), new Set(feriados)))
}
