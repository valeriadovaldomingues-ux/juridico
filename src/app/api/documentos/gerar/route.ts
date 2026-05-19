import { apiGuard } from '@/lib/auth/api-guard'
import { gerarDocumentoDocx, nomeArquivoDocumento } from '@/lib/documentos/gerador'
import {
  normalizarDadosDocumento,
  podeGerarDocumento,
  tipoDocumentoValido,
  type TipoDocumentoGerador,
} from '@/lib/documentos/schema'

const ALLOWED_ROLES = ['administrativo', 'advogado', 'gerente', 'socio'] as const

export async function POST(request: Request) {
  const auth = await apiGuard([...ALLOWED_ROLES])
  if (auth instanceof Response) return auth

  const body = await request.json().catch(() => null)
  const confirmouRevisao = body?.confirmouRevisao === true
  const tipoRaw = String(body?.dados?.tipoDocumento ?? body?.tipoDocumento ?? '')
  const tipoDocumento: TipoDocumentoGerador = tipoDocumentoValido(tipoRaw) ? tipoRaw : 'contrato_partido'
  const dados = normalizarDadosDocumento(body?.dados, tipoDocumento)

  if (!podeGerarDocumento(confirmouRevisao, dados)) {
    return Response.json(
      { error: 'Preencha os dados obrigatórios, informe o nome de quem revisou e confirme a revisão antes de gerar o documento.' },
      { status: 400 },
    )
  }

  const docx = gerarDocumentoDocx(dados, tipoDocumento)
  const filename = nomeArquivoDocumento(dados)

  return new Response(new Uint8Array(docx), {
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}
