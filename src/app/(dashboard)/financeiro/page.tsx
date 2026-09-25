import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import FinanceiroPage from './FinanceiroPage'

export default async function FinanceiroRoute() {
  // Apenas sócios acessam o financeiro — alinhado com proxy RESTRICTED e ALLOWED_ROUTES.
  // O proxy já bloqueia outros roles, mas requireRole adiciona defense-in-depth.
  const { profile } = await requireRole(['socio'])
  const supabase = await createClient()

  const hoje = new Date()
  const mesFolhaAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`

  const [{ data: lancamentos }, { data: profilesFuncionarios }, { data: folhas }, { data: dadosPessoais }] = await Promise.all([
    supabase
      .from('financeiro_lancamentos')
      .select('*, cliente:clientes(id, nome), processo:processos(id, numero_processo, titulo)')
      .order('vencimento', { ascending: false })
      .limit(500),
    // Todo mundo que recebe salário: todos os papéis, menos sócio (ver folha_pagamento).
    supabase
      .from('profiles')
      .select('id, nome, email, role')
      .eq('ativo', true)
      .neq('role', 'socio')
      .order('role')
      .order('nome'),
    supabase
      .from('folha_pagamento')
      .select('*')
      .eq('mes_referencia', mesFolhaAtual),
    supabase
      .from('funcionarios_dados_pessoais')
      .select('profile_id, tipo_recibo, cpf, endereco'),
  ])

  const { data: gradePagamento } = await supabase
    .from('grade_pagamento_clientes')
    .select('id, cliente_id, valor_mensal, forma_pagamento, status, observacoes, updated_at, cliente:clientes(id, nome)')
    .order('cliente(nome)')

  const folhaPorProfile = new Map((folhas ?? []).map(f => [f.profile_id, f]))
  const dadosPorProfile = new Map((dadosPessoais ?? []).map(d => [d.profile_id, d]))
  const funcionarios = (profilesFuncionarios ?? []).map(p => {
    const dados = dadosPorProfile.get(p.id)
    return {
      profile_id:     p.id,
      nome:           p.nome,
      email:          p.email,
      role:           p.role,
      folha:          folhaPorProfile.get(p.id) ?? null,
      tipoRecibo:     dados?.tipo_recibo ?? null,
      dadosCompletos: !!(dados?.cpf && dados?.endereco),
    }
  })

  return (
    <div className="internal-page">
      <FinanceiroPage
        lancamentos={(lancamentos ?? []) as any}
        funcionarios={funcionarios as any}
        mesFolhaAtual={mesFolhaAtual}
        gradePagamento={(gradePagamento ?? []) as any}
        role={profile.role}
      />
    </div>
  )
}
