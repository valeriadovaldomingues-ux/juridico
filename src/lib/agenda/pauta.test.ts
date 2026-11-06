import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { gerarPautaPdf, montarItemPauta, type ItemPauta } from './pauta'

const base = {
  id: 'a1', tipo: 'audiencia', status: 'pendente', data_inicio: '2026-11-16', hora_inicio: '08:20:00', hora_fim: '09:20:00',
  descricao: 'Audiência virtual', responsavel: 'Valéria / Débora', process_number: null, client_name: null, opposing_party_name: null,
  court: null, county: null, processo_id: 'p1', audiencia_tipo: 'una', audiencia_modalidade: 'virtual', audiencia_local: 'https://zoom.us/x',
  cliente: null,
  processo: { numero_processo: '0011023-60.2026.5.03.0021', vara: '21ª Vara do Trabalho', comarca: 'Belo Horizonte', tribunal: 'TRT03', parte_contraria: 'AMANDA LAKTINI', cliente: { nome: 'SANTA INES CLINICA ODONTOLOGICA LTDA' } },
}

describe('montagem da pauta', () => {
  it('usa os dados do processo vinculado, os dois responsáveis e os campos da audiência', () => {
    expect(montarItemPauta(base)).toMatchObject({
      horaInicio: '08:20', horaFim: '09:20', tipo: 'UNA', modalidade: 'Virtual', localOuLink: 'https://zoom.us/x', status: 'Aberta',
      processo: '0011023-60.2026.5.03.0021', comarcaVara: '21ª Vara do Trabalho — Belo Horizonte',
      cliente: 'SANTA INES CLINICA ODONTOLOGICA LTDA', parteContraria: 'AMANDA LAKTINI', responsaveis: ['Valéria', 'Débora'], semProcesso: false,
    })
  })
  it('nas audiências antigas sem vínculo, usa o que veio na importação e marca "sem processo"', () => {
    const it = montarItemPauta({
      ...base, processo_id: null, processo: null, status: 'cancelado', audiencia_tipo: null, audiencia_modalidade: null, audiencia_local: null,
      process_number: '"1001633-77.2026.5.02.0053"', client_name: 'ECOMED', opposing_party_name: 'Gabriel', court: 'TRT02', county: null,
    })
    expect(it).toMatchObject({ processo: '1001633-77.2026.5.02.0053', cliente: 'ECOMED', parteContraria: 'Gabriel', comarcaVara: 'TRT02', status: 'Cancelada', semProcesso: true, tipo: null })
  })
  it('aceita relacionamentos que chegam como lista', () => {
    const it = montarItemPauta({ ...base, cliente: [{ nome: 'CLIENTE X' }], processo: [base.processo] })
    expect(it.cliente).toBe('CLIENTE X')
    expect(it.processo).toBe('0011023-60.2026.5.03.0021')
  })
})

describe('PDF da pauta', () => {
  const item = (n: number, extra: Partial<ItemPauta> = {}): ItemPauta => ({
    ...montarItemPauta(base), id: `i${n}`, data: n % 2 ? '2026-11-16' : '2026-11-17', ...extra,
  })
  const comeca = (b: Uint8Array) => Buffer.from(b.slice(0, 5)).toString()

  it('gera um PDF válido com audiências e com o período vazio', async () => {
    expect(comeca(await gerarPautaPdf([item(1), item(2)], '2026-11-16', '2026-11-20'))).toBe('%PDF-')
    expect(comeca(await gerarPautaPdf([], '2026-11-16', '2026-11-20'))).toBe('%PDF-')
  })
  it('não quebra com texto fora do alfabeto da fonte (emoji, CJK) nem com descrição enorme', async () => {
    const r = await gerarPautaPdf([item(1, { descricao: `Teste 😀 日本語 ${'palavra '.repeat(400)}`, localOuLink: 'https://exemplo.com/' + 'a'.repeat(300) })], '2026-11-16', '2026-11-20')
    expect(comeca(r)).toBe('%PDF-')
  })
  it('pagina quando há muitas audiências', async () => {
    const itens = Array.from({ length: 40 }, (_, i) => item(i + 1))
    const r = await gerarPautaPdf(itens, '2026-11-16', '2026-11-20')
    expect((await PDFDocument.load(r)).getPageCount()).toBeGreaterThan(2)
  })
})
