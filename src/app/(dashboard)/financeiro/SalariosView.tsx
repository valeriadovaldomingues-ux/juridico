'use client'

import { useMemo, useState } from 'react'
import { Check, Loader2, Users } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Funcionario {
  profile_id:      string
  nome:            string
  email:           string
  role:            string
  valor_salario:   number | null
  dia_pagamento:   number | null
  forma_pagamento: 'pix' | 'ted' | 'dinheiro' | 'outro' | null
  observacoes:     string | null
  updated_at:      string | null
}

interface Props {
  funcionarios: Funcionario[]
}

const ROLE_LABEL: Record<string, string> = {
  advogado:      'Advogado(a)',
  gerente:       'Gerente',
  administrativo:'Administrativo',
  comercial:     'Comercial',
  estagiario:    'Estagiário(a)',
}

const ROLE_ORDEM = ['gerente', 'advogado', 'administrativo', 'comercial', 'estagiario']

const FORMA_LABEL: Record<string, string> = {
  pix: 'Pix', ted: 'TED', dinheiro: 'Dinheiro', outro: 'Outro',
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function SalariosView({ funcionarios: inicial }: Props) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>(inicial)
  const [salvandoId,   setSalvandoId]   = useState<string | null>(null)
  const [salvoId,      setSalvoId]      = useState<string | null>(null)

  const agrupados = useMemo(() => {
    const grupos: Record<string, Funcionario[]> = {}
    funcionarios.forEach(f => {
      grupos[f.role] = grupos[f.role] ?? []
      grupos[f.role].push(f)
    })
    return ROLE_ORDEM
      .filter(r => grupos[r]?.length)
      .map(r => ({ role: r, itens: grupos[r] }))
  }, [funcionarios])

  const totalFolha = useMemo(
    () => funcionarios.reduce((s, f) => s + (f.valor_salario ?? 0), 0),
    [funcionarios],
  )

  function patch(profileId: string, campo: keyof Funcionario, valor: any) {
    setFuncionarios(prev => prev.map(f => f.profile_id === profileId ? { ...f, [campo]: valor } : f))
  }

  async function salvar(f: Funcionario) {
    setSalvandoId(f.profile_id)
    setSalvoId(null)
    const res = await fetch('/api/financeiro/salarios', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        profile_id:      f.profile_id,
        valor_salario:   f.valor_salario,
        dia_pagamento:   f.dia_pagamento,
        forma_pagamento: f.forma_pagamento,
        observacoes:     f.observacoes,
      }),
    })
    setSalvandoId(null)
    if (res.ok) {
      const updated = await res.json()
      setFuncionarios(prev => prev.map(x => x.profile_id === f.profile_id ? { ...x, ...updated } : x))
      setSalvoId(f.profile_id)
      window.setTimeout(() => setSalvoId(id => id === f.profile_id ? null : id), 2000)
    } else {
      alert('Erro ao salvar')
    }
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-lg outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23] placeholder:text-[#c5cdd8] transition-all'

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#7a8899]">
          {funcionarios.length} pessoas na folha — preencha valor, dia de pagamento e forma pra cada uma.
          A geração de recibo entra numa próxima etapa.
        </p>
        <div className="bg-[#f9fafb] rounded-xl px-4 py-2.5 border border-[#f3f4f6] text-right">
          <p className="text-[11px] text-[#9ca3af]">Total da folha (preenchido)</p>
          <p className="text-[18px] font-bold text-[#0f1923] tabular-nums">{formatCurrency(totalFolha)}</p>
        </div>
      </div>

      {agrupados.map(({ role, itens }) => (
        <div key={role}>
          <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Users size={12} /> {ROLE_LABEL[role] ?? role} <span className="text-[#c5cdd8]">({itens.length})</span>
          </p>
          <div className="rounded-xl border border-[#f3f4f6] overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-[#f9fafb] border-b border-[#f3f4f6]">
                <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4">Nome</th>
                <th className="text-right text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4 w-40">Salário (R$)</th>
                <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4 w-28">Dia pgto.</th>
                <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4 w-36">Forma</th>
                <th className="text-left  text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider py-2.5 px-4 w-16"></th>
              </tr></thead>
              <tbody>
                {itens.map(f => (
                  <tr key={f.profile_id} className="border-b border-[#f9fafb] last:border-0">
                    <td className="px-4 py-2.5 text-[13px] text-[#374151]">
                      {f.nome}
                      <span className="block text-[11px] text-[#9ca3af]">{f.email}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number" step="0.01" min="0" placeholder="0,00"
                        value={f.valor_salario ?? ''}
                        onChange={e => patch(f.profile_id, 'valor_salario', e.target.value === '' ? null : Number(e.target.value))}
                        className={cn(inputCls, 'text-right')}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number" min="1" max="31" placeholder="—"
                        value={f.dia_pagamento ?? ''}
                        onChange={e => patch(f.profile_id, 'dia_pagamento', e.target.value === '' ? null : Number(e.target.value))}
                        className={inputCls}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={f.forma_pagamento ?? ''}
                        onChange={e => patch(f.profile_id, 'forma_pagamento', e.target.value || null)}
                        className={inputCls}
                      >
                        <option value="">—</option>
                        {Object.entries(FORMA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => salvar(f)}
                        disabled={salvandoId === f.profile_id}
                        title="Salvar"
                        className={cn(
                          'p-1.5 rounded-lg transition-colors disabled:opacity-40',
                          salvoId === f.profile_id ? 'text-[#1a7a45]' : 'text-[#9ca3af] hover:text-[#1D5F60] hover:bg-[#f0f7f7]',
                        )}
                      >
                        {salvandoId === f.profile_id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Check size={14} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {funcionarios.length === 0 && (
        <p className="text-[13px] text-[#9ca3af] text-center py-8">Nenhum funcionário ativo encontrado.</p>
      )}
    </div>
  )
}
