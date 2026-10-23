import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import { podeAcessarFinanceiro, financeiroLiberadoPorUsuario, podeAcessarSalarios, ABAS_FINANCEIRO_LIBERADO } from '@/lib/auth/financeiro-acesso'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import FinanceiroPage from './FinanceiroPage'

export default async function FinanceiroRoute() {
  // Sócio vê tudo; pessoas liberadas individualmente (ex.: Célio, ver financeiro-acesso.ts) veem os
  // lançamentos e a grade, mas NÃO salários/folha. Alinhado com proxy e com as políticas do banco.
  const { profile, userId } = await requireAuth()
  if (!podeAcessarFinanceiro(userId, profile.role)) redirect('/dashboard')
  const verSalarios = podeAcessarSalarios(userId, profile.role)
  const somenteLiberado = profile.role !== 'socio' && financeiroLiberadoPorUsuario(userId)
  const supabase = await createClient()

  const hoje = new Date()
  const mesFolhaAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`

  const [{ data: lancamentos }, { data: profilesFuncionarios }, { data: folhas }, { data: dadosPessoais }] = await Promise.all([
    supabase
      .from('financeiro_lancamentos')
      .select('*, cliente:clientes(id, nome), processo:processos(id, numero_processo, titulo)')
      .order('vencimento', { ascending: false })
      .limit(1000),
    // Todo mundo que recebe salário: todos os papéis, menos sócio (ver folha_pagamento).
    verSalarios
      // Quem não é gerente/sócio só enxerga o próprio perfil pelas regras do banco; a lista de funcionários
      // da folha vem pelo servidor (esta página já passou pela checagem de acesso acima).
      ? (somenteLiberado ? createServiceClient() : supabase).from('profiles').select('id, nome, email, role').eq('ativo', true).neq('role', 'socio').order('role').order('nome')
      : Promise.resolve({ data: [] as { id: string; nome: string; email: string | null; role: string }[] }),
    verSalarios
      ? supabase.from('folha_pagamento').select('*').eq('mes_referencia', mesFolhaAtual)
      : Promise.resolve({ data: [] as { profile_id: string }[] }),
    verSalarios
      ? supabase.from('funcionarios_dados_pessoais').select('profile_id, tipo_recibo, cpf, endereco')
      : Promise.resolve({ data: [] as { profile_id: string; tipo_recibo: string | null; cpf: string | null; endereco: string | null }[] }),
  ])

  // Grade (Receita Partido) é receita: não vai para quem está liberado só em despesas/salários.
  const { data: gradePagamento } = somenteLiberado
    ? { data: [] }
    : await supabase
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
        acessoCompleto={financeiroLiberadoPorUsuario(userId)}
        verSalarios={verSalarios}
        abasPermitidas={somenteLiberado ? [...ABAS_FINANCEIRO_LIBERADO] : undefined}
      />
    </div>
  )
}
