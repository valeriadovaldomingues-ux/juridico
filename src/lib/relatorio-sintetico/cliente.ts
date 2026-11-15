// Relatório sintético de processos — VERSÃO CLIENTE (Portal do Cliente).
// Reaproveita o PDF do relatório sintético (folha timbrada, fonte Carlito), mas monta os dados só com o que é
// seguro para o cliente: processos visíveis no portal, sem valor da causa, sem advogado, sem parte contrária
// interna, sem observações (nem o "último andamento" que ficou em observações) e só andamentos client-safe.

import type { Db } from '@/lib/portal-cliente/db'
import { listarAndamentosDosProcessos, listarPartes, listarProcessosDoCliente } from '@/lib/portal-cliente/consultas'
import { brData, type ProcessoRel, type RelatorioSintetico } from './dados'
import { gerarRelatorioSinteticoPdf } from './pdf'

export async function montarRelatorioDoCliente(db: Db, clienteId: string, clienteNome: string, agora: Date = new Date()): Promise<RelatorioSintetico> {
  const processos = await listarProcessosDoCliente(db, clienteId)
  const ids = processos.map(p => p.id)
  const [partes, andamentos] = await Promise.all([listarPartes(db, ids), listarAndamentosDosProcessos(db, ids, 50)])

  const saida: ProcessoRel[] = processos.map(p => ({
    id: p.id,
    numero: p.numero ?? 'sem número',
    titulo: p.titulo,
    area: p.area ?? 'outro',
    status: p.status,
    fase: p.fase,
    tribunal: p.tribunal,
    vara: p.vara,
    comarca: p.comarca,
    classe: p.classe,
    valorCausa: null,
    distribuicao: brData(p.distribuicao) || null,
    advogado: null,
    cliente: null,
    qualificacaoDaPessoa: null,
    contrario: null,
    partes: (partes.get(p.id) ?? []).map(x => ({ nome: x.nome, tipo: x.tipo, qualificacao: null })),
    andamentos: (andamentos.get(p.id) ?? []).map(a => ({
      data: brData(a.data),
      tipo: a.tipo,
      descricao: a.descricao ?? a.titulo,
    })),
  }))
  saida.sort((a, b) => (a.status === 'ativo' ? 0 : 1) - (b.status === 'ativo' ? 0 : 1) || a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }))
  return { pessoa: clienteNome, processos: saida, emitidoEm: agora }
}

export async function gerarRelatorioDoClientePdf(db: Db, clienteId: string, clienteNome: string, agora: Date = new Date()): Promise<Uint8Array> {
  const relatorio = await montarRelatorioDoCliente(db, clienteId, clienteNome, agora)
  return gerarRelatorioSinteticoPdf(relatorio, { rotuloNome: 'Cliente', textoVazio: 'Nenhum processo disponível para consulta neste momento.' })
}
