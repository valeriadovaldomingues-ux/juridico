import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/guards'
import AutomacoesPage from './AutomacoesPage'

export default async function AutomacoesServerPage() {
  await requireRole(['gerente', 'socio'])
  const supabase = await createClient()

  const [{ data: automations }, { data: templates }] = await Promise.all([
    supabase
      .from('automations')
      .select('*')
      .order('created_at', { ascending: true }),
    supabase
      .from('message_templates')
      .select('*')
      .order('name'),
  ])

  return (
    <AutomacoesPage
      initialAutomations={automations ?? []}
      initialTemplates={templates ?? []}
    />
  )
}
