'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export const TIPOS_DOCUMENTO = [
  { value: 'peticao_inicial',  label: 'Petição Inicial'           },
  { value: 'contestacao',      label: 'Contestação'               },
  { value: 'recurso',          label: 'Recurso'                   },
  { value: 'contrarrazoes',    label: 'Contrarrazões'             },
  { value: 'agravo',           label: 'Agravo'                    },
  { value: 'memoriais',        label: 'Memoriais'                 },
  { value: 'notificacao',      label: 'Notificação Extrajudicial' },
  { value: 'contrato',         label: 'Contrato'                  },
  { value: 'procuracao',       label: 'Procuração'                },
  { value: 'declaracao',       label: 'Declaração'                },
  { value: 'requerimento',     label: 'Requerimento'              },
  { value: 'outro',            label: 'Outro'                     },
]

export const AREAS_DIREITO = [
  { value: '',                label: '— Todas as áreas —'   },
  { value: 'civil',           label: 'Cível'                },
  { value: 'trabalhista',     label: 'Trabalhista'          },
  { value: 'criminal',        label: 'Criminal'             },
  { value: 'tributario',      label: 'Tributário'           },
  { value: 'previdenciario',  label: 'Previdenciário'       },
  { value: 'administrativo',  label: 'Administrativo'       },
  { value: 'familia',         label: 'Família'              },
  { value: 'empresarial',     label: 'Empresarial'          },
  { value: 'outro',           label: 'Outro'                },
]

const PLACEHOLDERS = [
  { key: '{{cliente_nome}}',         label: 'Nome do cliente'       },
  { key: '{{parte_contraria}}',      label: 'Parte contrária'       },
  { key: '{{numero_processo}}',      label: 'Número do processo'    },
  { key: '{{vara}}',                 label: 'Vara'                  },
  { key: '{{tribunal}}',             label: 'Tribunal'              },
  { key: '{{valor_causa}}',          label: 'Valor da causa'        },
  { key: '{{area_direito}}',         label: 'Área do direito'       },
  { key: '{{advogado_responsavel}}', label: 'Advogado responsável'  },
  { key: '{{data_atual}}',           label: 'Data atual'            },
]

interface DocModelo {
  id?:           string
  nome:          string
  area_direito:  string | null
  tipo_documento:string
  descricao:     string | null
  conteudo:      string
}

interface Props {
  modelo:   Partial<DocModelo> | null
  onSalvar: (data: DocModelo) => Promise<string | null>
  onFechar: () => void
}

const VAZIO: DocModelo = {
  nome:           '',
  area_direito:   null,
  tipo_documento: 'peticao_inicial',
  descricao:      null,
  conteudo:       '',
}

export default function ModeloModal({ modelo, onSalvar, onFechar }: Props) {
  const [form,    setForm]    = useState<DocModelo>(VAZIO)
  const [loading, setLoading] = useState(false)
  const [erro,    setErro]    = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isEdicao = !!modelo?.id

  useEffect(() => {
    if (modelo) {
      setForm({ ...VAZIO, ...modelo, area_direito: modelo.area_direito ?? null, descricao: modelo.descricao ?? null })
    } else {
      setForm(VAZIO)
    }
    setErro('')
  }, [modelo])

  function set<K extends keyof DocModelo>(k: K, v: DocModelo[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function inserirPlaceholder(ph: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const novo  = form.conteudo.slice(0, start) + ph + form.conteudo.slice(end)
    set('conteudo', novo)
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + ph.length
      el.focus()
    }, 0)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) { setErro('Informe o nome do modelo'); return }
    if (!form.conteudo.trim()) { setErro('O conteúdo do modelo não pode estar vazio'); return }
    setErro('')
    setLoading(true)
    const err = await onSalvar(form)
    setLoading(false)
    if (err) setErro(err)
  }

  const inputCls = 'w-full px-3 py-2 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#145A5B] text-[#1a1d23] placeholder:text-[#c5cdd8] transition-all'
  const labelCls = 'block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6] shrink-0">
          <h2 className="text-[15px] font-semibold text-[#0f1923]">
            {isEdicao ? 'Editar Modelo' : 'Novo Modelo de Documento'}
          </h2>
          <button onClick={onFechar} className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {/* Nome + Tipo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Nome do modelo <span className="text-red-500 normal-case font-normal">*</span></label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => set('nome', e.target.value)}
                  placeholder="Ex: Petição Inicial Trabalhista"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Tipo de documento</label>
                <select value={form.tipo_documento} onChange={e => set('tipo_documento', e.target.value)} className={inputCls}>
                  {TIPOS_DOCUMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Área + Descrição */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Área do direito</label>
                <select value={form.area_direito ?? ''} onChange={e => set('area_direito', e.target.value || null)} className={inputCls}>
                  {AREAS_DIREITO.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Descrição curta</label>
                <input
                  type="text"
                  value={form.descricao ?? ''}
                  onChange={e => set('descricao', e.target.value || null)}
                  placeholder="Descreva quando usar este modelo"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Placeholders helper */}
            <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <HelpCircle size={12} className="text-[#9ca3af]" />
                <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">
                  Inserir placeholder (clique para adicionar no cursor)
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => inserirPlaceholder(p.key)}
                    title={p.label}
                    className="text-[11px] px-2 py-1 rounded-lg bg-white border border-[#e5e7eb] text-[#145A5B] font-mono hover:border-[#145A5B] hover:bg-[#E8F0F0] transition-all"
                  >
                    {p.key}
                  </button>
                ))}
              </div>
            </div>

            {/* Conteúdo */}
            <div>
              <label className={labelCls}>
                Conteúdo do modelo <span className="text-red-500 normal-case font-normal">*</span>
              </label>
              <textarea
                ref={textareaRef}
                value={form.conteudo}
                onChange={e => set('conteudo', e.target.value)}
                placeholder={`EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA {{vara}}\n\n{{cliente_nome}}, qualificado(a) nos autos, vem respeitosamente à presença de Vossa Excelência...`}
                rows={16}
                className={cn(inputCls, 'resize-none font-mono text-[12px] leading-relaxed')}
              />
            </div>

            {erro && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-[#f3f4f6] shrink-0">
            <button type="button" onClick={onFechar}
              className="flex-1 py-2.5 text-[13px] font-medium text-[#6b7280] border border-[#e5e7eb] rounded-xl hover:bg-[#f9fafb] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold bg-[#0F3D3E] hover:bg-[#145A5B] text-white rounded-xl transition-colors disabled:opacity-50">
              {loading && <Loader2 size={13} className="animate-spin" />}
              {loading ? 'Salvando…' : isEdicao ? 'Salvar alterações' : 'Criar modelo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
