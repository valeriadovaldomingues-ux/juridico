import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { extrairTextoDocumentoProcesso } from '@/lib/processos/importar-documento.server'

// Lê o texto de uma ata enviada em arquivo (.docx, .pdf com texto ou .txt).
export async function POST(req: NextRequest) {
  const auth = await apiGuard(['administrativo', 'advogado', 'gerente', 'socio'])
  if (auth instanceof NextResponse) return auth

  const form = await req.formData().catch(() => null)
  const arquivo = form?.get('arquivo')
  if (!arquivo || typeof arquivo === 'string') return NextResponse.json({ error: 'Envie o arquivo da ata.' }, { status: 400 })

  try {
    if (arquivo.name.toLowerCase().endsWith('.txt')) {
      const texto = (await arquivo.text()).trim()
      if (!texto) return NextResponse.json({ error: 'Arquivo vazio.' }, { status: 400 })
      return NextResponse.json({ texto })
    }
    const { texto } = await extrairTextoDocumentoProcesso(arquivo)
    return NextResponse.json({ texto })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Não foi possível ler o arquivo.' }, { status: 400 })
  }
}
