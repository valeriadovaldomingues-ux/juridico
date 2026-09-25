'use client'

import { useState } from 'react'
import { X, Loader2, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import SearchableCombobox from '@/components/ui/SearchableCombobox'
import { fetchClienteOptions } from '@/lib/search/remote'

interface Props {
  tipo:     'procuracao' | 'hipossuficiencia'
  onFechar: () => void
}

const TITULO: Record<Props['tipo'], string> = {
  procuracao: 'Gerar Procuração',
  hipossuficiencia: 'Gerar Declaração de Hipossuficiência',
}

const ENDPOINT: Record<Props['tipo'], string> = {
  procuracao: '/api/documentos/procuracao',
  hipossuficiencia: '/api/documentos/hipossuficiencia',
}

const CAMPO_LABEL: Record<string, string> = {
  rg: 'RG', nacionalidade: 'Nacionalidade', estado_civil: 'Estado civil', profissao: 'Profissão', endereço: 'Endereço',
}

export default function PecaAutomaticaModal({ tipo, onFechar }: Props) {
  const [clienteId, setClienteId] = useState('')
  const [poderes,   setPoderes]   = useState('')
  const [camposFaltantes, setCamposFaltantes] = useState<string[] | null>(null)
  const [valoresExtras,   setValoresExtras]   = useState<Record<string, string>>({})
  const [gerando, setGerando] = useState(false)
  const [erro,    setErro]    = useState('')

  async function gerar() {
    if (!clienteId) return
    setGerando(true)
    setErro('')

    const params = new URLSearchParams({ cliente_id: clienteId })
    if (tipo === 'procuracao' && poderes.trim()) params.set('poderes', poderes.trim())
    for (const [campo, valor] of Object.entries(valoresExtras)) {
      if (valor.trim()) params.set(campo, valor.trim())
    }

    const res = await fetch(`${ENDPOINT[tipo]}?${params.toString()}`)

    if (res.status === 422) {
      const body = await res.json().catch(() => ({}))
      setCamposFaltantes((body.camposFaltantes ?? []).filter((c: string) => c !== 'endereço' && c !== 'endereco'))
      setErro(body.error ?? 'Faltam dados do cliente')
      setGerando(false)
      return
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setErro(body.error ?? 'Erro ao gerar documento')
      setGerando(false)
      return
    }

    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const cd   = res.headers.get('content-disposition') ?? ''
    const nomeArquivo = cd.match(/filename="(.+)"/)?.[1] ?? `${tipo}.pdf`
    a.href = url; a.download = nomeArquivo
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setGerando(false)
    onFechar()
  }

  const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#1D5F60] text-[#1a1d23] placeholder:text-[#c5cdd8] transition-all'
  const labelCls = 'block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6]">
          <h2 className="text-[15px] font-semibold text-[#0f1923]">{TITULO[tipo]}</h2>
          <button onClick={onFechar} className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Cliente</label>
            <SearchableCombobox
              value={clienteId}
              onChange={value => { setClienteId(value); setCamposFaltantes(null); setErro('') }}
              loadOptions={async (query) => fetchClienteOptions(query, 10)}
              placeholder="Buscar cliente…"
              searchPlaceholder="Buscar cliente por nome, CPF/CNPJ, telefone ou e-mail"
              helperText="Digite ao menos 2 caracteres."
              emptyText="Digite para buscar clientes."
              noResultsText="Nenhum resultado encontrado."
              allowClear
            />
          </div>

          {tipo === 'procuracao' && (
            <div>
              <label className={labelCls}>Poderes específicos (opcional)</label>
              <input
                value={poderes}
                onChange={e => setPoderes(e.target.value)}
                placeholder="Ex: depósito em juízo das chaves da residência locada..."
                className={inputCls}
              />
            </div>
          )}

          {camposFaltantes && camposFaltantes.length > 0 && (
            <div className="bg-[#fef8ec] border border-[#f5e6b8] rounded-xl p-3 space-y-3">
              <p className="text-[12px] text-[#8a6000]">
                O cadastro do cliente não tem: {camposFaltantes.map(c => CAMPO_LABEL[c] ?? c).join(', ')}. Preencha abaixo — fica salvo no cadastro pra próxima vez.
              </p>
              {camposFaltantes.map(campo => (
                <div key={campo}>
                  <label className={labelCls}>{CAMPO_LABEL[campo] ?? campo}</label>
                  <input
                    value={valoresExtras[campo] ?? ''}
                    onChange={e => setValoresExtras(prev => ({ ...prev, [campo]: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          )}

          {erro && !camposFaltantes?.length && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={onFechar} className="flex-1 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
              Cancelar
            </button>
            <button
              onClick={gerar}
              disabled={!clienteId || gerando}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50',
                'bg-[#1D5F60] hover:bg-[#27777A] text-white',
              )}
            >
              {gerando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {gerando ? 'Gerando…' : 'Gerar PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
