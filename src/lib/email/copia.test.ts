import { describe, expect, it } from 'vitest'
import { juntarCopias } from './copia'

describe('juntarCopias', () => {
  it('junta obrigatórias e extras sem repetir', () => {
    expect(juntarCopias(['adv@x.com', 'eu@x.com'], ['Eu@x.com', 'outro@x.com'], ['cliente@y.com']))
      .toEqual(['adv@x.com', 'eu@x.com', 'outro@x.com'])
  })
  it('não repete quem já está em "Para"', () => {
    expect(juntarCopias(['adv@x.com'], [], ['ADV@x.com'])).toEqual([])
  })
  it('as obrigatórias entram mesmo que o formulário não mande nada', () => {
    expect(juntarCopias(['adv@x.com'], [], ['c@y.com'])).toEqual(['adv@x.com'])
  })
})
