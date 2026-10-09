import { describe, it, expect } from 'vitest'
import { resolverPessoa } from './resolver-pessoa'
import { normalizarTarefasIA, promptSistemaExtracao } from './extrair-tarefas'

const equipe = [
  { id: 'beatriz', nome: 'Beatriz Pessoa e do Val' }, { id: 'breno', nome: 'Breno Andrade' },
  { id: 'cris', nome: 'Cristiano Pessoa' }, { id: 'debora', nome: 'Débora Brito' },
  { id: 'luciana', nome: 'Luciana Pessoa' }, { id: 'marcelo', nome: 'Marcelo Mariano' },
  { id: 'taina', nome: 'Tainã Carlos' }, { id: 'tuane', nome: 'Tuane Miranda' }, { id: 'valeria', nome: 'Valéria do Val' },
]

describe('resolverPessoa', () => {
  it.each([['Breno', 'breno'], ['Débora', 'debora'], ['DEBORA', 'debora'], ['Tainã', 'taina'], ['Taina', 'taina'],
    ['Valéria', 'valeria'], ['Marcelo Mariano', 'marcelo'], ['Cris', 'cris'], ['Tuane', 'tuane']])('%s -> %s', (nome, id) => {
    expect(resolverPessoa(nome, equipe)).toBe(id)
  })
  it('ambíguo, grupo ou desconhecido não resolve', () => {
    expect(resolverPessoa('Pessoa', equipe)).toBeNull()
    expect(resolverPessoa('Equipe jurídica', equipe)).toBeNull()
    expect(resolverPessoa('Advogado responsável', equipe)).toBeNull()
    expect(resolverPessoa('', equipe)).toBeNull()
  })
})

describe('normalizarTarefasIA', () => {
  it('uma tarefa por pessoa, com nomes resolvidos e prazo validado', () => {
    const raw = JSON.stringify({ tarefas: [
      { titulo: 'Organizar despachos e diligências urgentes', descricao: 'Apoio de Beatriz', responsaveis: ['Tuane', 'Débora'], prazo: null, prazoTexto: 'Conforme urgência' },
      { titulo: 'Conferir contatos pré-audiência', responsaveis: ['Breno'], prazo: '2026-10-14', prazoTexto: 'Quartas-feiras' },
      { titulo: 'Classificar audiências', responsaveis: ['Equipe jurídica'], prazo: 'amanhã' },
      { titulo: 'Sem dono', responsaveis: [] },
      { titulo: '   ', responsaveis: ['Breno'] },
    ] })
    const r = normalizarTarefasIA(raw, equipe)
    expect(r.map(t => [t.titulo, t.responsavelId, t.responsavelTexto])).toEqual([
      ['Organizar despachos e diligências urgentes', 'tuane', null],
      ['Organizar despachos e diligências urgentes', 'debora', null],
      ['Conferir contatos pré-audiência', 'breno', null],
      ['Classificar audiências', null, 'Equipe jurídica'],
      ['Sem dono', null, null],
    ])
    expect(r[0].descricao).toContain('Conforme urgência')
    expect(r[2].prazo).toBe('2026-10-14')
    expect(r[3].prazo).toBeNull() // "amanhã" não é data válida
  })
  it('resposta inválida vira lista vazia', () => {
    expect(normalizarTarefasIA('não é json', equipe)).toEqual([])
    expect(normalizarTarefasIA('{"x":1}', equipe)).toEqual([])
  })
  it('o prompt informa a data e o dia da semana da reunião', () => {
    expect(promptSistemaExtracao(equipe, '2026-10-08')).toContain('quinta-feira')
  })
})
