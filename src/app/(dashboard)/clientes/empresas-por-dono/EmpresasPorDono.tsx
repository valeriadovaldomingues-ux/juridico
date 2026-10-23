'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'

export interface EmpresaGrupo {
  id: string; nome: string; cpf_cnpj: string | null; endereco: string | null; numero: string | null; complemento: string | null
  bairro: string | null; cep: string | null; cidade: string | null; uf: string | null; ativo: boolean
}
export interface GrupoDono { dono: { id: string; nome: string; cpf_cnpj: string | null; ativo: boolean }; empresas: EmpresaGrupo[] }

function enderecoDe(e: EmpresaGrupo): string {
  const rua = [e.endereco, e.numero].filter(Boolean).join(', ')
  const cidade = [e.cidade, e.uf].filter(Boolean).join('/')
  return [rua, e.complemento, e.bairro, e.cep, cidade].filter(Boolean).join(' — ')
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function EmpresasPorDono({ grupos }: { grupos: GrupoDono[] }) {
  const [busca, setBusca] = useState('')
  const filtrados = useMemo(() => {
    const q = semAcento(busca.trim())
    if (!q) return grupos
    return grupos.filter(g => semAcento(`${g.dono.nome} ${g.empresas.map(e => e.nome).join(' ')}`).includes(q))
  }, [grupos, busca])

  function baixarCsv() {
    const aspas = (s: string) => `"${s.replace(/"/g, '""')}"`
    const linhas = [['DONO', 'EMPRESA', 'CNPJ/CPF', 'ENDERECO'], ...filtrados.flatMap(g => g.empresas.map(e => [g.dono.nome, e.nome, e.cpf_cnpj ?? '', enderecoDe(e)]))]
    const csv = '﻿' + linhas.map(l => l.map(aspas).join(';')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'empresas-por-dono.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c5cdd8]" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar dono ou empresa…"
            className="w-full pl-8 pr-3 py-2 text-[13px] bg-white border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60]" />
        </div>
        <span className="text-[12px] text-[#9ca3af]">{filtrados.length} dono{filtrados.length !== 1 ? 's' : ''}</span>
        <button onClick={baixarCsv} disabled={filtrados.length === 0}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-[#1D5F60] border border-[#1D5F60]/30 rounded-lg hover:bg-[#f0f7f7] disabled:opacity-50">
          <Download size={13} /> Baixar planilha (CSV)
        </button>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#e5e7eb] py-12 text-center text-[13px] text-[#9ca3af]">
          Nenhum grupo ainda. No cadastro de uma empresa, preencha <strong>Dono / grupo</strong> com a pessoa dona.
        </div>
      ) : filtrados.map(g => (
        <section key={g.dono.id} className="rounded-xl border border-[#E2DDD8] bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-[#f7fafa] border-b border-[#f3f4f6]">
            <Link href={`/clientes/${g.dono.id}`} className="text-[15px] font-semibold text-[#0f1923] hover:underline">{g.dono.nome}</Link>
            <span className="text-[12px] text-[#6b7280]">{g.empresas.length} empresa{g.empresas.length !== 1 ? 's' : ''}</span>
          </div>
          <table className="w-full">
            <tbody>
              {g.empresas.map(e => (
                <tr key={e.id} className="border-b border-[#f9fafb] last:border-0 text-[13px] text-[#374151]">
                  <td className="px-5 py-2.5 w-[34%]"><Link href={`/clientes/${e.id}`} className="font-medium text-[#1D5F60] hover:underline">{e.nome}</Link>{!e.ativo && <span className="ml-2 text-[11px] text-[#9ca3af]">inativo</span>}</td>
                  <td className="px-3 py-2.5 w-[18%] tabular-nums text-[#6b7280]">{e.cpf_cnpj ?? '—'}</td>
                  <td className="px-3 py-2.5 text-[#6b7280]">{enderecoDe(e) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  )
}
