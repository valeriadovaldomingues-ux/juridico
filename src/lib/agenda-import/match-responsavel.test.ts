import { describe, it, expect } from 'vitest'
import { matchPerfilPorNome } from './match-responsavel'

const perfis = [
  { id: 'beatriz', nome: 'Beatriz Pessoa e do Val' },
  { id: 'breno',   nome: 'Breno Andrade' },
  { id: 'celio',   nome: 'Célio Costa' },
  { id: 'cris',    nome: 'Cristiano Pessoa' },
  { id: 'debora',  nome: 'Débora Brito' },
  { id: 'luciana', nome: 'Luciana Pessoa' },
  { id: 'marcelo', nome: 'Marcelo Mariano' },
  { id: 'sidiney', nome: 'Sidiney Duarte' },
  { id: 'taina',   nome: 'Tainã Carlos' },
  { id: 'tuane',   nome: 'Tuane Miranda' },
  { id: 'valeria', nome: 'Valéria do Val' },
]

describe('matchPerfilPorNome', () => {
  it.each([
    ['CRISTIANO PESSOA SOUSA', 'cris'],
    ['VALERIA FERREIRA DO VAL DOMINGUES PESSOA', 'valeria'],
    ['TAINAN CARLOS DA SILVA', 'taina'],
    ['SIDINEY DUARTE RIBEIRO', 'sidiney'],
    ['DEBORA CRISTINA LAGE DE BRITO', 'debora'],
    ['MARCELO MARIANO DE SOUZA JUNIOR', 'marcelo'],
    ['BEATRIZ PESSOA E DO VAL', 'beatriz'],
    ['CÉLIO COSTA MUDADU', 'celio'],
    ['TUANE MIRANDA DA SILVA', 'tuane'],
    ['BRENO QUEIROZ DE ANDRADE', 'breno'],
  ])('%s -> %s', (nome, id) => {
    expect(matchPerfilPorNome(nome, perfis)).toBe(id)
  })

  it('não casa nome desconhecido nem vazio', () => {
    expect(matchPerfilPorNome('FULANO DE TAL', perfis)).toBeNull()
    expect(matchPerfilPorNome('', perfis)).toBeNull()
  })

  it('não confunde pessoas com sobrenome em comum', () => {
    expect(matchPerfilPorNome('LUCIANA PESSOA SOUSA VIANA', perfis)).toBe('luciana')
  })
})
