import { beforeEach, describe, expect, it, vi } from 'vitest'
import { completarJSON } from '@/lib/ai/service'
import {
  buildRelatorioTitulo,
  gerarRelatorioInteligenteDraft,
  mapRelatorioDbRowToDraft,
} from './service'

vi.mock('@/lib/ai/service', () => ({
  completarJSON: vi.fn(),
}))

const completarJSONMock = vi.mocked(completarJSON)

beforeEach(() => {
  completarJSONMock.mockReset()
})

describe('relatorios inteligentes service', () => {
  it('gera relatório com texto padronizado e sem inventar dados', async () => {
    completarJSONMock.mockResolvedValue(JSON.stringify({
      resumoExecutivo: 'Resumo simples.',
      principaisMovimentacoes: ['Petição analisada', 'Prazo registrado'],
      situacaoAtual: 'Aguardando manifestação.',
      oQueIssoSignifica: 'O cliente apenas acompanha o andamento.',
      proximosPassos: ['Analisar prazo', 'Preparar resposta'],
      providenciasCliente: 'Nenhuma providência é necessária neste momento.',
    }))

    const draft = await gerarRelatorioInteligenteDraft(
      {
        id: 'proc-1',
        cliente_id: 'cli-1',
        numero_processo: '0001234-56.2026.8.26.0100',
        titulo: 'Processo Exemplo',
        area_direito: 'civil',
        status: 'ativo',
        fase: 'instrução',
        tribunal: 'TJSP',
        comarca: 'São Paulo',
        vara: '1ª Vara',
        classe_processual: 'Ação',
        assunto: 'Cobrança',
        segredo_justica: false,
        valor_causa: null,
        data_distribuicao: null,
        cliente: {
          id: 'cli-1',
          nome: 'Cliente Exemplo',
          tipo_pessoa: 'juridica',
          cpf_cnpj: '12.345.678/0001-90',
          email: 'cliente@example.com',
          telefone: '1133334444',
          celular: '11999998888',
          endereco: 'Rua A, 123',
        },
      } as never,
      [
        {
          id: 'and-1',
          processo_id: 'proc-1',
          data_andamento: '2026-06-01T10:15:00Z',
          tipo: 'decisao',
          titulo: 'Decisão publicada',
          descricao: 'Texto',
          origem: 'tribunal',
          responsavel_id: null,
          criado_por: 'uid',
          created_at: '2026-06-01T10:15:00Z',
          updated_at: '2026-06-01T10:15:00Z',
        },
      ] as never,
      {
        processoId: 'proc-1',
        clienteId: 'cli-1',
        periodoInicio: '2026-06-01',
        periodoFim: '2026-06-30',
      },
    )

    expect(completarJSONMock).toHaveBeenCalledTimes(1)
    expect(buildRelatorioTitulo(
      { numero_processo: '0001234-56.2026.8.26.0100', titulo: 'Processo Exemplo' } as never,
      { processoId: 'proc-1', clienteId: 'cli-1', periodoInicio: '2026-06-01', periodoFim: '2026-06-30' },
    )).toContain('0001234-56.2026.8.26.0100')
    expect(draft.resumo_executivo).toBe('Resumo simples.')
    expect(draft.conteudo_texto).toContain('RESUMO EXECUTIVO')
    expect(draft.conteudo_texto).toContain('Nenhuma providência é necessária neste momento.')
  })

  it('normaliza linha do banco para o formato esperado', () => {
    const mapped = mapRelatorioDbRowToDraft({
      id: 'rel-1',
      cliente_id: 'cli-1',
      processo_id: 'proc-1',
      titulo: 'Relatório',
      periodo_inicio: '2026-06-01',
      periodo_fim: '2026-06-30',
      resumo_executivo: 'Resumo',
      conteudo: {
        resumoExecutivo: 'Resumo',
        principaisMovimentacoes: ['Mov1'],
        situacaoAtual: 'Situação',
        oQueIssoSignifica: 'Significado',
        proximosPassos: ['Passo 1'],
        providenciasCliente: 'Providência',
      },
      conteudo_texto: 'Texto',
      status: 'rascunho',
      gerado_por: 'uid',
      aprovado_por: null,
      publicado_por: null,
      created_at: '2026-06-01T10:15:00Z',
      approved_at: null,
      published_at: null,
      updated_at: '2026-06-01T10:15:00Z',
    } as never)

    expect(mapped.principaisMovimentacoes).toEqual(['Mov1'])
    expect(mapped.proximosPassos).toEqual(['Passo 1'])
    expect(mapped.status).toBe('rascunho')
  })
})
