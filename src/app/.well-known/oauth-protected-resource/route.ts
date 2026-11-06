import { NextResponse } from 'next/server'
import { metadadosRecurso, origemPublica } from '@/lib/mcp/oauth'

// Metadados do recurso protegido (RFC 9728): diz ao Claude onde fazer o login do conector.
export function GET(req: Request) {
  return NextResponse.json(metadadosRecurso(origemPublica(req)), { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' } })
}
