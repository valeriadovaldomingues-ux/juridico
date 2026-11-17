'use client'

import { Eye } from 'lucide-react'

/** Faixa fixa quando o sócio está vendo o portal "como cliente": deixa claro que é visualização e dá a saída. */
export default function FaixaPrevia({ clienteNome, clienteId }: { clienteNome: string; clienteId: string }) {
  async function encerrar() {
    try { await fetch('/api/portal/auth/sair', { method: 'POST' }) } finally { window.location.href = `/clientes/${clienteId}` }
  }
  return (
    <div role="status" className="sticky top-0 z-50 bg-amber-400 text-[#3b2a00] text-[12px] font-medium">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3 flex-wrap">
        <span className="flex items-center gap-2"><Eye size={14} /> Você está vendo o portal como <strong>{clienteNome}</strong> (visualização, 30 minutos, só leitura).</span>
        <button onClick={encerrar} className="rounded-md bg-[#3b2a00] text-white px-3 py-1 text-[11px] font-semibold hover:bg-black">Encerrar visualização</button>
      </div>
    </div>
  )
}
