import { createClient } from '@/lib/supabase/server'
import ProcessoForm from '../ProcessoForm'

export default async function NovoProcessoPage() {
  const supabase = await createClient()
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#1a1d23]">Novo Processo</h1>
        <p className="text-sm text-[#6b7280] mt-0.5">Preencha os dados do processo</p>
      </div>
      <ProcessoForm clientes={clientes ?? []} />
    </div>
  )
}
