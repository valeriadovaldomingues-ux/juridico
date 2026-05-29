import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildClienteLookupOption,
  buildProcessoLookupOption,
  fetchClienteOptions,
  fetchProcessoOptions,
  fetchUsuarioOptions,
} from './remote'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('remote combobox helpers', () => {
  it('transforma cliente e processo em opções pesquisáveis', () => {
    const cliente = buildClienteLookupOption({
      id: 'cliente-1',
      nome: 'João da Silva',
      cpf_cnpj: '12345678900',
      telefone: '(11) 99999-0000',
      celular: null,
      email: 'joao@example.com',
    })

    const processo = buildProcessoLookupOption({
      value: 'proc-1',
      label: '0001234-56.2026.8.26.0100 — Ação Cível',
      description: 'Cliente: João da Silva · Área: Cível',
    })

    expect(cliente.description).toContain('123.456.789-00')
    expect(cliente.keywords).toContain('joao@example.com')
    expect(processo.keywords).toContain('0001234-56.2026.8.26.0100 — Ação Cível')
  })

  it('carrega opções remotas sem expor secrets', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([
        {
          id: 'cliente-1',
          nome: 'João da Silva',
          cpf_cnpj: '12345678900',
          telefone: '(11) 99999-0000',
          celular: null,
          email: 'joao@example.com',
        },
      ]), { status: 200, headers: { 'content-type': 'application/json' } }),
    ).mockResolvedValueOnce(
      new Response(JSON.stringify([
        {
          value: 'proc-1',
          label: '0001234-56.2026.8.26.0100 — Ação Cível',
          description: 'Cliente: João da Silva',
        },
      ]), { status: 200, headers: { 'content-type': 'application/json' } }),
    ).mockResolvedValueOnce(
      new Response(JSON.stringify([
        {
          id: 'user-1',
          nome: 'Maria Souza',
          email: 'maria@exemplo.com',
          role: 'advogado',
        },
      ]), { status: 200, headers: { 'content-type': 'application/json' } }),
    )

    const clientes = await fetchClienteOptions('joao', 10)
    const processos = await fetchProcessoOptions('0001234', 10)
    const usuarios = await fetchUsuarioOptions('maria', 10)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(clientes[0]?.label).toBe('João da Silva')
    expect(processos[0]?.label).toContain('Ação Cível')
    expect(usuarios[0]?.description).toContain('Advogado')
    expect(JSON.stringify({ clientes, processos, usuarios })).not.toContain('secret')
    expect(JSON.stringify({ clientes, processos, usuarios })).not.toContain('token')
  })
})
