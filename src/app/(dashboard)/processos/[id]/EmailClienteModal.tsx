'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Copy, Loader2, Mail, Paperclip, X } from 'lucide-react'

interface Rascunho {
  para: string[]
  cc: string[]
  assunto: string
  corpo: string
  smtp_configurado: boolean
  enviados: { id: string; enviado_em: string; para: string[]; assunto: string; status: string }[]
}

const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23]'
const labelCls = 'block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5'
const dataHoraBR = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

/** E-mail avulso ao cliente do processo: a qualquer momento, escrito pelo advogado, com anexos opcionais. */
export default function EmailClienteModal({ processoId, onFechar }: { processoId: string; onFechar: () => void }) {
  const base = `/api/processos/${processoId}/email`
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [para, setPara] = useState('')
  const [cc, setCc] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [anexos, setAnexos] = useState<File[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let cancelado = false
    fetch(base).then(async res => {
      const r = await res.json().catch(() => ({}))
      if (cancelado) return
      if (!res.ok) { setErro(r.error ?? 'Não foi possível abrir o e-mail.'); setCarregando(false); return }
      setRascunho(r as Rascunho); setPara(r.para.join(', ')); setCc(r.cc.join(', ')); setAssunto(r.assunto); setCorpo(r.corpo)
      setCarregando(false)
    })
    return () => { cancelado = true }
  }, [base])

  async function enviar() {
    if (!window.confirm(`Enviar este e-mail para ${para}${cc ? ` (cópia: ${cc})` : ''}?\n\nDepois de enviado não dá para desfazer.`)) return
    setEnviando(true); setErro('')
    const fd = new FormData()
    fd.append('para', para); fd.append('cc', cc); fd.append('assunto', assunto); fd.append('corpo', corpo)
    anexos.forEach(f => fd.append('anexos', f))
    const res = await fetch(base, { method: 'POST', body: fd })
    setEnviando(false)
    const r = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(r.error ?? 'Não foi possível enviar.'); return }
    setEnviado(true)
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(`Para: ${para}\nCc: ${cc}\nAssunto: ${assunto}\n\n${corpo}`)
      setCopiado(true); setTimeout(() => setCopiado(false), 2000)
    } catch { setErro('Não consegui copiar. Selecione o texto e copie manualmente.') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6] sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-[15px] font-semibold text-[#0f1923] flex items-center gap-2"><Mail size={15} /> E-mail ao cliente</h2>
            <p className="text-[11px] text-[#9ca3af]">Escreva a mensagem e revise antes de enviar — nada sai sozinho.</p>
          </div>
          <button onClick={onFechar} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#f3f4f6]"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {carregando && <p className="flex items-center gap-2 text-[13px] text-[#6b7280]"><Loader2 size={14} className="animate-spin" /> Abrindo…</p>}

          {rascunho && !enviado && (
            <>
              {!rascunho.smtp_configurado && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  O envio pelo sistema ainda não foi ligado. Por enquanto, use <strong>Copiar texto</strong> e envie pelo seu e-mail.
                </p>
              )}
              {rascunho.para.length === 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">O cliente não tem e-mail cadastrado. Digite o endereço em &quot;Para&quot; (e depois atualize o cadastro do cliente).</p>
              )}
              {rascunho.enviados.length > 0 && (
                <details className="rounded-lg bg-sky-50 px-3 py-2 text-[12px] text-sky-800">
                  <summary className="cursor-pointer">E-mails já enviados sobre este processo ({rascunho.enviados.length})</summary>
                  <ul className="mt-2 space-y-1">
                    {rascunho.enviados.map(e => (
                      <li key={e.id}>{dataHoraBR(e.enviado_em)} — {e.assunto} → {e.para.join(', ')}{e.status === 'erro' ? ' (falhou)' : ''}</li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={labelCls}>Para (cliente)</label><input value={para} onChange={e => setPara(e.target.value)} className={inputCls} placeholder="email@cliente.com" /></div>
                <div><label className={labelCls}>Cópia (advogado do processo)</label><input value={cc} onChange={e => setCc(e.target.value)} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Assunto</label><input value={assunto} onChange={e => setAssunto(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Texto</label><textarea value={corpo} onChange={e => setCorpo(e.target.value)} rows={14} className={`${inputCls} leading-relaxed`} /></div>

              <div>
                <label className="inline-flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-[#1D5F60] border border-[#1D5F60]/40 rounded-lg hover:bg-[#1D5F60]/5 cursor-pointer">
                  <Paperclip size={12} /> Anexar arquivo
                  <input type="file" multiple className="hidden"
                    onChange={e => { setAnexos(prev => [...prev, ...Array.from(e.target.files ?? [])].slice(0, 5)); e.target.value = '' }} />
                </label>
                {anexos.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {anexos.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-[12px] text-[#374151]">
                        <Paperclip size={11} className="text-[#9ca3af]" /> {f.name} <span className="text-[#9ca3af]">({(f.size / 1024).toFixed(0)} KB)</span>
                        <button onClick={() => setAnexos(prev => prev.filter((_, j) => j !== i))} className="text-[#c5cdd8] hover:text-red-600" title="Tirar"><X size={12} /></button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-[11px] text-[#9ca3af]">Até 5 arquivos, 15 MB no total. Os anexos não são guardados no sistema, só o nome.</p>
              </div>
            </>
          )}

          {enviado && (
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-3 text-[13px] text-emerald-800"><CheckCircle2 size={16} /> E-mail enviado para {para}. O envio ficou registrado.</p>
          )}
          {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

          <div className="flex gap-3 pt-1 justify-between flex-wrap">
            <button onClick={onFechar} className="px-5 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb]">{enviado ? 'Fechar' : 'Cancelar'}</button>
            {rascunho && !enviado && (
              <div className="flex gap-3">
                <button onClick={copiar} className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-[#1D5F60] border border-[#1D5F60]/40 rounded-xl hover:bg-[#1D5F60]/5">
                  <Copy size={13} /> {copiado ? 'Copiado!' : 'Copiar texto'}
                </button>
                <button onClick={enviar} disabled={enviando || !rascunho.smtp_configurado || !para.trim() || !assunto.trim() || !corpo.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold rounded-xl bg-[#1D5F60] hover:bg-[#27777A] text-white disabled:opacity-50">
                  {enviando ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} Enviar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
