import { describe, expect, it } from 'vitest'
import { normalizarExtracaoAta, promptSistemaAta } from './extrair-ata'

const equipe = [
  { id: 'u1', nome: 'Cristiano Pessoa' },
  { id: 'u2', nome: 'Tuane Silva' },
]

describe('normalizarExtracaoAta', () => {
  it('separa obrigações do cliente e tarefas do escritório', () => {
    const r = normalizarExtracaoAta(JSON.stringify({
      resumo: ' Acordo fechado em 5 parcelas. ',
      obrigacoes_cliente: [
        { titulo: 'Pagar parcela 1', descricao: null, data: '2026-11-10', dataTexto: 'dia 10/11', valor: 'R$ 1.000,00' },
        { titulo: 'Entregar guias', data: '10/11/2026', dataTexto: 'em 10 dias' },
        { titulo: '   ' },
      ],
      tarefas_escritorio: [
        { titulo: 'Juntar comprovante', responsaveis: ['Cristiano'], prazo: '2026-11-12', prazoTexto: '2 dias' },
        { titulo: 'Acompanhar homologação', responsaveis: [] },
      ],
    }), equipe)
    expect(r.resumo).toBe('Acordo fechado em 5 parcelas.')
    expect(r.obrigacoesCliente).toHaveLength(2)
    expect(r.obrigacoesCliente[0]).toMatchObject({ data: '2026-11-10', valor: 'R$ 1.000,00' })
    expect(r.obrigacoesCliente[1].data).toBeNull() // formato inválido não vira data
    expect(r.obrigacoesCliente[1].dataTexto).toBe('em 10 dias')
    expect(r.tarefasEscritorio[0]).toMatchObject({ responsavelId: 'u1', prazo: '2026-11-12' })
    expect(r.tarefasEscritorio[0].descricao).toContain('Prazo na ata: 2 dias')
    expect(r.tarefasEscritorio[1].responsavelId).toBeNull()
  })

  it('uma tarefa por responsável e nome não resolvido fica como texto', () => {
    const r = normalizarExtracaoAta(JSON.stringify({
      tarefas_escritorio: [{ titulo: 'Protocolar', responsaveis: ['Tuane', 'Fulano de Tal'] }],
    }), equipe)
    expect(r.tarefasEscritorio.map(t => [t.responsavelId, t.responsavelTexto])).toEqual([['u2', null], [null, 'Fulano de Tal']])
  })

  it('resposta inválida devolve vazio', () => {
    expect(normalizarExtracaoAta('não é json', equipe)).toEqual({ resumo: '', obrigacoesCliente: [], tarefasEscritorio: [] })
  })
})

describe('promptSistemaAta', () => {
  it('inclui a data e a equipe', () => {
    const p = promptSistemaAta(equipe, '2026-10-08')
    expect(p).toContain('2026-10-08')
    expect(p).toContain('quinta-feira')
    expect(p).toContain('Cristiano Pessoa')
  })
})
