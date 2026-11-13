import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { qualificacaoDoVinculo, ultimoAndamentoDasObservacoes, type ProcessoRel } from './dados'
import { camposDoProcesso, gerarRelatorioSinteticoPdf } from './pdf'

const proc = (o: Partial<ProcessoRel> = {}): ProcessoRel => ({
  id: 'p1', numero: '5013339-89.2022.8.13.0079', titulo: 'AÇÃO ORDINÁRIA', area: 'civil', status: 'ativo', fase: null, tribunal: 'TJMG', vara: 'JUIZADO',
  comarca: 'Contagem', classe: null, valorCausa: 1500, distribuicao: '01/03/2022', advogado: 'Cristiano Pessoa', cliente: 'AGR CLINICA ODONTOLOGICA S. S.',
  qualificacaoDaPessoa: 'Autor', contrario: 'ROSEMARY ALVES DE CASTRO', partes: [{ nome: 'JOSE SILVESTRE DA SILVEIRA JR.', tipo: 'Cliente', qualificacao: 'Autor' }, { nome: 'ROSEMARY ALVES DE CASTRO', tipo: 'Réu', qualificacao: null }],
  andamentos: [{ data: '05/11/2019', tipo: 'Andamento', descricao: 'Realizada audiência de instrução e conciliação.' }], ...o,
})

describe('relatório sintético por pessoa', () => {
  it('lê a qualificação gravada no vínculo', () => {
    expect(qualificacaoDoVinculo('[vinculado em 12/11/2026 a partir do relatório do EasyJur; qualificação: Reu]')).toBe('Reu')
    expect(qualificacaoDoVinculo('[... qualificação: -]')).toBeNull()
    expect(qualificacaoDoVinculo(null)).toBeNull()
  })

  it('aproveita "Último andamento" das observações quando não há andamentos lançados', () => {
    const a = ultimoAndamentoDasObservacoes('Instância: 1º Grau\n\n---\n\nÚltimo andamento: 17/09/2020 — Informações Administrativas — Considerando a petição.')
    expect(a).toEqual({ data: '17/09/2020', tipo: 'Andamento', descricao: 'Informações Administrativas — Considerando a petição.' })
    expect(ultimoAndamentoDasObservacoes('sem andamento')).toBeNull()
  })

  it('mostra só os campos preenchidos do processo', () => {
    const campos = camposDoProcesso(proc({ vara: null, valorCausa: null }))
    const rotulos = campos.map(c => c[0])
    expect(rotulos).toContain('Tribunal')
    expect(rotulos).not.toContain('Vara')
    expect(rotulos).not.toContain('Valor da causa')
  })

  it('gera o PDF com vários processos e quebra de página', async () => {
    const processos = Array.from({ length: 40 }, (_, i) => proc({ id: `p${i}`, numero: `00${i}-89.2022.8.13.0079` }))
    const bytes = await gerarRelatorioSinteticoPdf({ pessoa: 'JOSE SILVESTRE DA SILVEIRA JR.', processos, emitidoEm: new Date('2026-11-13T12:00:00Z') })
    const lido = await PDFDocument.load(bytes)
    expect(lido.getPageCount()).toBeGreaterThan(5)
  })

  it('gera o PDF mesmo sem processos', async () => {
    const bytes = await gerarRelatorioSinteticoPdf({ pessoa: 'Fulano', processos: [], emitidoEm: new Date() })
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })
})
