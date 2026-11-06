import { NextResponse } from 'next/server'
import { metadadosServidor, origemPublica } from '@/lib/mcp/oauth'

// Metadados do servidor de autorização (RFC 8414): endereços de cadastro, login e troca de tokens.
export function GET(req: Request) {
  return NextResponse.json(metadadosServidor(origemPublica(req)), { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' } })
}
