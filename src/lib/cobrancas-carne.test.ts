import { describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { ESPERAS_429_MS, INTERVALO_ENTRE_EMISSOES_MS, emitirEmFila, erroDeLimite, mesmoContrato, parcelasDoContrato, precisaEmitir, type ParcelaCarne } from './cobrancas-carne'
import { montarCarnePdf } from './cobrancas-carne-pdf'

const base = (n: number, extra: Partial<ParcelaCarne> = {}): ParcelaCarne => ({
  id: `id-${n}`, cliente_id: 'c1', processo_id: null, parcela_numero: n, parcela_total: 4,
  descricao: 'Honorários advocatícios — advocacia de partido', tipo_caso: 'partido', status: 'pendente',
  inter_cobranca_id: null, data_vencimento: `2027-0${n}-17`, valor: 1000, ...extra,
})

describe('contrato e parcelas', () => {
  it('agrupa pelo contrato, ordena e acusa parcelas ausentes (canceladas não contam)', () => {
    const todas = [base(3), base(1), base(2, { status: 'cancelada' }), base(4), base(1, { cliente_id: 'outro' }), base(1, { descricao: 'Outro assunto' })]
    const r = parcelasDoContrato(todas[1], todas)
    expect(r.parcelas.map(p => p.parcela_numero)).toEqual([1, 3, 4])
    expect(r.ausentes).toEqual([2])
    expect(r.ambiguo).toBe(false)
  })
  it('dois contratos idênticos misturados → ambíguo', () => {
    const todas = [base(1), base(2), base(1, { id: 'dup' })]
    expect(parcelasDoContrato(todas[0], todas).ambiguo).toBe(true)
  })
  it('processo null e vazio contam como o mesmo; descrição com espaços sobrando também', () => {
    expect(mesmoContrato(base(1), base(2, { descricao: '  Honorários advocatícios — advocacia de partido ' }))).toBe(true)
    expect(mesmoContrato(base(1), base(2, { processo_id: 'p1' }))).toBe(false)
  })
  it('precisaEmitir só para quem não foi ao Inter e está em status que permite', () => {
    expect(precisaEmitir(base(1))).toBe(true)
    expect(precisaEmitir(base(1, { status: 'erro_emissao' }))).toBe(true)
    expect(precisaEmitir(base(1, { status: 'processando', inter_cobranca_id: 'x' }))).toBe(false)
    expect(precisaEmitir(base(1, { status: 'emitida', inter_cobranca_id: 'x' }))).toBe(false)
    expect(precisaEmitir(base(1, { status: 'paga' }))).toBe(false)
  })
  it('reconhece erro de limite do Inter', () => {
    expect(erroDeLimite('Inter API 429: Too Many Requests')).toBe(true)
    expect(erroDeLimite('too many requests')).toBe(true)
    expect(erroDeLimite('Inter API 400: Dados inválidos')).toBe(false)
    expect(erroDeLimite(undefined)).toBe(false)
  })
})

describe('emitirEmFila', () => {
  const hojeISO = '2026-11-23'

  it('emite só as pendentes, em ordem, com pausa entre elas', async () => {
    const parcelas = [base(1), base(2, { status: 'emitida', inter_cobranca_id: 'x' }), base(3), base(4)]
    const emitir = vi.fn(async (id: string) => ({ ok: id !== '' }))
    const esperas: number[] = []
    const r = await emitirEmFila({ parcelas, emitir, esperar: async ms => { esperas.push(ms) }, hojeISO })
    expect(emitir.mock.calls.map(c => c[0])).toEqual(['id-1', 'id-3', 'id-4'])
    expect(r).toEqual({ emitidas: [1, 3, 4], puladasVencidas: [], falha: null })
    expect(esperas).toEqual([INTERVALO_ENTRE_EMISSOES_MS, INTERVALO_ENTRE_EMISSOES_MS]) // sem pausa depois da última
  })

  it('429: espera e tenta a mesma parcela de novo, depois segue', async () => {
    const chamadas: string[] = []
    let vezes = 0
    const emitir = async (id: string) => {
      chamadas.push(id)
      if (id === 'id-1' && vezes++ < 2) return { ok: false, erro: 'Inter API 429: Too Many Requests' }
      return { ok: true }
    }
    const esperas: number[] = []
    const r = await emitirEmFila({ parcelas: [base(1), base(2)], emitir, esperar: async ms => { esperas.push(ms) }, hojeISO })
    expect(chamadas).toEqual(['id-1', 'id-1', 'id-1', 'id-2'])
    expect(esperas.slice(0, 2)).toEqual([ESPERAS_429_MS[0], ESPERAS_429_MS[1]])
    expect(r).toMatchObject({ emitidas: [1, 2], falha: null })
  })

  it('429 que não passa depois das tentativas: para e informa qual parcela', async () => {
    const emitir = vi.fn(async () => ({ ok: false, erro: 'Inter API 429: Too Many Requests' }))
    const r = await emitirEmFila({ parcelas: [base(1), base(2)], emitir, esperar: async () => {}, hojeISO })
    expect(emitir).toHaveBeenCalledTimes(1 + ESPERAS_429_MS.length)
    expect(r.emitidas).toEqual([])
    expect(r.falha).toMatchObject({ numero: 1 })
  })

  it('outro erro (ex.: dados do pagador) interrompe na hora, sem repetir', async () => {
    const emitir = vi.fn(async (id: string) => (id === 'id-2' ? { ok: false, erro: 'Dados inválidos' } : { ok: true }))
    const r = await emitirEmFila({ parcelas: [base(1), base(2), base(3)], emitir, esperar: async () => {}, hojeISO })
    expect(emitir.mock.calls.map(c => c[0])).toEqual(['id-1', 'id-2'])
    expect(r).toMatchObject({ emitidas: [1], falha: { numero: 2, erro: 'Dados inválidos' } })
  })

  it('pula parcelas com vencimento passado (o Inter não emite) e avisa quais', async () => {
    const parcelas = [base(1, { data_vencimento: '2026-10-01' }), base(2, { data_vencimento: '2026-11-23' }), base(3)]
    const emitir = vi.fn(async (id: string) => ({ ok: id !== '' }))
    const r = await emitirEmFila({ parcelas, emitir, esperar: async () => {}, hojeISO })
    expect(emitir.mock.calls.map(c => c[0])).toEqual(['id-2', 'id-3'])
    expect(r.puladasVencidas).toEqual([1])
  })

  it('sem nada a emitir: não chama o Inter', async () => {
    const emitir = vi.fn(async (id: string) => ({ ok: id !== '' }))
    const r = await emitirEmFila({ parcelas: [base(1, { status: 'emitida', inter_cobranca_id: 'x' })], emitir, esperar: async () => {}, hojeISO })
    expect(emitir).not.toHaveBeenCalled()
    expect(r).toEqual({ emitidas: [], puladasVencidas: [], falha: null })
  })
})

describe('montarCarnePdf', () => {
  async function pdfDeUmaPagina(largura: number): Promise<Uint8Array> {
    const d = await PDFDocument.create()
    d.addPage([largura, 400])
    return d.save()
  }

  it('resumo + boletos na ordem das parcelas (mesmo vindos fora de ordem)', async () => {
    const bytes = await montarCarnePdf({
      clienteNome: 'CSC CENTRO DE SERVIÇOS ADMINISTRATIVOS LTDA.',
      descricao: 'Honorários advocatícios — advocacia de partido',
      parcelas: [
        { numero: 3, total: 3, vencimento: '2027-02-17', valor: 1000, pdf: await pdfDeUmaPagina(333) },
        { numero: 1, total: 3, vencimento: '2026-12-17', valor: 1000, pdf: await pdfDeUmaPagina(111) },
        { numero: 2, total: 3, vencimento: '2027-01-17', valor: 2000, pdf: await pdfDeUmaPagina(222) },
      ],
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(4)
    expect(doc.getPages().slice(1).map(p => p.getWidth())).toEqual([111, 222, 333])
  })

  it('texto com caracteres fora do alfabeto padrão não derruba a geração', async () => {
    const bytes = await montarCarnePdf({
      clienteNome: 'Cliente ĩñ 日本',
      descricao: 'Descrição com emoji 😀',
      parcelas: [{ numero: 1, total: 1, vencimento: '2026-12-17', valor: 1000, pdf: await pdfDeUmaPagina(100) }],
    })
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2)
  })
})
