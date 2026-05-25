'use client'

import { useState } from 'react'

const SEGMENTOS = [
  'Indústria', 'Comércio', 'Serviços', 'Saúde', 'Educação',
  'Tecnologia', 'Construção Civil', 'Agronegócio', 'Outro',
]

const FAIXAS = [
  'Até 10', '11 a 50', '51 a 100', '101 a 500', 'Acima de 500',
]

const INPUT = 'w-full bg-white/6 border border-white/10 focus:border-[#C49557] focus:ring-2 focus:ring-[#C49557]/10 focus:outline-none text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm transition-colors'
const LABEL = 'block text-white/50 text-xs font-semibold tracking-widest uppercase mb-2'

export default function ContactForm() {
  const [form, setForm] = useState({
    nome: '', empresa: '', email: '', whatsapp: '',
    empregados: '', segmento: '', mensagem: '',
  })
  const [enviado, setEnviado] = useState(false)

  function handle(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-full bg-[#C49557]/10 border border-[#C49557]/30 flex items-center justify-center mx-auto mb-6">
          <svg viewBox="0 0 24 24" fill="none" stroke="#C49557" strokeWidth={2} className="w-7 h-7">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="text-white text-2xl font-semibold mb-3">Solicitação recebida</h3>
        <p className="text-white/50 text-base max-w-sm mx-auto leading-relaxed">
          Solicitação registrada nesta tela. Para atendimento imediato, fale pelo WhatsApp.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className={LABEL}>Nome *</label>
          <input
            name="nome" required value={form.nome} onChange={handle}
            placeholder="Seu nome completo" className={INPUT}
          />
        </div>
        <div>
          <label className={LABEL}>Empresa *</label>
          <input
            name="empresa" required value={form.empresa} onChange={handle}
            placeholder="Razão social ou nome fantasia" className={INPUT}
          />
        </div>
        <div>
          <label className={LABEL}>E-mail *</label>
          <input
            name="email" type="email" required value={form.email} onChange={handle}
            placeholder="seu@email.com.br" className={INPUT}
          />
        </div>
        <div>
          <label className={LABEL}>WhatsApp *</label>
          <input
            name="whatsapp" required value={form.whatsapp} onChange={handle}
            placeholder="(31) 9 9999-9999" className={INPUT}
          />
        </div>
        <div>
          <label className={LABEL}>Número de empregados *</label>
          <select
            name="empregados" required value={form.empregados} onChange={handle}
            className={INPUT + ' cursor-pointer'}
          >
            <option value="" disabled>Selecione a faixa</option>
            {FAIXAS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Segmento *</label>
          <select
            name="segmento" required value={form.segmento} onChange={handle}
            className={INPUT + ' cursor-pointer'}
          >
            <option value="" disabled>Selecione o segmento</option>
            {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={LABEL}>Mensagem</label>
        <textarea
          name="mensagem" value={form.mensagem} onChange={handle} rows={4}
          placeholder="Conte-nos brevemente sobre sua empresa e suas principais dúvidas sobre a NR-1..."
          className={INPUT + ' resize-none'}
        />
      </div>
      <button
        type="submit"
        className="w-full bg-[#C49557] hover:bg-[#A07840] text-[#111827] font-semibold py-4 rounded-xl text-base transition-colors"
      >
        Solicitar diagnóstico gratuito
      </button>
      <p className="text-white/25 text-xs text-center">
        A solicitação será recebida pela equipe do Pessoa e do Val Advocacia. Seus dados não serão compartilhados com terceiros.
      </p>
    </form>
  )
}
