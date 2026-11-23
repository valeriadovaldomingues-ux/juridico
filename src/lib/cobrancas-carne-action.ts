// Baixar o carnê: junta os PDFs dos boletos de todas as parcelas do contrato num arquivo só.
// Regra: só entrega o carnê COMPLETO. Se faltar parcela, ou o Inter ainda não liberou algum PDF, devolve 409
// dizendo quais — nunca um carnê incompleto que poderia ser enviado ao cliente por engano.

import type { UserRole } from '../types'
import type { Cobranca } from '../types/cobrancas'
import { erroDeLimite, parcelasDoContrato } from './cobrancas-carne'
import { montarCarnePdf } from './cobrancas-carne-pdf'

export type ResultadoCarne =
  | { ok: true; status: 200; pdf: Uint8Array; nomeArquivo: string }
  | { ok: false; status: number; error: string }

const ESPERAS_PDF_429_MS = [2000, 4000, 8000]
const PAUSA_ENTRE_PDFS_MS = 300

const lista = (ns: number[]) => ns.join(', ')
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'cliente'

export async function gerarCarneAction(input: {
  role: UserRole
  userId: string
  referencia: Cobranca
  /** todas as cobranças do mesmo cliente (o filtro fino do contrato é feito aqui) */
  candidatas: Cobranca[]
  /** devolve o PDF do boleto no Inter, ou null se ainda não estiver disponível */
  buscarPdf: (interCobrancaId: string) => Promise<Uint8Array | null>
  esperar: (ms: number) => Promise<void>
  registrar?: (info: { parcelas: number }) => Promise<void>
}): Promise<ResultadoCarne> {
  if (input.role !== 'socio') return { ok: false, status: 403, error: 'Apenas sócios podem baixar o carnê.' }

  const contrato = parcelasDoContrato(input.referencia, input.candidatas)
  if (contrato.ambiguo) {
    return { ok: false, status: 409, error: 'Há dois contratos iguais misturados para este cliente; não consigo separar as parcelas com segurança.' }
  }
  if (contrato.ausentes.length) {
    return { ok: false, status: 409, error: `Faltam as parcelas ${lista(contrato.ausentes)} (canceladas ou não criadas). O carnê só sai completo.` }
  }
  const semInter = contrato.parcelas.filter(p => !p.inter_cobranca_id).map(p => p.parcela_numero)
  if (semInter.length) {
    return { ok: false, status: 409, error: `Ainda não foram enviadas ao Inter as parcelas ${lista(semInter)}. Use "Gerar todos os boletos do contrato" primeiro.` }
  }

  const pdfs = new Map<number, Uint8Array>()
  const indisponiveis: number[] = []
  for (const p of contrato.parcelas) {
    let bytes: Uint8Array | null = null
    for (let tentativa = 0; tentativa <= ESPERAS_PDF_429_MS.length; tentativa += 1) {
      try {
        bytes = await input.buscarPdf(p.inter_cobranca_id as string)
        break
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        if (erroDeLimite(msg) && tentativa < ESPERAS_PDF_429_MS.length) {
          await input.esperar(ESPERAS_PDF_429_MS[tentativa])
          continue
        }
        bytes = null
        break
      }
    }
    if (bytes && bytes.length > 0) pdfs.set(p.parcela_numero, bytes)
    else indisponiveis.push(p.parcela_numero)
    await input.esperar(PAUSA_ENTRE_PDFS_MS)
  }
  if (indisponiveis.length) {
    return { ok: false, status: 409, error: `O Inter ainda não liberou o PDF das parcelas ${lista(indisponiveis)}. Aguarde alguns minutos, use "Atualizar status no Inter" e tente de novo.` }
  }

  let pdf: Uint8Array
  try {
    pdf = await montarCarnePdf({
      clienteNome: input.referencia.cliente?.nome ?? 'Cliente',
      descricao: input.referencia.descricao,
      parcelas: contrato.parcelas.map(p => ({
        numero: p.parcela_numero,
        total: p.parcela_total,
        vencimento: p.data_vencimento,
        valor: Number(p.valor),
        pdf: pdfs.get(p.parcela_numero) as Uint8Array,
      })),
    })
  } catch {
    return { ok: false, status: 502, error: 'Não consegui juntar os boletos num único PDF (algum arquivo veio inválido do Inter).' }
  }

  await input.registrar?.({ parcelas: contrato.parcelas.length })
  return { ok: true, status: 200, pdf, nomeArquivo: `carne-${slug(input.referencia.cliente?.nome ?? 'cliente')}-${contrato.parcelas.length}-parcelas.pdf` }
}
