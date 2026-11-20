import { beforeEach, describe, expect, it } from 'vitest'
import { criarFakeDb, type FakeDb } from './testing/fake-db'
import { CLIENTE_A, CLIENTE_B, PROC_A1, PROC_A_OCULTO, PROC_A_SEGREDO, PROC_B1, seedBasico } from './testing/seed'
import { confirmarEnvio, listarEnviosDoCliente, listarEnviosParaEquipe, nomeSeguro, solicitarEnvio, tamanhoLegivel, TAMANHO_MAXIMO_BYTES } from './envios'

let f: FakeDb
let noStorage: { nome: string; metadata: { size: number } }[]
let removidos: string[]

beforeEach(() => {
  f = criarFakeDb({ ...seedBasico(), portal_envios: [] })
  noStorage = []
  removidos = []
  // O fake-db não tem Storage: simula só o que o módulo usa (list e remove).
  ;(f.db as unknown as { storage: unknown }).storage = {
    from: () => ({
      list: async (_pasta: string, o: { search?: string }) => ({ data: noStorage.filter(i => i.nome === o.search).map(i => ({ name: i.nome, metadata: i.metadata })), error: null }),
      remove: async (c: string[]) => { removidos.push(...c); return { data: null, error: null } },
    }),
  }
})

const pedir = (extra: Record<string, unknown> = {}, cliente = CLIENTE_A) => solicitarEnvio(f.db, cliente, { nome: 'RG frente.pdf', tamanho: 120_000, ...extra })

describe('nomeSeguro', () => {
  it('tira caminho, acento e símbolos; mantém a extensão em minúsculas', () => {
    expect(nomeSeguro('C:\\docs\\Comprovante de Endereço (1).PDF')).toBe('Comprovante_de_Endereco_1_.pdf')
    expect(nomeSeguro('../../etc/passwd')).toBe('passwd')
    expect(nomeSeguro('.hidden')).toBe('hidden')
  })
})

describe('solicitarEnvio', () => {
  it('aceita documento e cria registro pendente no caminho do cliente', async () => {
    const r = await pedir()
    expect(r).toMatchObject({ ok: true })
    if (!r.ok) throw new Error()
    expect(r.envio.caminho.startsWith(`${CLIENTE_A}/`)).toBe(true)
    expect(r.envio.contentType).toBe('application/pdf')
    expect(f.tabelas.portal_envios[0]).toMatchObject({ cliente_id: CLIENTE_A, status: 'pendente', nome_original: 'RG frente.pdf' })
  })

  it.each([['programa.exe'], ['script.js'], ['pagina.html'], ['arquivo.zip'], ['semextensao'], ['foto.pdf.exe']])('recusa tipo não aceito: %s → 415', async nome => {
    expect(await pedir({ nome })).toMatchObject({ ok: false, status: 415 })
    expect(f.tabelas.portal_envios).toHaveLength(0)
  })

  it('recusa vazio, tamanho inválido e acima de 25 MB', async () => {
    expect(await pedir({ tamanho: 0 })).toMatchObject({ ok: false, status: 400 })
    expect(await pedir({ tamanho: '10' })).toMatchObject({ ok: false, status: 400 })
    expect(await pedir({ tamanho: TAMANHO_MAXIMO_BYTES + 1 })).toMatchObject({ ok: false, status: 413 })
    expect(await pedir({ tamanho: TAMANHO_MAXIMO_BYTES })).toMatchObject({ ok: true })
  })

  it('processo: só do próprio cliente e visível no portal (outro cliente, oculto, segredo e inexistente → 404)', async () => {
    expect(await pedir({ processoId: PROC_A1 })).toMatchObject({ ok: true })
    for (const id of [PROC_B1, PROC_A_OCULTO, PROC_A_SEGREDO, 'ffffffff-0000-4000-8000-000000000000']) {
      expect(await pedir({ processoId: id })).toMatchObject({ ok: false, status: 404 })
    }
    expect(f.tabelas.portal_envios).toHaveLength(1)
  })

  it('corta o recado em 300 caracteres e ignora recado vazio', async () => {
    await pedir({ descricao: 'x'.repeat(500) })
    await pedir({ descricao: '   ' })
    expect((f.tabelas.portal_envios[0].descricao as string).length).toBe(300)
    expect(f.tabelas.portal_envios[1].descricao).toBeNull()
  })
})

describe('confirmarEnvio', () => {
  async function pendente(cliente = CLIENTE_A) {
    const r = await pedir({}, cliente)
    if (!r.ok) throw new Error('falhou')
    return r.envio
  }
  const chegou = (caminho: string, size: number) => noStorage.push({ nome: caminho.slice(caminho.lastIndexOf('/') + 1), metadata: { size } })

  it('arquivo chegou → publica com o tamanho real do Storage', async () => {
    const e = await pendente()
    chegou(e.caminho, 98_765)
    expect(await confirmarEnvio(f.db, CLIENTE_A, e.id)).toEqual({ ok: true, tamanho: 98_765 })
    expect(f.tabelas.portal_envios[0]).toMatchObject({ status: 'enviado', tamanho_bytes: 98_765 })
    expect(f.tabelas.portal_envios[0].enviado_em).toBeTruthy()
  })

  it('arquivo não chegou → 409 e continua pendente (ninguém vê)', async () => {
    const e = await pendente()
    expect(await confirmarEnvio(f.db, CLIENTE_A, e.id)).toMatchObject({ ok: false, status: 409 })
    expect(f.tabelas.portal_envios[0].status).toBe('pendente')
    expect(await listarEnviosDoCliente(f.db, CLIENTE_A)).toEqual([])
    expect(await listarEnviosParaEquipe(f.db, CLIENTE_A)).toEqual([])
  })

  it('arquivo maior que o limite no Storage → removido e registro apagado', async () => {
    const e = await pendente()
    chegou(e.caminho, TAMANHO_MAXIMO_BYTES + 1)
    expect(await confirmarEnvio(f.db, CLIENTE_A, e.id)).toMatchObject({ ok: false, status: 413 })
    expect(removidos).toEqual([e.caminho])
    expect(f.tabelas.portal_envios).toHaveLength(0)
  })

  it('outro cliente não confirma (nem enxerga) o envio alheio → 404; confirmar duas vezes → 409', async () => {
    const e = await pendente()
    chegou(e.caminho, 10)
    expect(await confirmarEnvio(f.db, CLIENTE_B, e.id)).toMatchObject({ ok: false, status: 404 })
    expect(f.tabelas.portal_envios[0].status).toBe('pendente')
    expect(await confirmarEnvio(f.db, CLIENTE_A, e.id)).toMatchObject({ ok: true })
    expect(await confirmarEnvio(f.db, CLIENTE_A, e.id)).toMatchObject({ ok: false, status: 409 })
  })
})

describe('listagens', () => {
  it('o cliente vê só os dele, sem caminho do Storage; a equipe vê recado e "visto"', async () => {
    f.tabelas.portal_envios.push(
      { id: 'e1', cliente_id: CLIENTE_A, nome_original: 'Contrato.pdf', storage_path: `${CLIENTE_A}/segredo-Contrato.pdf`, tamanho_bytes: 2_500_000, enviado_em: '2026-11-19T12:00:00Z', status: 'enviado', processo_id: PROC_A1, descricao: 'assinado', visto_em: null },
      { id: 'e2', cliente_id: CLIENTE_B, nome_original: 'De outro.pdf', storage_path: `${CLIENTE_B}/x-De_outro.pdf`, tamanho_bytes: 1, enviado_em: '2026-11-19T13:00:00Z', status: 'enviado', processo_id: null, descricao: null, visto_em: null },
      { id: 'e3', cliente_id: CLIENTE_A, nome_original: 'Pendente.pdf', storage_path: `${CLIENTE_A}/y-Pendente.pdf`, tamanho_bytes: null, enviado_em: null, status: 'pendente', processo_id: null, descricao: null, visto_em: null },
    )
    const cliente = await listarEnviosDoCliente(f.db, CLIENTE_A)
    expect(cliente.map(e => e.id)).toEqual(['e1'])
    expect(JSON.stringify(cliente)).not.toMatch(/segredo|storage_path|assinado|De outro|Pendente/)
    expect(cliente[0].processoNumero).toBeTruthy()
    const equipe = await listarEnviosParaEquipe(f.db, CLIENTE_A)
    expect(equipe[0]).toMatchObject({ id: 'e1', descricao: 'assinado', visto: false })
  })

  it('tamanho legível', () => {
    expect(tamanhoLegivel(500)).toBe('1 KB')
    expect(tamanhoLegivel(2_500_000)).toBe('2,4 MB')
    expect(tamanhoLegivel(null)).toBe('')
  })

  it('migração ausente → PortalIndisponivel (a página cai no "em breve")', async () => {
    f.falharTabela('portal_envios', '42P01')
    await expect(listarEnviosDoCliente(f.db, CLIENTE_A)).rejects.toThrow()
  })
})
