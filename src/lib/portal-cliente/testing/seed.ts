// Dados de teste do portal (CPF/CNPJ com dígito verificador correto; nada real).

export const CPF_A = '529.982.247-25'
export const CPF_A_DIGITOS = '52998224725'
export const CNPJ_B = '11.222.333/0001-81'
export const CNPJ_B_DIGITOS = '11222333000181'

export const CLIENTE_A = 'a0000000-0000-4000-8000-00000000000a'
export const CLIENTE_B = 'b0000000-0000-4000-8000-00000000000b'
export const PROC_A1 = 'a1000000-0000-4000-8000-000000000001' // visível
export const PROC_A_SEGREDO = 'a2000000-0000-4000-8000-000000000002'
export const PROC_A_OCULTO = 'a3000000-0000-4000-8000-000000000003'
export const PROC_B1 = 'b1000000-0000-4000-8000-000000000001'

type Linha = Record<string, unknown>

const proc = (id: string, clienteId: string, extra: Linha = {}): Linha => ({
  id, cliente_id: clienteId, numero_processo: `000${id.slice(0, 2)}-00.2024.8.13.0024`, titulo: `Ação ${id.slice(0, 2)}`,
  area_direito: 'civil', status: 'ativo', fase: 'Conhecimento', tribunal: 'TJMG', vara: '1ª Vara', comarca: 'Belo Horizonte',
  classe_processual: 'Procedimento Comum', data_distribuicao: '2024-03-10', created_at: '2024-03-10T10:00:00Z',
  segredo_justica: false, ocultar_portal: false,
  // campos internos que NUNCA podem sair:
  observacoes: 'ESTRATEGIA INTERNA: acordo até 10 mil', valor_causa: 987654.32, advogado_responsavel_id: 'adv-1', advogado_caso_id: 'adv-2', parte_contraria: 'TEXTO INTERNO',
  ...extra,
})

export function seedBasico(): Record<string, Linha[]> {
  return {
    clientes: [
      { id: CLIENTE_A, nome: 'Maria da Silva', ativo: true, cpf_cnpj: CPF_A, email: 'maria@cadastro.com', data_nascimento: '1980-05-20' },
      { id: CLIENTE_B, nome: 'Empresa B Ltda', ativo: true, cpf_cnpj: CNPJ_B, email: 'contato@b.com.br', data_nascimento: null },
    ],
    processos: [
      proc(PROC_A1, CLIENTE_A),
      proc(PROC_A_SEGREDO, CLIENTE_A, { segredo_justica: true }),
      proc(PROC_A_OCULTO, CLIENTE_A, { ocultar_portal: true }),
      proc(PROC_B1, CLIENTE_B),
    ],
    partes_processo: [
      { id: 'pt1', processo_id: PROC_A1, pessoa_nome: 'Maria da Silva', tipo_parte: 'autor', documento: '529.982.247-25', observacoes: 'nota interna' },
      { id: 'pt2', processo_id: PROC_A1, pessoa_nome: 'Banco Réu S.A.', tipo_parte: 'reu', documento: '00.000.000/0001-91' },
      { id: 'pt3', processo_id: PROC_A1, pessoa_nome: 'José Vínculo Interno', tipo_parte: 'outro', documento: null },
    ],
    processo_andamentos: [
      { id: 'an1', processo_id: PROC_A1, data_andamento: '2026-11-10T10:00:00Z', tipo: 'decisao', titulo: 'Decisão publicada', descricao: 'Julgado procedente.', origem: 'tribunal', criado_por: 'u1', responsavel_id: 'u2' },
      { id: 'an2', processo_id: PROC_A1, data_andamento: '2026-11-11T10:00:00Z', tipo: 'contato_cliente', titulo: 'Liguei pro cliente', descricao: 'cliente nervoso', origem: 'manual' },
      { id: 'an3', processo_id: PROC_A1, data_andamento: '2026-11-12T10:00:00Z', tipo: 'observacao', titulo: 'Nota interna', descricao: 'segredo da estratégia', origem: 'manual' },
      { id: 'an4', processo_id: PROC_A1, data_andamento: '2026-11-13T10:00:00Z', tipo: 'despacho', titulo: 'Texto da Aurora', descricao: 'gerado por IA', origem: 'aurora' },
      { id: 'an5', processo_id: PROC_A1, data_andamento: '2026-11-09T10:00:00Z', tipo: 'prazo', titulo: 'Prazo interno', descricao: null, origem: 'manual' },
      { id: 'an6', processo_id: PROC_A1, data_andamento: '2026-11-08T10:00:00Z', tipo: 'peticao', titulo: 'Petição protocolada', descricao: null, origem: 'manual' },
      { id: 'an7', processo_id: PROC_A_SEGREDO, data_andamento: '2026-11-08T10:00:00Z', tipo: 'peticao', titulo: 'Andamento de segredo', descricao: null, origem: 'manual' },
      { id: 'an8', processo_id: PROC_B1, data_andamento: '2026-11-08T10:00:00Z', tipo: 'peticao', titulo: 'Andamento do cliente B', descricao: null, origem: 'manual' },
    ],
    agenda_items: [
      { id: 'ag1', processo_id: PROC_A1, tipo: 'audiencia', status: 'pendente', data_inicio: '2026-12-01', hora_inicio: '14:00:00', audiencia_tipo: 'conciliacao', audiencia_modalidade: 'virtual', audiencia_local: 'https://meet.exemplo/abc', titulo: 'TITULO INTERNO', descricao: 'DESCRICAO INTERNA', responsavel: 'Cristiano' },
      { id: 'ag2', processo_id: PROC_A1, tipo: 'prazo', status: 'pendente', data_inicio: '2026-12-02', titulo: 'prazo interno' },
      { id: 'ag3', processo_id: PROC_A1, tipo: 'audiencia', status: 'pendente', data_inicio: '2020-01-01', titulo: 'audiência passada' },
      { id: 'ag4', processo_id: PROC_A_SEGREDO, tipo: 'audiencia', status: 'pendente', data_inicio: '2026-12-03' },
      { id: 'ag5', processo_id: PROC_A_OCULTO, tipo: 'audiencia', status: 'pendente', data_inicio: '2026-12-04' },
      { id: 'ag6', processo_id: PROC_B1, tipo: 'audiencia', status: 'pendente', data_inicio: '2026-12-05' },
      { id: 'ag7', processo_id: PROC_A1, tipo: 'audiencia', status: 'cancelado', data_inicio: '2026-12-06' },
    ],
  }
}
