import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { importarDadosProcessoDeDocumento } from '@/lib/processos/importar-documento.server'

const ALLOWED_ROLES = ['administrativo', 'advogado', 'gerente', 'socio'] as const

function statusFromError(message: string) {
  const lower = message.toLowerCase()
  if (
    lower.includes('tipo de arquivo não permitido') ||
    lower.includes('tipo mime não permitido') ||
    lower.includes('arquivo vazio') ||
    lower.includes('arquivo excede o tamanho máximo') ||
    lower.includes('não foi possível extrair') ||
    lower.includes('não suportado automaticamente') ||
    lower.includes('legado')
  ) {
    return 422
  }
  return 500
}

export async function POST(request: NextRequest) {
  const auth = await apiGuard([...ALLOWED_ROLES])
  if (auth instanceof NextResponse) return auth

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const arquivo = formData.get('documento')
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: 'Envie um arquivo em documento.' }, { status: 400 })
  }

  try {
    const resultado = await importarDadosProcessoDeDocumento(arquivo)

    console.info('[processos/importar-documento]', {
      usuario: auth.userId,
      tipoArquivo: arquivo.type || 'unknown',
      extensao: resultado.arquivo.extensao,
      sucesso: true,
    })

    return NextResponse.json({
      arquivo: resultado.arquivo,
      dados: resultado.dados,
      mensagem: 'Documento analisado com sucesso. Revise os dados antes de aplicar.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao importar documento'
    console.info('[processos/importar-documento]', {
      usuario: auth.userId,
      tipoArquivo: arquivo.type || 'unknown',
      sucesso: false,
    })
    return NextResponse.json({ error: message }, { status: statusFromError(message) })
  }
}
