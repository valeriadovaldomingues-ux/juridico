import { emBreve } from '@/lib/portal-cliente/http'

// O log de acesso do portal antigo gravava em portal_access_logs (tabela que não existe). A trilha do portal v2
// é portal_acessos_log e é gravada pelo servidor, não pelo navegador do cliente.
export const GET = emBreve
export const POST = emBreve
