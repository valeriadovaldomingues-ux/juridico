'use client'

import { useState } from 'react'

// Botões da tela de autorização. Usa fetch + window.location (e não <form>) porque a política de segurança do site
// (form-action 'self') bloquearia o redirecionamento do formulário de volta para o Claude.
export default function Autorizar({ pedido }: { pedido: { client_id: string; redirect_uri: string; state: string; code_challenge: string } }) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function decidir(decisao: 'aprovar' | 'negar') {
    setEnviando(true)
    setErro('')
    try {
      const res = await fetch('/api/oauth/aprovar', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...pedido, decisao }),
      })
      const j = await res.json().catch(() => ({})) as { redirect?: string; error?: string }
      if (!res.ok || !j.redirect) { setErro(j.error ?? 'Não foi possível concluir. Tente de novo.'); setEnviando(false); return }
      window.location.href = j.redirect
    } catch {
      setErro('Sem conexão. Tente de novo.')
      setEnviando(false)
    }
  }

  return (
    <div className="mt-6 space-y-3">
      {erro && <p className="text-[12px] text-red-600">{erro}</p>}
      <button type="button" disabled={enviando} onClick={() => decidir('aprovar')}
        className="w-full rounded-xl bg-[var(--color-petrol)] text-white text-[13px] font-semibold py-3 disabled:opacity-60">
        {enviando ? 'Aguarde…' : 'Autorizar'}
      </button>
      <button type="button" disabled={enviando} onClick={() => decidir('negar')}
        className="w-full rounded-xl border border-[var(--color-border)] text-[13px] font-semibold text-[var(--color-ink-2)] py-3 disabled:opacity-60">
        Cancelar
      </button>
    </div>
  )
}
