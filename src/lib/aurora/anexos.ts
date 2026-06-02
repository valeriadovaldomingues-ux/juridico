import type { CentralArquivosDocumento } from '@/lib/central-arquivos'

export const AURORA_ANEXO_CONVERSA_CATEGORIA = 'anexo_conversa_aurora' as const

export interface AuroraAnexoResumo {
  id: string
  nome_original: string
  tipo_mime: string
  extensao: string | null
  tamanho_bytes: number | null
  storage_bucket: string
  storage_path: string
  categoria: string | null
  pasta_id: string | null
  visibilidade: string
}

function formatarTamanho(bytes: number | null) {
  if (!bytes || Number.isNaN(bytes) || bytes <= 0) return 'tamanho não informado'
  const unidade = ['B', 'KB', 'MB', 'GB']
  let valor = bytes
  let indice = 0

  while (valor >= 1024 && indice < unidade.length - 1) {
    valor /= 1024
    indice += 1
  }

  return `${valor.toFixed(valor >= 10 || indice === 0 ? 0 : 1)} ${unidade[indice]}`
}

export function mapearAuroraAnexo(documento: CentralArquivosDocumento): AuroraAnexoResumo {
  return {
    id: documento.id,
    nome_original: documento.nome_original,
    tipo_mime: documento.tipo_mime,
    extensao: documento.extensao,
    tamanho_bytes: documento.tamanho_bytes,
    storage_bucket: documento.storage_bucket,
    storage_path: documento.storage_path,
    categoria: documento.categoria,
    pasta_id: documento.pasta_id,
    visibilidade: documento.visibilidade,
  }
}

export function montarContextoAnexosAurora(
  anexos: AuroraAnexoResumo[],
  salvarAnexosNoDossie: boolean,
) {
  if (!anexos.length) return undefined

  const linhas = anexos.map(anexo => {
    const statusDossie = salvarAnexosNoDossie && anexo.pasta_id
      ? 'salvo também no Dossiê Aurora'
      : 'anexo apenas da conversa'

    return `- ${anexo.nome_original} | ${anexo.tipo_mime} | ${formatarTamanho(anexo.tamanho_bytes)} | storage_path: ${anexo.storage_path} | ${statusDossie}`
  })

  return [
    'CONTEXTO DO SISTEMA - ANEXOS DA CONVERSA DA AURORA',
    'O usuário anexou os seguintes arquivos:',
    ...linhas,
    'Categoria padrão dos anexos: anexo_conversa_aurora.',
    'A análise profunda de conteúdo ainda será implementada em fase posterior.',
  ].join('\n')
}
