import { createClient }               from '@/lib/supabase/server'
import { createClient as svcClient }  from '@supabase/supabase-js'
import { redirect }                   from 'next/navigation'
import Sidebar                        from '@/components/layout/Sidebar'
import Header                         from '@/components/layout/Header'
import type { Profile, UserRole }     from '@/types'

// Service client singleton — contorna bug JWT do @supabase/ssr v0.9.0
let _svc: ReturnType<typeof svcClient> | null = null
function getServiceClient() {
  if (_svc) return _svc
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  _svc = svcClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return _svc
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Service role para query de profiles — evita 406 do bug JWT do @supabase/ssr
  const client = getServiceClient() ?? supabase
  const { data: profileData } = await client
    .from('profiles')
    .select('id, nome, email, role, ativo, created_at, cor_kanban')
    .eq('id', user.id)
    .maybeSingle()

  const profile = profileData as Profile | null

  if (profile && !profile.ativo) {
    await supabase.auth.signOut()
    redirect('/login?erro=conta-desativada')
  }

  const role = (profile?.role ?? 'estagiario') as UserRole
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div className="flex h-screen overflow-hidden bg-[#F3F1EE]">
      <Sidebar role={role} devMode={isDev} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header profile={profile} />
        <main className="flex-1 overflow-y-auto p-6 internal-page">
          {children}
        </main>
      </div>
    </div>
  )
}
