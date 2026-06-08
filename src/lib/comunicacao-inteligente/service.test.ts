import { beforeEach, describe, expect, it, vi } from 'vitest'
import { completarJSON } from '@/lib/ai/service'
import {
  buildDefaultTituloComunicacao,
  gerarComunicacaoInteligenteDraft,
  mapComunicacaoDbRowToDraft,
  rebuildComunicacaoTexto,
} from './service'

vi.mock('@/lib/ai/service', () => ({
  completarJSON: vi.fn(),
}))

const completarJSONMock = vi.mocked(completarJSON)

beforeEach(() => {
  completarJSONMock.mockReset()
})

describe('comunicacao inteligente service', () => {
  it('gera rascunho estruturado em linguagem simples', async () => {
    completarJSONMock.mockResolvedValue(JSON.stringify({
      resumoExecutivo: 'Resumo simples.',
      oQueAconteceu: 'Houve uma intimação.',
      oQueIssoSignifica: 'O escritório precisa responder.',
      proximosPassos: ['Analisar prazo', 'Preparar manifestação'],
      acaoNecessariaCliente: 'Aguardar contato.',
      mensagemCliente: 'Sua ação foi atualizada.',
      observacoesInternas: 'Somente para revisão.',
      camposNaoEncontrados: ['valor da causa'],
      inconsistencias: ['Data divergente'],
    }))

    const draft = await gerarComunicacaoInteligenteDraft(
      {
        id: 'proc-1',
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
      } as never,
      {
        id: 'cli-1',
        nome: 'Cliente Exemplo',
        cpf_cnpj: '12.345.678/0001-90',
        email: 'cliente@example.com',
        telefone: '1133334444',
        celular: '11999998888',
      } as never,
      [
        {
          id: 'and-1',
          data_andamento: '2026-06-01T10:15:00Z',
          tipo: 'decisao',
          titulo: 'Decisão',
          descricao: 'Descrição',
          origem: 'tribunal',
          responsavel: { nome: 'Advogada' },
          criado_por_profile: { nome: 'Sócio' },
        },
      ] as never,
      {
        processoId: 'proc-1',
        clienteId: 'cli-1',
        tipo: 'relatorio',
        canalDestino: 'portal',
        andamentoIds: ['and-1'],
      },
    )

    expect(completarJSONMock).toHaveBeenCalledTimes(1)
    expect(draft.titulo).toBe('Atualização do processo 0001234-56.2026.8.26.0100')
    expect(draft.resumoExecutivo).toBe('Resumo simples.')
    expect(draft.conteudo_texto).toContain('Resumo executivo:')
    expect(draft.conteudo_texto).toContain('Próximos passos:')
    expect(draft.camposNaoEncontrados).toContain('valor da causa')
  })

  it('reconstrói texto e título padrão', () => {
    expect(buildDefaultTituloComunicacao({
      numero_processo: '0012345-67.2026.8.26.0100',
      titulo: 'Processo teste',
    } as never)).toBe('Atualização do processo 0012345-67.2026.8.26.0100')

    expect(rebuildComunicacaoTexto({
      resumoExecutivo: 'Resumo',
      oQueAconteceu: 'Fato',
      oQueIssoSignifica: 'Significado',
      proximosPassos: ['Passo 1'],
      acaoNecessariaCliente: 'Aguardar',
      mensagemCliente: 'Mensagem',
      observacoesInternas: 'Obs',
      camposNaoEncontrados: [],
      inconsistencias: [],
    }, 'Título')).toContain('Assunto: Título')
  })

  it('mapa linhas do banco para o formato esperado pela UI', () => {
    const mapped = mapComunicacaoDbRowToDraft({
      id: 'com-1',
      cliente_id: 'cli-1',
      processo_id: 'proc-1',
      andamento_ids: ['and-1'],
      tipo: 'relatorio',
      canal_destino: 'portal',
      status: 'pendente_aprovacao',
      titulo: 'Atualização',
      resumo_executivo: 'Resumo',
      o_que_aconteceu: 'Fato',
      o_que_isso_significa: 'Significado',
      proximos_passos: ['Passo 1'],
      acao_necessaria_cliente: 'Aguardar',
      mensagem_cliente: 'Mensagem',
      observacoes_internas: 'Obs',
      campos_nao_encontrados: ['Campo'],
      inconsistencias: ['Inconsistência'],
      conteudo_json: {
        resumoExecutivo: 'Resumo',
        oQueAconteceu: 'Fato',
        oQueIssoSignifica: 'Significado',
        proximosPassos: ['Passo 1'],
        acaoNecessariaCliente: 'Aguardar',
        mensagemCliente: 'Mensagem',
        observacoesInternas: 'Obs',
        camposNaoEncontrados: ['Campo'],
        inconsistencias: ['Inconsistência'],
      },
      conteudo_texto: 'Texto',
      visivel_portal: false,
      aprovado_por: null,
      aprovado_em: null,
      enviado_por: null,
      enviado_em: null,
      portal_mensagem_id: null,
      criado_por: 'uid',
      atualizado_por: null,
      created_at: '2026-06-01T10:15:00Z',
      updated_at: '2026-06-01T10:15:00Z',
      criado_por_profile: null,
      aprovado_por_profile: null,
      enviado_por_profile: null,
    } as never)

    expect(mapped.resumoExecutivo).toBe('Resumo')
    expect(mapped.oQueAconteceu).toBe('Fato')
    expect(mapped.proximosPassos).toEqual(['Passo 1'])
    expect(mapped.camposNaoEncontrados).toEqual(['Campo'])
  })
})
