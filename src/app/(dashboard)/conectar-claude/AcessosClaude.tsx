'use client'

import { useState } from 'react'
import { Loader2, ShieldOff } from 'lucide-react'

export interface Acesso {
  id: string
  usuario_nome: string | null
  cliente: string
  conectado_em: string
  ultimo_uso_em: string | null
}

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca usado')

// Acessos ativos do conector (login pelo claude.ai/celular/nuvem). Cada pessoa vê os seus; o sócio vê e revoga os de todos.
export default function AcessosClaude({ iniciais, todos }: { iniciais: Acesso[]; todos: boolean }) {
  const [acessos, setAcessos] = useState<Acesso[]>(iniciais)
  const [erro, setErro] = useState('')
  const [revogando, setRevogando] = useState<string | null>(null)

  async function carregar() {
    const res = await fetch('/api/mcp/acessos')
    const j = await res.json().catch(() => ({})) as { acessos?: Acesso[]; error?: string }
    if (!res.ok) { setErro(j.error ?? 'Não foi possível listar os acessos.'); return }
    setAcessos(j.acessos ?? [])
  }

  async function revogar(a: Acesso) {
    const quem = todos && a.usuario_nome ? `de ${a.usuario_nome}` : 'seu'
    if (!window.confirm(`Revogar o acesso ${quem} (${a.cliente})? O Claude perde o acesso na próxima consulta e a pessoa precisará conectar de novo.`)) return
    setRevogando(a.id); setErro('')
    const res = await fetch('/api/mcp/acessos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: a.id }) })
    const j = await res.json().catch(() => ({})) as { error?: string }
    setRevogando(null)
    if (!res.ok) { setErro(j.error ?? 'Não foi possível revogar agora.'); return }
    await carregar()
  }

  return (
    <section className="space-y-2">
      <h2 className="text-[14px] font-semibold text-[#0f1923]">{todos ? 'Acessos do Claude ao PEDV (todos)' : 'Seus acessos do Claude ao PEDV'}</h2>
      <p className="text-[12px] text-[#6b7280]">Cada linha é um Claude conectado pelo login (navegador, celular ou tarefas na nuvem). Revogar corta o acesso na hora; a pessoa pode conectar de novo quando quiser. As chaves antigas do Claude Desktop não aparecem aqui.</p>
      {erro && <p className="text-[12px] text-red-600">{erro}</p>}
      {acessos.length === 0 && <p className="text-[12px] text-[#6b7280]">Nenhum acesso ativo.</p>}
      {acessos.length > 0 && (
        <ul className="divide-y divide-[#eef0f2] rounded-lg border border-[#e5e7eb] bg-white">
          {acessos.map(a => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[#0f1923] truncate">{todos ? `${a.usuario_nome ?? 'Usuário'} · ` : ''}{a.cliente}</p>
                <p className="text-[11px] text-[#6b7280]">Conectado em {quando(a.conectado_em)} · último uso: {quando(a.ultimo_uso_em)}</p>
              </div>
              <button onClick={() => revogar(a)} disabled={revogando === a.id}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-[12px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
                {revogando === a.id ? <Loader2 size={12} className="animate-spin" /> : <ShieldOff size={12} />} Revogar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
