import { describe, expect, it } from 'vitest'
import { nomesIguais, nomesUnicos, normalizarNome } from './nomes'

describe('normalizarNome', () => {
  it('tira acento, caixa, pontuação e espaços repetidos', () => {
    expect(normalizarNome('  JOSÉ   da  Conceição-Silva  ')).toBe('jose da conceicao silva')
    expect(normalizarNome('Irricom Serviços de Engenharia Ltda.')).toBe('irricom servicos de engenharia')
  })
  it('descarta sufixos societários, inclusive empilhados', () => {
    expect(normalizarNome('ACME LTDA')).toBe('acme')
    expect(normalizarNome('ACME LTDA - ME')).toBe('acme')
    expect(normalizarNome('ACME Ltda. EPP')).toBe('acme')
    expect(normalizarNome('ACME EIRELI')).toBe('acme')
    expect(normalizarNome('ACME S.A.')).toBe('acme')
    expect(normalizarNome('ACME S/A')).toBe('acme')
    expect(normalizarNome('ACME Limitada')).toBe('acme')
  })
  it('só remove sufixo no fim e nunca esvazia o nome', () => {
    expect(normalizarNome('ME Soluções Ltda')).toBe('me solucoes')
    expect(normalizarNome('LTDA')).toBe('ltda')
    expect(normalizarNome('')).toBe('')
    expect(normalizarNome(null)).toBe('')
  })
  it('trata "&" como "e"', () => {
    expect(normalizarNome('Silva & Filhos Ltda')).toBe('silva e filhos')
  })
})

describe('nomesIguais', () => {
  it('trata variações de pontuação e sufixo como o mesmo nome', () => {
    expect(nomesIguais('ACME COMERCIO LTDA.', 'Acme Comércio Ltda')).toBe(true)
    expect(nomesIguais('ACME COMERCIO LTDA', 'ACME COMERCIO')).toBe(true)
    expect(nomesIguais('ACME COMERCIO LTDA - EPP', 'acme comercio ltda me')).toBe(true)
  })
  it('NÃO confunde empresas parecidas (caso Irricom: Serviços × Soluções)', () => {
    expect(nomesIguais('IRRICOM SERVICOS DE ENGENHARIA LTDA', 'IRRICOM SOLUCOES TECNOLOGICAS LTDA')).toBe(false)
    expect(nomesIguais('IRRICOM SERVICOS DE ENGENHARIA LTDA', 'IRRICOM SERVIÇOS DE ENGENHARIA LTDA.')).toBe(true)
  })
  it('NÃO aceita nome contido em outro (igualdade, não "contém")', () => {
    expect(nomesIguais('MARIA SILVA', 'MARIA SILVA SANTOS')).toBe(false)
    expect(nomesIguais('JOAO', 'JOAO PEDRO')).toBe(false)
  })
  it('nome vazio nunca é igual', () => {
    expect(nomesIguais('', '')).toBe(false)
    expect(nomesIguais(null, undefined)).toBe(false)
  })
})

describe('nomesUnicos', () => {
  it('remove vazios e repetidos pela forma canônica, mantendo a 1ª grafia', () => {
    expect(nomesUnicos(['Acme Ltda', 'ACME LTDA.', '', null, 'Acme Comércio'])).toEqual(['Acme Ltda', 'Acme Comércio'])
  })
})
