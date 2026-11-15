'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, ArrowRight, ArrowLeft, IdCard, KeyRound } from 'lucide-react'
import Logo from '@/components/ui/Logo'
import { mascararDocumento } from '@/lib/portal-cliente/documento'

type Etapa = 'documento' | 'codigo' | 'pedido' | 'pedido_ok'

const campo =
  'w-full px-4 py-3 bg-white/6 border border-white/10 rounded-xl text-white text-[14px] outline-none placeholder:text-white/25 focus:border-[var(--color-copper)]/70 focus:ring-2 focus:ring-[var(--color-copper)]/15 transition-colors'
const rotulo = 'block text-[10px] text-[var(--color-copper)] mb-2 tracking-[0.2em] uppercase'
const botao =
  'w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-[var(--color-copper)] hover:bg-[var(--color-copper-hover)] text-white text-[11px] tracking-[0.15em] uppercase font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
const linkSutil = 'text-[12px] text-[var(--color-copper)]/90 hover:text-[var(--color-copper)] underline underline-offset-4 transition-colors'

function mascararData(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.replace(/^(\d{2})(\d)/, '$1/$2').replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3')
}

async function chamar(url: string, corpo: Record<string, unknown>) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
  const dados = (await res.json().catch(() => ({}))) as { error?: string; mensagem?: string }
  return { status: res.status, ok: res.ok, dados }
}

export default function PortalLoginForm({ destino }: { destino: string }) {
  const [etapa, setEtapa] = useState<Etapa>('documento')
  const [documento, setDocumento] = useState('')
  const [codigo, setCodigo] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  // pedido de primeiro acesso
  const [nascimento, setNascimento] = useState('')
  const [nomeMae, setNomeMae] = useState('')
  const [nomePai, setNomePai] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [website, setWebsite] = useState('') // isca para robôs: fica escondido

  function ir(e: Etapa) {
    setErro('')
    setEtapa(e)
  }

  async function pedirCodigo(ev: React.FormEvent) {
    ev.preventDefault()
    setCarregando(true)
    setErro('')
    try {
      const r = await chamar('/api/portal/auth/solicitar', { documento })
      if (r.ok) {
        setAviso(r.dados.mensagem ?? '')
        ir('codigo')
      } else {
        setErro(r.dados.error ?? 'Não foi possível continuar. Tente novamente.')
      }
    } catch {
      setErro('Sem conexão. Verifique a internet e tente de novo.')
    } finally {
      setCarregando(false)
    }
  }

  async function entrar(ev: React.FormEvent) {
    ev.preventDefault()
    setCarregando(true)
    setErro('')
    try {
      const r = await chamar('/api/portal/auth/verificar', { documento, codigo })
      if (r.ok) {
        window.location.assign(destino) // navegação completa: o cookie de sessão já foi gravado
        return
      }
      setErro(r.dados.error ?? 'Código inválido ou expirado.')
    } catch {
      setErro('Sem conexão. Verifique a internet e tente de novo.')
    }
    setCarregando(false)
  }

  async function enviarPedido(ev: React.FormEvent) {
    ev.preventDefault()
    setCarregando(true)
    setErro('')
    try {
      const r = await chamar('/api/portal/auth/pedido-acesso', {
        documento, nascimento, nome_mae: nomeMae, nome_pai: nomePai || undefined, email, telefone: telefone || undefined, website,
      })
      if (r.ok) ir('pedido_ok')
      else setErro(r.dados.error ?? 'Não foi possível enviar agora. Tente novamente.')
    } catch {
      setErro('Sem conexão. Verifique a internet e tente de novo.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, var(--color-sidebar) 0%, var(--color-sidebar-deep) 65%, #06111B 100%)' }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-copper)]/60 to-transparent" />
      <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full border border-[var(--color-copper)]/10 pointer-events-none" />
      <div className="absolute -left-28 bottom-10 h-72 w-72 rounded-full border border-white/5 pointer-events-none" />

      <div className="text-center mb-8">
        <Logo variant="login" tone="light" />
      </div>

      <div className="w-full max-w-[420px] relative">
        <div
          className="border border-white/10 p-6 sm:p-8 rounded-2xl shadow-[0_30px_90px_rgba(0,0,0,0.22)]"
          style={{ background: 'rgba(252,250,247,0.06)', backdropFilter: 'blur(14px)' }}
        >
          {etapa === 'documento' && (
            <>
              <div className="mb-6">
                <p className="text-[10px] text-[var(--color-copper)] mb-2 tracking-[0.22em] uppercase">Portal reservado</p>
                <h1 className="font-brand text-white text-[30px] leading-none mb-3 font-semibold">Área do cliente</h1>
                <p className="text-white/55 text-[13px] leading-relaxed">
                  Digite o seu CPF ou CNPJ. Vamos enviar um código de 6 dígitos para o e-mail de acesso cadastrado no escritório.
                </p>
              </div>
              <form onSubmit={pedirCodigo} className="space-y-5">
                <div>
                  <label htmlFor="documento" className={rotulo}>CPF ou CNPJ</label>
                  <div className="relative">
                    <IdCard size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      id="documento" inputMode="numeric" autoComplete="off" autoFocus required
                      value={documento} onChange={e => setDocumento(mascararDocumento(e.target.value))}
                      placeholder="000.000.000-00" className={`${campo} pl-10`}
                    />
                  </div>
                </div>
                {erro && <p role="alert" className="text-[12px] text-[#FFD5CC] bg-[#e74c3c]/10 border border-[#e74c3c]/20 px-3 py-2 rounded-xl">{erro}</p>}
                <button type="submit" disabled={carregando || documento.replace(/\D/g, '').length < 11} className={botao}>
                  {carregando ? <Loader2 size={14} className="animate-spin" /> : <>Receber código <ArrowRight size={13} /></>}
                </button>
              </form>
              <p className="text-center mt-6">
                <button type="button" onClick={() => ir('pedido')} className={linkSutil}>Primeiro acesso ou não recebi o código</button>
              </p>
            </>
          )}

          {etapa === 'codigo' && (
            <>
              <div className="mb-6">
                <p className="text-[10px] text-[var(--color-copper)] mb-2 tracking-[0.22em] uppercase">Quase lá</p>
                <h1 className="font-brand text-white text-[28px] leading-none mb-3 font-semibold">Digite o código</h1>
                <p className="text-white/55 text-[13px] leading-relaxed">{aviso || 'Se o seu acesso estiver liberado, enviamos um código de 6 dígitos para o e-mail de acesso.'}</p>
              </div>
              <form onSubmit={entrar} className="space-y-5">
                <div>
                  <label htmlFor="codigo" className={rotulo}>Código de 6 dígitos</label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      id="codigo" inputMode="numeric" autoComplete="one-time-code" autoFocus required maxLength={6}
                      value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000" className={`${campo} pl-10 tracking-[0.4em] text-[18px]`}
                    />
                  </div>
                </div>
                {erro && <p role="alert" className="text-[12px] text-[#FFD5CC] bg-[#e74c3c]/10 border border-[#e74c3c]/20 px-3 py-2 rounded-xl">{erro}</p>}
                <button type="submit" disabled={carregando || codigo.length !== 6} className={botao}>
                  {carregando ? <Loader2 size={14} className="animate-spin" /> : <>Entrar no portal <ArrowRight size={13} /></>}
                </button>
              </form>
              <div className="flex flex-col items-center gap-3 mt-6">
                <button type="button" onClick={() => { setCodigo(''); ir('documento') }} className={`${linkSutil} inline-flex items-center gap-1`}><ArrowLeft size={12} /> Voltar e pedir outro código</button>
                <button type="button" onClick={() => ir('pedido')} className={linkSutil}>Não recebi / primeiro acesso</button>
              </div>
            </>
          )}

          {etapa === 'pedido' && (
            <>
              <div className="mb-6">
                <p className="text-[10px] text-[var(--color-copper)] mb-2 tracking-[0.22em] uppercase">Primeiro acesso</p>
                <h1 className="font-brand text-white text-[26px] leading-none mb-3 font-semibold">Peça o seu acesso</h1>
                <p className="text-white/55 text-[13px] leading-relaxed">
                  Preencha os dados abaixo. O escritório confere e entra em contato com você para liberar. Nenhum código é enviado antes dessa conversa.
                </p>
              </div>
              <form onSubmit={enviarPedido} className="space-y-4">
                <div>
                  <label htmlFor="p-doc" className={rotulo}>CPF ou CNPJ</label>
                  <input id="p-doc" inputMode="numeric" required value={documento} onChange={e => setDocumento(mascararDocumento(e.target.value))} className={campo} placeholder="000.000.000-00" />
                </div>
                <div>
                  <label htmlFor="p-nasc" className={rotulo}>Data de nascimento (do titular)</label>
                  <input id="p-nasc" inputMode="numeric" required value={nascimento} onChange={e => setNascimento(mascararData(e.target.value))} className={campo} placeholder="dd/mm/aaaa" />
                </div>
                <div>
                  <label htmlFor="p-mae" className={rotulo}>Nome completo da mãe</label>
                  <input id="p-mae" required minLength={3} maxLength={120} autoComplete="off" value={nomeMae} onChange={e => setNomeMae(e.target.value)} className={campo} />
                </div>
                <div>
                  <label htmlFor="p-pai" className={rotulo}>Nome completo do pai (opcional)</label>
                  <input id="p-pai" maxLength={120} autoComplete="off" value={nomePai} onChange={e => setNomePai(e.target.value)} className={campo} />
                </div>
                <div>
                  <label htmlFor="p-email" className={rotulo}>Seu e-mail</label>
                  <input id="p-email" type="email" required maxLength={160} value={email} onChange={e => setEmail(e.target.value)} className={campo} placeholder="voce@email.com.br" />
                </div>
                <div>
                  <label htmlFor="p-tel" className={rotulo}>Telefone ou WhatsApp (opcional)</label>
                  <input id="p-tel" inputMode="tel" value={telefone} onChange={e => setTelefone(e.target.value)} className={campo} placeholder="(31) 90000-0000" />
                </div>
                {/* Isca para robôs: pessoas não veem nem preenchem. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label>Não preencha <input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
                </div>
                {erro && <p role="alert" className="text-[12px] text-[#FFD5CC] bg-[#e74c3c]/10 border border-[#e74c3c]/20 px-3 py-2 rounded-xl">{erro}</p>}
                <button type="submit" disabled={carregando} className={botao}>
                  {carregando ? <Loader2 size={14} className="animate-spin" /> : <>Enviar pedido <ArrowRight size={13} /></>}
                </button>
              </form>
              <p className="text-white/35 text-[11px] leading-relaxed mt-4">
                Usamos estes dados só para conferir quem você é e apagamos a data de nascimento e o nome dos pais assim que o escritório decidir.
              </p>
              <p className="text-center mt-5">
                <button type="button" onClick={() => ir('documento')} className={`${linkSutil} inline-flex items-center gap-1`}><ArrowLeft size={12} /> Voltar</button>
              </p>
            </>
          )}

          {etapa === 'pedido_ok' && (
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 size={38} className="mx-auto text-[var(--color-copper)]" strokeWidth={1.5} />
              <h1 className="font-brand text-white text-[28px] leading-none font-semibold">Pedido recebido</h1>
              <p className="text-white/60 text-[13px] leading-relaxed">
                Recebemos o seu pedido. O escritório vai conferir os dados e entrar em contato com você para liberar o acesso.
              </p>
              <button type="button" onClick={() => ir('documento')} className={linkSutil}>Voltar ao início</button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="w-16 h-px bg-[var(--color-copper)] opacity-30" />
        <p className="text-[9px] text-white/30 tracking-[0.2em] uppercase text-center">P&amp;V · Pessoa e do Val Advocacia Empresarial</p>
      </div>
    </div>
  )
}
