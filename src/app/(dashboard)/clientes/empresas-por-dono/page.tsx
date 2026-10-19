import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/guards'
import EmpresasPorDono, { type GrupoDono } from './EmpresasPorDono'

// Relatório "Empresas por dono": cada pessoa e as empresas que pertencem a ela (campo "Dono / grupo" do cadastro).
export default async function EmpresasPorDonoPage() {
  await requireRole(['estagiario', 'comercial', 'administrativo', 'advogado', 'gerente', 'socio'])
  const supabase = await createClient()

  const { data: empresas } = await supabase
    .from('clientes')
    .select('id, nome, cpf_cnpj, endereco, numero, complemento, bairro, cep, cidade, uf, ativo, dono_id')
    .not('dono_id', 'is', null)
    .order('nome')
    .limit(1000)

  const donoIds = [...new Set((empresas ?? []).map(e => e.dono_id as string))]
  const { data: donos } = donoIds.length
    ? await supabase.from('clientes').select('id, nome, cpf_cnpj, ativo').in('id', donoIds).order('nome')
    : { data: [] as { id: string; nome: string; cpf_cnpj: string | null; ativo: boolean }[] }

  const grupos: GrupoDono[] = (donos ?? []).map(d => ({
    dono: d,
    empresas: (empresas ?? []).filter(e => e.dono_id === d.id),
  }))

  return (
    <div className="internal-page space-y-5 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link href="/clientes" className="flex items-center gap-1.5 text-[13px] text-[#6b7280] hover:text-[#1a1d23]"><ArrowLeft size={14} /> Contatos</Link>
        <span className="text-[#d1d5db]">/</span>
        <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight">Empresas por dono</h1>
      </div>
      <p className="text-[13px] text-[#6b7280]">
        Cada pessoa com as empresas que pertencem a ela. Para incluir uma empresa num grupo, abra o cadastro dela e preencha <strong>Dono / grupo</strong>.
      </p>
      <EmpresasPorDono grupos={grupos} />
    </div>
  )
}
