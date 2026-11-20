import { beforeEach, describe, expect, it } from 'vitest'
import { criarFakeDb, type FakeDb } from './testing/fake-db'
import { CLIENTE_A, CLIENTE_B, seedBasico } from './testing/seed'
import { pastaDropboxDoCliente, validarLinkDropbox } from './pasta-dropbox'
import { definirPastaDropbox, liberarAcesso, statusAcesso } from './gestao'

const SOCIO = 's0000000-0000-4000-8000-000000000001'
const LINK = 'https://www.dropbox.com/scl/fo/abc123/xyz?rlkey=k&dl=0'
let f: FakeDb

beforeEach(() => {
  process.env.PORTAL_SEGREDO = 'segredo-de-teste'
  f = criarFakeDb({ ...seedBasico(), portal_acessos: [], portal_pedidos_acesso: [], portal_codigos: [], portal_sessoes: [] })
})

describe('validarLinkDropbox', () => {
  it('aceita https do dropbox.com (e subdomínios) e normaliza', () => {
    expect(validarLinkDropbox(`  ${LINK}  `)).toEqual({ ok: true, url: LINK })
    expect(validarLinkDropbox('https://dropbox.com/sh/abc/def')).toMatchObject({ ok: true })
    expect(validarLinkDropbox('https://www.dropbox.com/home/Clientes')).toMatchObject({ ok: true })
  })

  it('vazio / nulo → limpa', () => {
    expect(validarLinkDropbox('')).toEqual({ ok: true, url: null })
    expect(validarLinkDropbox('   ')).toEqual({ ok: true, url: null })
    expect(validarLinkDropbox(null)).toEqual({ ok: true, url: null })
    expect(validarLinkDropbox(undefined)).toEqual({ ok: true, url: null })
  })

  it('recusa outro site, http, esquemas perigosos, host parecido e credenciais embutidas', () => {
    for (const ruim of [
      'http://www.dropbox.com/sh/abc',
      'https://evil.com/dropbox.com',
      'https://dropbox.com.evil.com/sh/abc',
      'https://notdropbox.com/sh/abc',
      'https://user:pass@www.dropbox.com/sh/abc',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://dropbox.com/x',
      'www.dropbox.com/sh/abc',
      'não é link',
    ]) {
      expect(validarLinkDropbox(ruim), ruim).toMatchObject({ ok: false })
    }
    expect(validarLinkDropbox(123)).toMatchObject({ ok: false })
    expect(validarLinkDropbox(`https://www.dropbox.com/${'a'.repeat(700)}`)).toMatchObject({ ok: false })
  })
})

describe('definirPastaDropbox / pastaDropboxDoCliente', () => {
  it('exige acesso liberado; salva, loga e limpa', async () => {
    expect(await definirPastaDropbox(f.db, CLIENTE_A, LINK, SOCIO)).toMatchObject({ ok: false, status: 409 })
    await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'a@x.com', usuarioId: SOCIO, enviarCodigo: false })
    expect(await pastaDropboxDoCliente(f.db, CLIENTE_A)).toBeNull()

    expect(await definirPastaDropbox(f.db, CLIENTE_A, LINK, SOCIO)).toEqual({ ok: true, url: LINK })
    expect(f.tabelas.portal_acessos[0].pasta_dropbox_url).toBe(LINK)
    expect(await pastaDropboxDoCliente(f.db, CLIENTE_A)).toBe(LINK)
    expect((await statusAcesso(f.db, CLIENTE_A, '529.982.247-25')).pastaDropbox).toBe(LINK)
    expect(f.tabelas.portal_acessos_log.map(l => l.acao)).toContain('pasta_dropbox')

    expect(await definirPastaDropbox(f.db, CLIENTE_A, '', SOCIO)).toEqual({ ok: true, url: null })
    expect(await pastaDropboxDoCliente(f.db, CLIENTE_A)).toBeNull()
  })

  it('link inválido → 400 e nada é gravado', async () => {
    await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'a@x.com', usuarioId: SOCIO, enviarCodigo: false })
    expect(await definirPastaDropbox(f.db, CLIENTE_A, 'https://evil.com/x', SOCIO)).toMatchObject({ ok: false, status: 400 })
    expect(f.tabelas.portal_acessos[0].pasta_dropbox_url ?? null).toBeNull()
  })

  it('isolamento: o link de um cliente nunca aparece para outro', async () => {
    await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'a@x.com', usuarioId: SOCIO, enviarCodigo: false })
    await liberarAcesso(f.db, { clienteId: CLIENTE_B, emailAcesso: 'b@x.com', usuarioId: SOCIO, enviarCodigo: false })
    await definirPastaDropbox(f.db, CLIENTE_A, LINK, SOCIO)
    expect(await pastaDropboxDoCliente(f.db, CLIENTE_B)).toBeNull()
  })

  it('link antigo inválido no banco nunca chega ao portal; tabela ausente → null (não quebra)', async () => {
    await liberarAcesso(f.db, { clienteId: CLIENTE_A, emailAcesso: 'a@x.com', usuarioId: SOCIO, enviarCodigo: false })
    f.tabelas.portal_acessos[0].pasta_dropbox_url = 'javascript:alert(1)'
    expect(await pastaDropboxDoCliente(f.db, CLIENTE_A)).toBeNull()
    f.falharTabela('portal_acessos', '42P01')
    expect(await pastaDropboxDoCliente(f.db, CLIENTE_A)).toBeNull()
  })
})
