// ─── Notificação de movimentação INPI no Trello ───────────────────────────────
//
// A pedido da Valéria (23/09/2026): toda movimentação registrada num
// processo INPI (manual ou automática via RPI) vira um card na lista
// "PLANILHA SEMANAL" do quadro "Escritório - Todos colaboradores", com
// Sidiney e Cristiano como membros — o próprio Trello manda e-mail pra
// quem é adicionado como membro de um card, não precisa de SMTP nenhum.
//
// Decisão de arquitetura: dentro do juridico, não na VPS (pedv-prazos),
// porque o mapeamento de membros do Trello (trello_member_mappings) e a
// movimentação já nascem no mesmo banco aqui — e o pedv-prazos tem escopo
// documentado restrito a prazos/DJEN.

import { createCard } from '@/lib/trello/api'

/** Client mínimo aceito (compatível com o client SSR de sessão e o de service role). */
type DbClient = { from: (table: string) => any }

// Lista "PLANILHA SEMANAL" do board "Escritório - Todos colaboradores"
// (trello_list_mappings, conferido em 23/09/2026).
const PLANILHA_SEMANAL_LIST_ID = '6a723d7b21d16bce6a6986b5'

// Usernames do Trello (trello_member_mappings.trello_username) — mais
// estáveis que o nome completo pra casar o destinatário certo.
const DESTINATARIOS_USERNAMES = ['sidineyduarteribeiro1', 'cristianopessoa2']

export interface NotificarMovimentacaoInput {
  processo: {
    numero_processo: string
    titulo: string
    // O embed do Supabase pro relacionamento clientes!cliente_id vem como
    // objeto ou array de 1 dependendo de como o client tipa a query — aceita
    // os dois e normaliza abaixo.
    cliente?: { nome: string } | { nome: string }[] | null
  }
  movimentacao: {
    descricao: string
    rpi_data: string
    codigo_despacho?: string | null
    origem: 'rpi_auto' | 'manual'
  }
}

/** Best-effort: nunca lança — uma falha aqui não pode derrubar o registro
 *  da movimentação em si, que já foi salva no banco antes desta chamada. */
export async function notificarMovimentacaoInpiNoTrello(
  supabase: DbClient,
  { processo, movimentacao }: NotificarMovimentacaoInput,
): Promise<void> {
  try {
    const { data: integracao } = await supabase
      .from('trello_integrations')
      .select('api_key, api_token')
      .eq('ativo', true)
      .limit(1)
      .maybeSingle()

    if (!integracao?.api_key || !integracao?.api_token) {
      console.warn('[inpi->trello] sem integração Trello ativa — card não criado')
      return
    }

    const { data: membros } = await supabase
      .from('trello_member_mappings')
      .select('trello_member_id, trello_username')
      .in('trello_username', DESTINATARIOS_USERNAMES)

    const idMembers = ((membros ?? []) as Array<{ trello_member_id: string | null }>)
      .map(m => m.trello_member_id)
      .filter((id): id is string => Boolean(id))

    const cliente = Array.isArray(processo.cliente) ? processo.cliente[0] : processo.cliente

    const nome = `INPI · ${processo.titulo} (nº ${processo.numero_processo})`
    const desc = [
      `Movimentação: ${movimentacao.descricao}`,
      movimentacao.codigo_despacho ? `Código: ${movimentacao.codigo_despacho}` : null,
      `Data: ${movimentacao.rpi_data}`,
      `Cliente: ${cliente?.nome ?? '(a preencher)'}`,
      `Origem: ${movimentacao.origem === 'rpi_auto' ? 'RPI automática' : 'Lançamento manual'}`,
    ].filter(Boolean).join('\n')

    await createCard(PLANILHA_SEMANAL_LIST_ID, { name: nome, desc, idMembers }, integracao.api_key, integracao.api_token)
  } catch (err) {
    console.error('[inpi->trello] falha ao criar card de movimentação:', err)
  }
}
