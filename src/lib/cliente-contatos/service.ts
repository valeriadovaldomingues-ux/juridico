import { createClient } from '@/lib/supabase/server'
import type { ClienteContato, ClienteContatosListFilters, ClienteContatoWriteInput } from './types'
import { normalizeClienteContatoInput, validateClienteContatoInput } from './validation'

class ClienteContatoError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = 'cliente_contato_error',
  ) {
    super(message)
    this.name = 'ClienteContatoError'
  }
}

function buildSelect() {
  return `
    id, cliente_id, nome, cargo, area_responsavel, celular, email, observacoes,
    contato_principal, ativo, recebe_juridico, recebe_financeiro, recebe_documentos,
    recebe_comunicados, criado_por, atualizado_por, created_at, updated_at,
    cliente:clientes(id, nome),
    criado_por_profile:profiles!criado_por(id, nome, role),
    atualizado_por_profile:profiles!atualizado_por(id, nome, role)
  `
}

export async function listClienteContatos(clienteId: string, filters: ClienteContatosListFilters = {}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cliente_contatos')
    .select(buildSelect())
    .eq('cliente_id', clienteId)
    .order('contato_principal', { ascending: false })
    .order('ativo', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new ClienteContatoError(error.message, 500, 'list_failed')
  }

  const items = (data ?? []) as unknown as ClienteContato[]
  return filters.includeInactive === false
    ? items.filter((item) => item.ativo)
    : items
}

export async function getClienteContato(clienteId: string, contatoId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cliente_contatos')
    .select(buildSelect())
    .eq('cliente_id', clienteId)
    .eq('id', contatoId)
    .maybeSingle()

  if (error) {
    throw new ClienteContatoError(error.message, 500, 'load_failed')
  }

  return (data ?? null) as unknown as ClienteContato | null
}

export async function createClienteContato(
  clienteId: string,
  input: Partial<ClienteContatoWriteInput>,
  userId: string,
) {
  const supabase = await createClient()
  const payload = validateClienteContatoInput(normalizeClienteContatoInput(input))

  if (payload.contato_principal) {
    await supabase
      .from('cliente_contatos')
      .update({ contato_principal: false })
      .eq('cliente_id', clienteId)
      .eq('contato_principal', true)
  }

  const { data, error } = await supabase
    .from('cliente_contatos')
    .insert({
      cliente_id: clienteId,
      nome: payload.nome,
      cargo: payload.cargo || null,
      area_responsavel: payload.area_responsavel || null,
      celular: payload.celular || null,
      email: payload.email || null,
      observacoes: payload.observacoes || null,
      contato_principal: payload.contato_principal,
      ativo: payload.ativo,
      recebe_juridico: payload.recebe_juridico,
      recebe_financeiro: payload.recebe_financeiro,
      recebe_documentos: payload.recebe_documentos,
      recebe_comunicados: payload.recebe_comunicados,
      criado_por: userId,
      atualizado_por: userId,
    })
    .select(buildSelect())
    .single()

  if (error || !data) {
    throw new ClienteContatoError(error?.message ?? 'Falha ao criar contato.', 400, 'create_failed')
  }

  return data as unknown as ClienteContato
}

export async function updateClienteContato(
  clienteId: string,
  contatoId: string,
  input: Partial<ClienteContatoWriteInput>,
  userId: string,
) {
  const supabase = await createClient()
  const current = await getClienteContato(clienteId, contatoId)
  if (!current) {
    throw new ClienteContatoError('Contato não encontrado.', 404, 'not_found')
  }

  const payload = validateClienteContatoInput(normalizeClienteContatoInput({
    nome: input.nome ?? current.nome,
    cargo: input.cargo ?? current.cargo ?? '',
    area_responsavel: input.area_responsavel ?? current.area_responsavel ?? '',
    celular: input.celular ?? current.celular ?? '',
    email: input.email ?? current.email ?? '',
    observacoes: input.observacoes ?? current.observacoes ?? '',
    contato_principal: input.contato_principal ?? current.contato_principal,
    ativo: input.ativo ?? current.ativo,
    recebe_juridico: input.recebe_juridico ?? current.recebe_juridico,
    recebe_financeiro: input.recebe_financeiro ?? current.recebe_financeiro,
    recebe_documentos: input.recebe_documentos ?? current.recebe_documentos,
    recebe_comunicados: input.recebe_comunicados ?? current.recebe_comunicados,
  }))

  if (payload.contato_principal) {
    await supabase
      .from('cliente_contatos')
      .update({ contato_principal: false })
      .eq('cliente_id', clienteId)
      .neq('id', contatoId)
  }

  const nextPrincipal = payload.ativo ? payload.contato_principal : false

  const { data, error } = await supabase
    .from('cliente_contatos')
    .update({
      nome: payload.nome,
      cargo: payload.cargo || null,
      area_responsavel: payload.area_responsavel || null,
      celular: payload.celular || null,
      email: payload.email || null,
      observacoes: payload.observacoes || null,
      contato_principal: nextPrincipal,
      ativo: payload.ativo,
      recebe_juridico: payload.recebe_juridico,
      recebe_financeiro: payload.recebe_financeiro,
      recebe_documentos: payload.recebe_documentos,
      recebe_comunicados: payload.recebe_comunicados,
      atualizado_por: userId,
    })
    .eq('cliente_id', clienteId)
    .eq('id', contatoId)
    .select(buildSelect())
    .single()

  if (error || !data) {
    throw new ClienteContatoError(error?.message ?? 'Falha ao atualizar contato.', 400, 'update_failed')
  }

  return data as unknown as ClienteContato
}

export async function deleteClienteContato(clienteId: string, contatoId: string) {
  const supabase = await createClient()
  const current = await getClienteContato(clienteId, contatoId)
  if (!current) {
    throw new ClienteContatoError('Contato não encontrado.', 404, 'not_found')
  }
  if (current.contato_principal) {
    throw new ClienteContatoError('Defina outro contato principal antes de excluir.', 409, 'principal_contact')
  }

  const { error } = await supabase
    .from('cliente_contatos')
    .delete()
    .eq('cliente_id', clienteId)
    .eq('id', contatoId)

  if (error) {
    throw new ClienteContatoError(error.message, 400, 'delete_failed')
  }

  return true
}

export { ClienteContatoError }
