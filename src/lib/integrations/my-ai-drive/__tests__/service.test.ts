import { describe, expect, it, vi } from 'vitest'
import { MyAiDriveUnavailableError } from '../errors'
import { MyAiDriveService, myAiDriveService } from '../service'

describe('My AI Drive service', () => {
  it('retorna status stub/not_configured sem depender de credenciais', () => {
    expect(myAiDriveService.getStatus()).toMatchObject({
      status: 'not_configured',
      configured: false,
    })

    const configured = new MyAiDriveService({ clientId: 'cid', workspaceId: 'wid' })
    expect(configured.getStatus()).toMatchObject({
      configured: true,
      status: 'stub',
    })
  })

  it('não faz chamada externa ao pesquisar arquivos', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const result = await myAiDriveService.searchFiles({
      operation: 'search_files',
      role: 'socio',
      query: 'contrato',
    })

    expect(result.status).toBe('not_configured')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('não faz chamada externa ao listar pastas', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const result = await myAiDriveService.listFolders({
      operation: 'list_folders',
      role: 'socio',
      folderPath: '/docs',
    })

    expect(result.status).toBe('not_configured')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('não faz chamada externa ao buscar metadados', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const result = await myAiDriveService.getFileMetadata({
      operation: 'get_file_metadata',
      role: 'socio',
      fileId: 'file-123',
    })

    expect(result.status).toBe('not_configured')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('bloqueia download e upload como indisponíveis', async () => {
    await expect(myAiDriveService.downloadFile({
      operation: 'download_file',
      role: 'socio',
      fileId: 'file-123',
    })).rejects.toBeInstanceOf(MyAiDriveUnavailableError)

    await expect(myAiDriveService.uploadFile({
      operation: 'upload_file',
      role: 'socio',
      fileName: 'arquivo.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
    })).rejects.toBeInstanceOf(MyAiDriveUnavailableError)
  })

  it('bloqueia operação sem role socio', async () => {
    await expect(myAiDriveService.searchFiles({
      operation: 'search_files',
      role: 'cliente' as never,
      query: 'contrato',
    })).rejects.toThrow('restrita a sócios')
  })
})
