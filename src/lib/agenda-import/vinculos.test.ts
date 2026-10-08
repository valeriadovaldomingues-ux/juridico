import { describe, it, expect } from 'vitest'
import { extrairDocumento, montarIndice, resolverVinculos, normalizarNome } from './vinculos'
import { normalizeEventType } from './normalizer'

const idx = montarIndice(
  [
    { id: 'p1', numero_processo: '1004325-55.2019.4.01.3820', cliente_id: 'c-abratec' },
    { id: 'p2', numero_processo: '"011703-08.2017.5.03.0006"', cliente_id: null },           // aspas no cadastro
    { id: 'p3', numero_processo: '5093009-79.2024.8.13.0024', cliente_id: 'c-x' },
    { id: 'p4', numero_processo: '5093009-79.2024.8.13.0024', cliente_id: 'c-y' },           // duplicado → ambíguo
  ],
  [
    { id: 'c-abratec', nome: 'ABRATEC FIXAÇÃO INDUSTRIAL LTDA - ME', cpf_cnpj: '12.345.678/0001-90' },
    { id: 'c-leite',   nome: 'Leite Chic Laticínios Ltda.', cpf_cnpj: '17.294.960/0001-04' },
    { id: 'c-dup1', nome: 'Maria Silva', cpf_cnpj: null },
    { id: 'c-dup2', nome: 'MARIA SILVA', cpf_cnpj: null },
  ],
)

describe('vinculos', () => {
  it('extrai CPF/CNPJ de "Dados do Cliente"', () => {
    expect(extrairDocumento('LEITE CHIC LATICINIOS LTDA - DOC.:17.294.960/0001-04')).toBe('17294960000104')
    expect(extrairDocumento('JOSE ALVES MACHADO - DOC.:156.024.276-00')).toBe('15602427600')
    expect(extrairDocumento('SEM DOCUMENTO')).toBeNull()
  })

  it('liga o processo ignorando aspas e pontuação, e traz o cliente dele', () => {
    const r = resolverVinculos({ process_number: '"1004325-55.2019.4.01.3820"', client_name: 'X', client_doc: null }, idx)
    expect(r).toEqual({ processo_id: 'p1', cliente_id: 'c-abratec' })
    expect(resolverVinculos({ process_number: '011703-08.2017.5.03.0006', client_name: null, client_doc: null }, idx).processo_id).toBe('p2')
  })

  it('não liga processo ambíguo', () => {
    expect(resolverVinculos({ process_number: '5093009-79.2024.8.13.0024', client_name: null, client_doc: null }, idx).processo_id).toBeNull()
  })

  it('sem processo, liga o cliente por CNPJ e depois por nome', () => {
    expect(resolverVinculos({ process_number: null, client_name: 'qualquer', client_doc: '17294960000104' }, idx).cliente_id).toBe('c-leite')
    expect(resolverVinculos({ process_number: null, client_name: 'ABRATEC FIXACAO INDUSTRIAL LTDA - ME', client_doc: null }, idx).cliente_id).toBe('c-abratec')
  })

  it('nome repetido ou desconhecido não liga', () => {
    expect(resolverVinculos({ process_number: null, client_name: 'Maria Silva', client_doc: null }, idx).cliente_id).toBeNull()
    expect(resolverVinculos({ process_number: null, client_name: 'Fulano', client_doc: null }, idx).cliente_id).toBeNull()
    expect(normalizarNome('Leite Chic Laticínios Ltda.')).toBe('leite chic laticinios ltda')
  })
})

describe('tipos do EasyJur', () => {
  it.each([
    ['PERICIA', 'pericia'], ['ATENDIMENTO', 'atendimento'], ['OUTROS', 'outros'],
    ['AUDIENCIA', 'audiencia'], ['PRAZO', 'prazo'], ['TAREFA', 'tarefa'], ['REUNIAO', 'reuniao'],
    ['', 'evento'], ['ALGO NOVO', 'evento'],
  ])('%s -> %s', (raw, esperado) => {
    expect(normalizeEventType(raw)).toBe(esperado)
  })
})
