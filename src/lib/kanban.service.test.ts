import { describe, expect, it } from 'vitest'
import { getListColumns, getUnassignedTasks } from './kanban.service'
import type { KanbanTask } from '@/types/kanban'

function tarefa(overrides: Partial<KanbanTask> = {}): KanbanTask {
  return {
    id: 'task-1',
    titulo: 'Tarefa teste',
    status: 'a_fazer',
    prioridade: 'media',
    responsavel_id: null,
    origem: 'trello',
    ordem: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('getListColumns', () => {
  it('agrupa tarefas sem responsável pela lista de origem do Trello', () => {
    const tasks = [
      tarefa({ id: '1', responsavel_id: null, trello_list_id: 'l-civeis', trello_list_nome: 'PRAZOS CÍVEIS' }),
      tarefa({ id: '2', responsavel_id: null, trello_list_id: 'l-civeis', trello_list_nome: 'PRAZOS CÍVEIS' }),
      tarefa({ id: '3', responsavel_id: null, trello_list_id: 'l-trab',   trello_list_nome: 'PRAZOS TRABALHISTAS' }),
    ]

    const colunas = getListColumns(tasks)

    expect(colunas).toHaveLength(2)
    expect(colunas.map(c => c.nome)).toEqual(['PRAZOS CÍVEIS', 'PRAZOS TRABALHISTAS'])
    expect(colunas.find(c => c.key === 'l-civeis')?.tasks).toHaveLength(2)
  })

  it('não inclui tarefas que já têm responsável, mesmo vindas de lista mapeada', () => {
    const tasks = [
      tarefa({ id: '1', responsavel_id: 'user-1', trello_list_id: 'l-civeis', trello_list_nome: 'PRAZOS CÍVEIS' }),
    ]

    expect(getListColumns(tasks)).toHaveLength(0)
  })

  it('ignora tarefas sem trello_list_nome (ex.: tarefas manuais sem atribuição)', () => {
    const tasks = [tarefa({ id: '1', responsavel_id: null, trello_list_nome: null })]

    expect(getListColumns(tasks)).toHaveLength(0)
  })
})

describe('getUnassignedTasks', () => {
  it('exclui tarefas sem responsável que já viraram coluna de lista', () => {
    const tasks = [
      tarefa({ id: '1', responsavel_id: null, trello_list_id: 'l-civeis', trello_list_nome: 'PRAZOS CÍVEIS' }),
      tarefa({ id: '2', responsavel_id: null, trello_list_nome: null }),
    ]

    const semResponsavel = getUnassignedTasks(tasks)

    expect(semResponsavel).toHaveLength(1)
    expect(semResponsavel[0].id).toBe('2')
  })
})
