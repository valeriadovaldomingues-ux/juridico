import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreateServiceClient, mockUploadFileToStorage, mockRemoveFileFromStorage, mockCreateDownloadUrl } = vi.hoisted(() => ({
  mockCreateServiceClient: vi.fn(),
  mockUploadFileToStorage: vi.fn(),
  mockRemoveFileFromStorage: vi.fn(),
  mockCreateDownloadUrl: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mockCreateServiceClient,
}))

vi.mock('./storage', () => ({
  assertAllowedCentralArquivosBatch: vi.fn(),
  buildCentralArquivosStoragePath: vi.fn(() => 'docs/pasta/2026/06/01/arquivo-seguro.pdf'),
  uploadFileToStorage: mockUploadFileToStorage,
  removeFileFromStorage: mockRemoveFileFromStorage,
  createDownloadUrl: mockCreateDownloadUrl,
}))

import {
  createPasta,
  getDocumentoDownload,
  listDocumentos,
  uploadCentralArquivos,
} from './service'

function makeQueryResult(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => Promise.resolve(result).then(resolve),
  }
  return chain
}

beforeEach(() => {
  mockCreateServiceClient.mockReset()
  mockUploadFileToStorage.mockReset()
  mockRemoveFileFromStorage.mockReset()
  mockCreateDownloadUrl.mockReset()
})

describe('central-arquivos service', () => {
  it('cria pasta com dados normalizados', async () => {
    const query = makeQueryResult({
      data: {
        id: 'p1',
        nome: 'Pasta 1',
        descricao: null,
        cliente_id: null,
        processo_id: null,
        caso_id: null,
        pasta_pai_id: null,
        criado_por: 'uid',
        visibilidade: 'interna',
      },
      error: null,
    })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => query),
    })

    const pasta = await createPasta({ nome: ' Pasta 1 ' }, 'uid')

    expect(pasta.nome).toBe('Pasta 1')
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Pasta 1', criado_por: 'uid' }))
  })

  it('faz rollback do arquivo quando gravar metadados falhar', async () => {
    const query = makeQueryResult({
      data: null,
      error: { message: 'falha de inserção' },
    })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => query),
    })
    mockUploadFileToStorage.mockResolvedValue('docs/pasta/2026/06/01/arquivo-seguro.pdf')

    const file = new File([new Uint8Array([1, 2, 3])], 'arquivo.pdf', { type: 'application/pdf' })

    await expect(uploadCentralArquivos({ files: [file] }, 'uid')).rejects.toMatchObject({
      code: 'metadata_failed',
    })

    expect(mockRemoveFileFromStorage).toHaveBeenCalledWith('docs/pasta/2026/06/01/arquivo-seguro.pdf')
  })

  it('retorna download assinado do documento', async () => {
    const query = makeQueryResult({
      data: {
        id: 'd1',
        nome_original: 'Arquivo.pdf',
        tipo_mime: 'application/pdf',
        storage_path: 'docs/arquivo.pdf',
        storage_bucket: 'central-arquivos',
      },
      error: null,
    })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => query),
    })
    mockCreateDownloadUrl.mockResolvedValue('https://example.com/download')

    const download = await getDocumentoDownload('d1')

    expect(download.signedUrl).toBe('https://example.com/download')
    expect(download.fileName).toBe('Arquivo.pdf')
    expect(download.mimeType).toBe('application/pdf')
  })

  it('oculta anexos temporários da conversa da listagem padrão', async () => {
    const query = makeQueryResult({
      data: [
        {
          id: 'temp-1',
          pasta_id: null,
          nome_original: 'anexo.pdf',
          nome_armazenado: 'anexo.pdf',
          tipo_mime: 'application/pdf',
          extensao: 'pdf',
          tamanho_bytes: 123,
          storage_bucket: 'central-arquivos',
          storage_path: 'docs/temp/anexo.pdf',
          cliente_id: null,
          processo_id: null,
          caso_id: null,
          categoria: 'anexo_conversa_aurora',
          descricao: null,
          enviado_por: 'uid',
          status_processamento: 'pendente',
          status_transcricao: null,
          visibilidade: 'interna',
          analise_aurora: null,
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-01T00:00:00Z',
        },
        {
          id: 'doc-1',
          pasta_id: 'p1',
          nome_original: 'dossiê.pdf',
          nome_armazenado: 'dossie.pdf',
          tipo_mime: 'application/pdf',
          extensao: 'pdf',
          tamanho_bytes: 456,
          storage_bucket: 'central-arquivos',
          storage_path: 'docs/dossie.pdf',
          cliente_id: null,
          processo_id: null,
          caso_id: null,
          categoria: 'dossiê',
          descricao: null,
          enviado_por: 'uid',
          status_processamento: 'pendente',
          status_transcricao: null,
          visibilidade: 'interna',
          analise_aurora: null,
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-01T00:00:00Z',
        },
      ],
      error: null,
    })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => query),
    })

    const documentos = await listDocumentos()

    expect(documentos).toHaveLength(1)
    expect(documentos[0]?.id).toBe('doc-1')
  })
})
