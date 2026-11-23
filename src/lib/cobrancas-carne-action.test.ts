import { describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import type { Cobranca } from '../types/cobrancas'
import { gerarCarneAction } from './cobrancas-carne-action'

async function umaPagina(largura: number): Promise<Uint8Array> {
  const d = await PDFDocument.create()
  d.addPage([largura, 300])
  return d.save()
}

const cobr = (n: number, extra: Partial<Cobranca> = {}): Cobranca => ({
  id: `id-${n}`, cliente_id: 'c1', processo_id: null, parcela_numero: n, parcela_total: 3,
  descricao: 'Honorários advocatícios — advocacia de partido', tipo_caso: 'partido', status: 'emitida',
  inter_cobranca_id: `inter-${n}`, data_vencimento: `2027-0${n}-17`, valor: 1000,
  cliente: { id: 'c1', nome: 'CSC Centro de Serviços' },
  ...extra,
} as unknown as Cobranca)

const base = (candidatas: Cobranca[], buscarPdf: (id: string) => Promise<Uint8Array | null>) => ({
  role: 'socio' as const, userId: 'u1', referencia: candidatas[0], candidatas, buscarPdf, esperar: async () => {},
})

describe('gerarCarneAction', () => {
  it('junta tudo: resumo + 3 boletos na ordem, e registra', async () => {
    const registrar = vi.fn(async () => {})
    const pdfs: Record<string, number> = { 'inter-1': 111, 'inter-2': 222, 'inter-3': 333 }
    const r = await gerarCarneAction({ ...base([cobr(3), cobr(1), cobr(2)], async id => umaPagina(pdfs[id])), registrar })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const doc = await PDFDocument.load(r.pdf)
    expect(doc.getPages().slice(1).map(p => p.getWidth())).toEqual([111, 222, 333])
    expect(r.nomeArquivo).toBe('carne-csc-centro-de-servicos-3-parcelas.pdf')
    expect(registrar).toHaveBeenCalledWith({ parcelas: 3 })
  })

  it('só sócio', async () => {
    const r = await gerarCarneAction({ ...base([cobr(1)], async () => umaPagina(1)), role: 'advogado' })
    expect(r).toMatchObject({ ok: false, status: 403 })
  })

  it('parcela faltando ou cancelada → 409 com os números; nada é buscado no Inter', async () => {
    const buscar = vi.fn(async () => umaPagina(1))
    const r = await gerarCarneAction(base([cobr(1), cobr(3)], buscar))
    expect(r).toMatchObject({ ok: false, status: 409 })
    expect(!r.ok && r.error).toContain('2')
    expect(buscar).not.toHaveBeenCalled()
  })

  it('parcela ainda não enviada ao Inter → 409 pedindo para gerar os boletos', async () => {
    const r = await gerarCarneAction(base([cobr(1), cobr(2, { inter_cobranca_id: null, status: 'pendente' }), cobr(3)], async () => umaPagina(1)))
    expect(r).toMatchObject({ ok: false, status: 409 })
    expect(!r.ok && r.error).toContain('Gerar todos os boletos')
  })

  it('Inter ainda sem PDF de uma parcela → 409 e NÃO entrega carnê incompleto', async () => {
    const r = await gerarCarneAction(base([cobr(1), cobr(2), cobr(3)], async id => (id === 'inter-2' ? null : umaPagina(1))))
    expect(r).toMatchObject({ ok: false, status: 409 })
    expect(!r.ok && r.error).toContain('2')
  })

  it('429 ao buscar um PDF: espera e tenta de novo; funciona na segunda', async () => {
    let tentou = 0
    const esperas: number[] = []
    const r = await gerarCarneAction({
      ...base([cobr(1), cobr(2), cobr(3)], async id => {
        if (id === 'inter-2' && tentou++ === 0) throw new Error('Inter API 429: Too Many Requests')
        return umaPagina(10)
      }),
      esperar: async ms => { esperas.push(ms) },
    })
    expect(r.ok).toBe(true)
    expect(esperas).toContain(2000)
  })

  it('PDF corrompido vindo do Inter → 502, sem derrubar a rota', async () => {
    const r = await gerarCarneAction(base([cobr(1), cobr(2), cobr(3)], async () => new Uint8Array([1, 2, 3])))
    expect(r).toMatchObject({ ok: false, status: 502 })
  })

  it('contratos de outro cliente não entram', async () => {
    const outro = cobr(2, { cliente_id: 'c2', id: 'x' })
    const r = await gerarCarneAction(base([cobr(1), cobr(2), cobr(3), outro], async () => umaPagina(10)))
    expect(r.ok).toBe(true)
  })
})
