import { requireRole } from '@/lib/auth/guards'
import GmailIntegracaoPage from './GmailIntegracaoPage'

export default async function GmailPage() {
  await requireRole(['socio'])
  return <GmailIntegracaoPage />
}
