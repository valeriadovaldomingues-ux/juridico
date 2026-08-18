// ─── Captura do DJEN pelo navegador ───────────────────────────────────────────
//
// O WAF do CNJ recusa requisições de IPs de datacenter (HTTP 403), mas a API
// pública tem CORS aberto (`access-control-allow-origin: *`) e não exige
// autenticação — o navegador do usuário logado consulta o mesmo endpoint
// oficial usado pelo provider server-side. Os resultados brutos são então
// enviados a POST /api/monitoramento/djen/importar, onde toda validação,
// normalização, deduplicação e persistência acontecem no servidor.
//
// Módulo sem dependências de Node (usa apenas fetch/URLSearchParams) para ser
// seguro em componente client.

import { montarConsultasDJEN, urlConsultaDJEN, type AdvogadoMonitoradoDJEN } from './consultas'
import type { ComunicacaoDJENBruta, ConsultaDJEN, PeriodoConsulta } from './types'

const MAX_PAGINAS_POR_CONSULTA = 10
const DELAY_ENTRE_REQUISICOES_MS = 900

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export interface ProgressoCapturaDJEN {
  consultaAtual: number
  totalConsultas: number
  termo: string
  itensColetados: number
}

export interface ResultadoCapturaNavegador {
  periodo: PeriodoConsulta
  resultados: Array<{ consulta: ConsultaDJEN; items: ComunicacaoDJENBruta[] }>
  erros: Array<{ consulta: string; mensagem: string }>
}

/**
 * Executa a captura completa a partir do navegador do usuário autenticado.
 * Retorna o payload pronto para POST /api/monitoramento/djen/importar.
 */
export async function capturarDJENPeloNavegador(opcoes: {
  advogados: AdvogadoMonitoradoDJEN[]
  processos?: string[]
  periodo: PeriodoConsulta
  onProgresso?: (progresso: ProgressoCapturaDJEN) => void
}): Promise<ResultadoCapturaNavegador> {
  const consultas = montarConsultasDJEN({
    advogados: opcoes.advogados,
    processos: opcoes.processos,
    periodo: opcoes.periodo,
  })

  const resultados: Array<{ consulta: ConsultaDJEN; items: ComunicacaoDJENBruta[] }> = []
  const erros: Array<{ consulta: string; mensagem: string }> = []

  for (let i = 0; i < consultas.length; i++) {
    const consulta = consultas[i]
    const items: ComunicacaoDJENBruta[] = []
    let pagina = 1
    let count = Number.POSITIVE_INFINITY

    while (pagina <= MAX_PAGINAS_POR_CONSULTA && items.length < count) {
      try {
        const res = await fetch(urlConsultaDJEN(consulta, pagina), {
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) {
          erros.push({ consulta: `${consulta.tipo}:${consulta.termo} p${pagina}`, mensagem: `HTTP ${res.status}` })
          break
        }
        const json = await res.json() as { count?: number; items?: ComunicacaoDJENBruta[] }
        count = typeof json.count === 'number' ? json.count : items.length
        const pageItems = json.items ?? []
        if (pageItems.length === 0) break
        items.push(...pageItems)
        pagina++
        if (items.length < count && pagina <= MAX_PAGINAS_POR_CONSULTA) {
          await sleep(DELAY_ENTRE_REQUISICOES_MS)
        }
      } catch (error) {
        erros.push({
          consulta: `${consulta.tipo}:${consulta.termo} p${pagina}`,
          mensagem: error instanceof Error ? error.message : String(error),
        })
        break
      }
    }

    resultados.push({ consulta, items })
    opcoes.onProgresso?.({
      consultaAtual: i + 1,
      totalConsultas: consultas.length,
      termo: consulta.termo,
      itensColetados: resultados.reduce((acc, item) => acc + item.items.length, 0),
    })

    if (i < consultas.length - 1) await sleep(DELAY_ENTRE_REQUISICOES_MS)
  }

  return { periodo: opcoes.periodo, resultados, erros }
}
