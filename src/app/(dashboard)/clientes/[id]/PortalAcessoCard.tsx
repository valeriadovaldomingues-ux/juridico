'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Eye, KeyRound, Loader2 } from 'lucide-react'
import type { StatusAcessoPortal } from '@/lib/portal-cliente/gestao'

const dataHora = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso)) : '—'

export default function PortalAcessoCard({ clienteId, status }: { clienteId: string; status: StatusAcessoPortal }) {
  const router = useRouter()
  const [email, setEmail] = useState(status.emailAcesso ?? '')
  const [enviar, setEnviar] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function verComoCliente() {
    setOcupado(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/portal-admin/clientes/${clienteId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'ver_como_cliente' }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ tipo: 'erro', texto: dados.error ?? 'Não foi possível abrir a visualização.' }); return }
      window.open(dados.url ?? '/portal', '_blank')
      setMsg({ tipo: 'ok', texto: 'Portal aberto em outra aba, como o cliente vê (30 minutos, só leitura).' })
    } finally {
      setOcupado(false)
    }
  }

  async function alternarHoras(mostrar: boolean) {
    setOcupado(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/portal-admin/clientes/${clienteId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'definir_horas', mostrar }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ tipo: 'erro', texto: dados.error ?? 'Não foi possível salvar.' }); return }
      setMsg({ tipo: 'ok', texto: mostrar ? 'O cliente passa a ver a aba Horas no portal.' : 'A aba Horas foi escondida do portal deste cliente.' })
      router.refresh()
    } finally {
      setOcupado(false)
    }
  }

  async function acionar(acao: 'liberar' | 'revogar' | 'encerrar_sessoes') {
    if (acao === 'revogar' && !window.confirm('Revogar o acesso deste cliente ao portal? As sessões abertas serão encerradas.')) return
    setOcupado(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/portal-admin/clientes/${clienteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, email_acesso: email, enviar_codigo: enviar }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ tipo: 'erro', texto: dados.error ?? 'Não foi possível concluir.' }); return }
      setMsg({
        tipo: 'ok',
        texto:
          acao === 'liberar' ? (dados.codigoEnviado ? 'Acesso liberado e código enviado ao e-mail de acesso.' : 'Acesso liberado.')
          : acao === 'revogar' ? 'Acesso revogado e sessões encerradas.'
          : `Sessões encerradas (${dados.sessoesEncerradas ?? 0}).`,
      })
      router.refresh()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-[#E2DDD8] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-3">
      <p className="text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider flex items-center gap-1.5"><KeyRound size={12} /> Acesso ao portal</p>

      {!status.disponivel ? (
        <p className="text-[12px] text-amber-700">O portal ainda não foi ativado no banco (migração pendente).</p>
      ) : (
        <>
          <div className="text-[13px] space-y-1">
            <p>
              Status:{' '}
              <span className={status.liberado ? 'font-medium text-emerald-700' : status.revogadoEm ? 'font-medium text-rose-700' : 'text-[#7a8899]'}>
                {status.liberado ? 'Liberado' : status.revogadoEm ? 'Revogado' : 'Sem acesso'}
              </span>
            </p>
            {status.liberado && <p className="text-[#3d4a5c] break-all">E-mail de acesso: {status.emailAcesso}</p>}
            {status.liberado && <p className="text-[#7a8899]">Último acesso: {dataHora(status.ultimoAcesso)} · Sessões abertas: {status.sessoesAtivas}</p>}
          </div>

          {!status.documentoValido && (
            <p className="text-[12px] text-amber-700">Este cliente não tem CPF/CNPJ válido no cadastro; sem ele não consegue entrar.</p>
          )}

          <div>
            <label htmlFor="portal-email" className="text-[11px] text-[#a8b3c4] uppercase tracking-wider">E-mail de acesso (recebe o código)</label>
            <input id="portal-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@empresa.com.br" className="mt-1 w-full rounded-lg border border-[#E2DDD8] px-3 py-2 text-[13px]" />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-[#3d4a5c]">
            <input type="checkbox" checked={enviar} onChange={e => setEnviar(e.target.checked)} /> Enviar um primeiro código agora
          </label>

          {status.liberado && (
            <label className="flex items-start gap-2 text-[12px] text-[#3d4a5c]">
              <input type="checkbox" className="mt-0.5" checked={status.mostrarHoras} disabled={ocupado} onChange={e => alternarHoras(e.target.checked)} />
              <span><span className="inline-flex items-center gap-1 font-medium"><Clock size={12} /> Mostrar horas no portal do cliente</span><br /><span className="text-[#7a8899]">Desligue para clientes com contrato fechado: a aba Horas some e o relatório de horas deixa de ser baixado por ele.</span></span>
            </label>
          )}

          {msg && <p role="status" className={`text-[12px] ${msg.tipo === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.texto}</p>}

          <div className="flex flex-wrap gap-2">
            <button onClick={() => acionar('liberar')} disabled={ocupado || !email.trim() || !status.documentoValido} className="inline-flex items-center gap-1.5 rounded-lg bg-[#145A5B] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#1B6E70] disabled:opacity-40">
              {ocupado ? <Loader2 size={12} className="animate-spin" /> : null} {status.liberado ? 'Atualizar e-mail' : 'Liberar acesso'}
            </button>
            {status.liberado && (
              <>
                <button onClick={verComoCliente} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-lg border border-[#145A5B]/40 px-3 py-2 text-[12px] font-medium text-[#145A5B] hover:bg-[#145A5B]/5 disabled:opacity-40"><Eye size={12} /> Ver como cliente</button>
                <button onClick={() => acionar('encerrar_sessoes')} disabled={ocupado} className="rounded-lg border border-[#e5e7eb] px-3 py-2 text-[12px] font-medium text-[#374151] hover:bg-[#f9fafb] disabled:opacity-40">Encerrar sessões</button>
                <button onClick={() => acionar('revogar')} disabled={ocupado} className="rounded-lg border border-rose-200 px-3 py-2 text-[12px] font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40">Revogar acesso</button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
