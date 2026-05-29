import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/auth/api-guard'
import { myAiDriveService } from '@/lib/integrations/my-ai-drive'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await apiGuard(['socio'])
  if (auth instanceof NextResponse) return auth

  try {
    const status = myAiDriveService.getStatus()
    return NextResponse.json({
      provider: 'my-ai-drive',
      status: status.status,
      configured: status.configured,
      message: status.message,
      timestamp: status.checkedAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao consultar status do My AI Drive'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
