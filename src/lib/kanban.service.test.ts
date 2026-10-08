import { describe, expect, it } from 'vitest'
import { getListColumns, getUnassignedTasks, resolverDestinoOffice, ordenarColunasTrello } from './kanban.service'
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

describe('resolverDestinoOffice', () => {
  const tarefas = [
    { id: 't1', status: 'a_fazer', responsavel_id: 'ana' },
    { id: 't2', status: 'fazendo', responsavel_id: 'bia' },
    { id: 't3', status: 'concluido', responsavel_id: null },
  ] as unknown as import('@/types/kanban').KanbanTask[]
  const pessoas = ['ana', 'bia']

  it('soltar na coluna de outra pessoa informa a nova pessoa e o status', () => {
    expect(resolverDestinoOffice('bia::fazendo', tarefas, pessoas)).toEqual({ status: 'fazendo', responsavelId: 'bia' })
    expect(resolverDestinoOffice('bia::a_fazer', tarefas, pessoas)).toEqual({ status: 'a_fazer', responsavelId: 'bia' })
  })

  it('coluna estilo Trello (::todos) só reatribui, sem mexer no status', () => {
    expect(resolverDestinoOffice('bia::todos', tarefas, pessoas)).toEqual({ status: null, responsavelId: 'bia' })
    expect(resolverDestinoOffice('__list__x::todos', tarefas, pessoas)).toEqual({ status: null, responsavelId: null })
  })

  it('soltar em cima de um card vale como soltar na coluna dele (sem mudar status)', () => {
    expect(resolverDestinoOffice('t2', tarefas, pessoas)).toEqual({ status: null, responsavelId: 'bia' })
  })

  it('colunas de lista do Trello e sem responsável só mudam o status', () => {
    expect(resolverDestinoOffice('lista123::concluido', tarefas, pessoas)).toEqual({ status: 'concluido', responsavelId: null })
    expect(resolverDestinoOffice('t3', tarefas, pessoas)).toEqual({ status: null, responsavelId: null })
  })

  it('destino inválido é ignorado', () => {
    expect(resolverDestinoOffice('bia::inexistente', tarefas, pessoas)).toBeNull()
    expect(resolverDestinoOffice('nao-existe', tarefas, pessoas)).toBeNull()
  })
})

describe('ordenarColunasTrello', () => {
  const perfil = (id: string, nome: string) => ({ profile: { id, nome, cor_kanban: null, role: 'advogado' }, tasks: [] }) as unknown as import('./kanban.service').OfficeColumn
  const tarefa = (over: Record<string, unknown>) => ({ id: String(Math.random()), status: 'a_fazer', ...over }) as unknown as import('@/types/kanban').KanbanTask

  it('segue a ordem das listas do Trello, intercalando pessoas e listas; sem posição vai para o fim', () => {
    const pessoas = [perfil('1', 'Marcelo Mariano'), perfil('2', 'Tuane Miranda'), perfil('3', 'Luana Souza')]
    const tasks = [
      tarefa({ trello_list_nome: 'Tuane', trello_list_pos: 100 }),
      tarefa({ trello_list_nome: 'Marcelo', trello_list_pos: 300 }),
      tarefa({ trello_list_nome: 'PRAZOS CÍVEIS', trello_list_id: 'L1', trello_list_pos: 200 }),
    ]
    const listas = [{ key: 'L1', nome: 'PRAZOS CÍVEIS', tasks: [tasks[2]] }]
    const ordem = ordenarColunasTrello(pessoas, listas, tasks).map(c => (c.tipo === 'pessoa' ? c.col.profile.nome : c.col.nome))
    expect(ordem).toEqual(['Tuane Miranda', 'PRAZOS CÍVEIS', 'Marcelo Mariano', 'Luana Souza'])
  })
})
