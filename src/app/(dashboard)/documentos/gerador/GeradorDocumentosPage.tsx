'use client'

import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Mic,
  Paperclip,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react'
import {
  DADOS_DOCUMENTO_VAZIO,
  TIPOS_DOCUMENTO_GERADOR,
  extensaoArquivoPermitida,
  tituloTipoDocumento,
  type DadosDocumento,
  type TipoDocumentoGerador,
} from '@/lib/documentos/schema'
import { cn } from '@/lib/utils'

type SpeechRecognitionCtor = new () => {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
}

const PODERES_ESPECIAIS = [
  'Receber citação',
  'Confessar',
  'Reconhecer procedência do pedido',
  'Transigir',
  'Desistir',
  'Renunciar ao direito',
  'Receber e dar quitação',
  'Firmar compromisso',
  'Assinar declaração de hipossuficiência',
]

function dadosIniciais(tipo: TipoDocumentoGerador): DadosDocumento {
  return { ...DADOS_DOCUMENTO_VAZIO, tipoDocumento: tipo }
}

function CardRevisao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#E2DDD8] bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#B8864B]">{titulo}</p>
      <div className="mt-2 text-[13px] leading-relaxed text-[#1B2A4E]">{children}</div>
    </div>
  )
}

export default function GeradorDocumentosPage() {
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoDocumentoGerador>('contrato_partido')
  const [relato, setRelato] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [dados, setDados] = useState<DadosDocumento | null>(null)
  const [confirmou, setConfirmou] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; texto: string } | null>(null)
  const [extraindo, setExtraindo] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null)

  const tipoAtual = useMemo(
    () => TIPOS_DOCUMENTO_GERADOR.find(tipo => tipo.id === tipoSelecionado)!,
    [tipoSelecionado],
  )

  function selecionarTipo(tipo: TipoDocumentoGerador) {
    setTipoSelecionado(tipo)
    setDados(dadosIniciais(tipo))
    setConfirmou(false)
    setStatus(null)
  }

  function adicionarArquivos(files: FileList | null) {
    if (!files) return
    const novos = Array.from(files)
    const permitidos = novos.filter(file => extensaoArquivoPermitida(file.name, file.type))
    if (permitidos.length !== novos.length) {
      setStatus({ ok: false, texto: 'Apenas PDF, JPG e PNG são aceitos.' })
    }
    const combinados = [...arquivos, ...permitidos].slice(0, 8)
    if (arquivos.length + permitidos.length > 8) {
      setStatus({ ok: false, texto: 'Limite de 8 arquivos por extração.' })
    }
    setArquivos(combinados)
  }

  function falar() {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setStatus({ ok: false, texto: 'Entrada por voz não está disponível neste navegador. Use o campo de texto.' })
      return
    }

    if (ouvindo) {
      recognitionRef.current?.stop()
      setOuvindo(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = event => {
      const texto = Array.from(event.results)
        .map(result => result[0]?.transcript ?? '')
        .join(' ')
        .trim()
      if (texto) setRelato(prev => `${prev}${prev ? ' ' : ''}${texto}`)
    }
    recognition.onend = () => setOuvindo(false)
    recognitionRef.current = recognition
    setOuvindo(true)
    recognition.start()
  }

  async function extrair() {
    setExtraindo(true)
    setConfirmou(false)
    setStatus(null)
    const form = new FormData()
    form.set('tipoDocumento', tipoSelecionado)
    form.set('relato', relato)
    arquivos.forEach(file => form.append('arquivos', file))

    try {
      const res = await fetch('/api/documentos/extrair-dados', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        setStatus({ ok: false, texto: json.error ?? 'Erro ao extrair dados.' })
        return
      }
      setDados(json.dados)
      setStatus({ ok: true, texto: 'Dados extraídos para conferência. Revise antes de gerar.' })
    } catch {
      setStatus({ ok: false, texto: 'Erro de conexão ao extrair dados.' })
    } finally {
      setExtraindo(false)
    }
  }

  async function gerar() {
    if (!dados || !confirmou) return
    setGerando(true)
    setStatus(null)
    try {
      const res = await fetch('/api/documentos/gerar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dados, confirmouRevisao: confirmou }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setStatus({ ok: false, texto: json.error ?? 'Erro ao gerar documento.' })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${tituloTipoDocumento(dados.tipoDocumento).toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.docx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setStatus({ ok: true, texto: 'DOCX gerado para revisão final.' })
    } catch {
      setStatus({ ok: false, texto: 'Erro de conexão ao gerar documento.' })
    } finally {
      setGerando(false)
    }
  }

  function update<K extends keyof DadosDocumento>(key: K, value: DadosDocumento[K]) {
    setDados(prev => prev ? { ...prev, [key]: value } : prev)
    setConfirmou(false)
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div className="rounded-lg border border-[#E2DDD8] bg-[#F7F4EF] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B8864B]">Pessoa e do Val Advocacia</p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-[#1B2A4E]">Gerador inteligente de documentos</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[#6E7685]">
              Extraia dados de relatos e anexos, revise as informações e gere uma minuta DOCX com papel institucional. A geração final exige conferência humana.
            </p>
          </div>
          <div className="rounded-lg border border-[#D8C4AA] bg-white px-4 py-3 text-[12px] text-[#1B2A4E]">
            <span className="font-semibold text-[#B8864B]">Regra:</span> nenhum documento é gerado sem revisão e confirmação.
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {TIPOS_DOCUMENTO_GERADOR.map(tipo => {
          const ativo = tipo.id === tipoSelecionado
          return (
            <button
              key={tipo.id}
              onClick={() => selecionarTipo(tipo.id)}
              className={cn(
                'rounded-lg border p-4 text-left shadow-sm transition-all',
                ativo
                  ? 'border-[#B8864B] bg-[#1B2A4E] text-white'
                  : 'border-[#E2DDD8] bg-white text-[#1B2A4E] hover:border-[#B8864B]/70 hover:shadow-md',
              )}
            >
              <FileText size={20} className={ativo ? 'text-[#D8B16E]' : 'text-[#B8864B]'} />
              <p className="mt-3 text-[14px] font-semibold leading-snug">{tipo.titulo}</p>
              <p className={cn('mt-2 text-[12px] leading-relaxed', ativo ? 'text-white/70' : 'text-[#7a8899]')}>{tipo.descricao}</p>
            </button>
          )
        })}
      </div>

      {status && (
        <div className={cn(
          'flex items-center gap-2 rounded-lg border px-4 py-3 text-[13px] font-medium',
          status.ok ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700',
        )}>
          {status.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {status.texto}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <div className="space-y-5">
          <section className="rounded-lg border border-[#E2DDD8] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#B8864B]" />
              <h2 className="text-[16px] font-semibold text-[#1B2A4E]">Assistente com IA</h2>
            </div>
            <p className="mt-1 text-[12px] text-[#7a8899]">Documento selecionado: {tipoAtual.titulo}</p>

            <label className="mt-4 block text-[12px] font-semibold text-[#1B2A4E]">Relato / texto livre</label>
            <textarea
              value={relato}
              onChange={e => setRelato(e.target.value)}
              placeholder="Descreva o caso, dados do cliente, honorários, processo, parte contrária e demais informações disponíveis."
              className="mt-2 h-44 w-full resize-none rounded-lg border border-[#E2DDD8] bg-[#FAF9F7] p-3 text-[13px] leading-relaxed text-[#1B2A4E] outline-none focus:border-[#B8864B] focus:bg-white"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={falar}
                type="button"
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors',
                  ouvindo ? 'border-red-200 bg-red-50 text-red-700' : 'border-[#D8C4AA] bg-white text-[#1B2A4E] hover:bg-[#F7F4EF]',
                )}
              >
                <Mic size={14} /> {ouvindo ? 'Parar' : 'Falar'}
              </button>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#D8C4AA] bg-white px-3 py-2 text-[12px] font-semibold text-[#1B2A4E] hover:bg-[#F7F4EF]">
                <Upload size={14} /> Upload de anexos
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={e => adicionarArquivos(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>

            {arquivos.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {arquivos.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg bg-[#F7F4EF] px-3 py-2 text-[12px] text-[#1B2A4E]">
                    <span className="flex min-w-0 items-center gap-2 truncate"><Paperclip size={12} className="text-[#B8864B]" /> {file.name}</span>
                    <button onClick={() => setArquivos(prev => prev.filter((_, i) => i !== index))} className="text-[#7a8899] hover:text-red-600">remover</button>
                  </div>
                ))}
                <p className="text-[11px] text-[#9aabb8]">PDF e imagens escaneadas podem exigir OCR em fase posterior.</p>
              </div>
            )}

            <button
              onClick={extrair}
              disabled={extraindo || (!relato.trim() && arquivos.length === 0)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B2A4E] px-4 py-3 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#25365F] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Wand2 size={15} /> {extraindo ? 'Extraindo...' : 'Extrair e preencher'}
            </button>
          </section>

          <section className="rounded-lg border border-[#E2DDD8] bg-[#F7F4EF] p-5">
            <p className="text-[13px] font-semibold text-[#1B2A4E]">Limites desta fase</p>
            <p className="mt-2 text-[12px] leading-relaxed text-[#6E7685]">
              A IA organiza dados fornecidos, mas não substitui revisão jurídica. Imagens e PDFs escaneados ficam sinalizados para OCR posterior.
            </p>
          </section>
        </div>

        <section className="rounded-lg border border-[#E2DDD8] bg-[#FAF9F7] p-5 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#E2DDD8] pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-[18px] font-semibold text-[#1B2A4E]">Dados extraídos para conferência</h2>
              <p className="text-[12px] text-[#7a8899]">Edite qualquer campo antes de autorizar a geração.</p>
            </div>
            <span className="rounded-full border border-[#D8C4AA] bg-white px-3 py-1 text-[11px] font-semibold text-[#B8864B]">
              Confiança: {Math.round((dados?.confianca ?? 0) * 100)}%
            </span>
          </div>

          {!dados ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <FileText size={34} className="text-[#D8C4AA]" />
              <p className="mt-3 text-[14px] font-semibold text-[#1B2A4E]">Nenhum dado extraído ainda</p>
              <p className="mt-1 max-w-sm text-[12px] text-[#7a8899]">Use o assistente para preencher a revisão ou selecione um modelo e informe os dados manualmente.</p>
              <button
                onClick={() => setDados(dadosIniciais(tipoSelecionado))}
                className="mt-4 rounded-lg border border-[#D8C4AA] bg-white px-4 py-2 text-[12px] font-semibold text-[#1B2A4E] hover:bg-[#F7F4EF]"
              >
                Preencher manualmente
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <CardRevisao titulo="Cliente">
                  <input className="w-full bg-transparent font-semibold outline-none" value={dados.nomeRazaoSocial} onChange={e => update('nomeRazaoSocial', e.target.value)} placeholder="Nome ou razão social" />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input className="rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.clienteTipo} onChange={e => update('clienteTipo', e.target.value as DadosDocumento['clienteTipo'])} placeholder="PF/PJ" />
                    <input className="rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.cpfCnpj} onChange={e => update('cpfCnpj', e.target.value)} placeholder="CPF/CNPJ" />
                  </div>
                  <input className="mt-2 w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.endereco} onChange={e => update('endereco', e.target.value)} placeholder="Endereço" />
                </CardRevisao>

                <CardRevisao titulo="Empresa/Representante">
                  <input className="w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.representanteLegal} onChange={e => update('representanteLegal', e.target.value)} placeholder="Representante legal" />
                  <input className="mt-2 w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.cnpjBoletos} onChange={e => update('cnpjBoletos', e.target.value)} placeholder="CNPJ para emissão dos boletos" />
                  <select
                    className="mt-2 w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none"
                    value={dados.parcelaAdicionalDezembro === true ? 'sim' : dados.parcelaAdicionalDezembro === false ? 'nao' : ''}
                    onChange={e => update('parcelaAdicionalDezembro', e.target.value === 'sim' ? true : e.target.value === 'nao' ? false : null)}
                  >
                    <option value="">Parcela adicional anual em dezembro</option>
                    <option value="sim">Sim — parcela extra equivalente aos honorários mensais.</option>
                    <option value="nao">Não</option>
                  </select>
                </CardRevisao>

                <CardRevisao titulo="Processo">
                  <input className="w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.processo} onChange={e => update('processo', e.target.value)} placeholder="Número do processo" />
                  <input className="mt-2 w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.tipoPeticao} onChange={e => update('tipoPeticao', e.target.value)} placeholder="Tipo de petição" />
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <input className="rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.vara} onChange={e => update('vara', e.target.value)} placeholder="Vara" />
                    <input className="rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.comarca} onChange={e => update('comarca', e.target.value)} placeholder="Comarca" />
                    <input className="rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.uf} onChange={e => update('uf', e.target.value.toUpperCase().slice(0, 2))} placeholder="UF" />
                  </div>
                  <textarea className="mt-2 h-20 w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.fatosResumidos} onChange={e => update('fatosResumidos', e.target.value)} placeholder="Fatos resumidos" />
                </CardRevisao>

                <CardRevisao titulo="Parte contrária">
                  <input className="w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.parteContraria} onChange={e => update('parteContraria', e.target.value)} placeholder="Parte contrária" />
                  <textarea className="mt-2 h-20 w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.objeto} onChange={e => update('objeto', e.target.value)} placeholder="Objeto / objetivo" />
                  <textarea className="mt-2 h-20 w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.direito} onChange={e => update('direito', e.target.value)} placeholder="Fundamentos jurídicos / direito" />
                  <textarea className="mt-2 h-20 w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.pedidos} onChange={e => update('pedidos', e.target.value)} placeholder="Pedidos" />
                </CardRevisao>

                <CardRevisao titulo="Honorários">
                  <input className="w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.honorarios} onChange={e => update('honorarios', e.target.value)} placeholder="Honorários" />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input className="rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.vencimento} onChange={e => update('vencimento', e.target.value)} placeholder="Vencimento" />
                    <input className="rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.primeiraParcela} onChange={e => update('primeiraParcela', e.target.value)} placeholder="Primeira parcela" />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input className="rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.percentualExito} onChange={e => update('percentualExito', e.target.value)} placeholder="Percentual de êxito" />
                    <input className="rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.foro} onChange={e => update('foro', e.target.value)} placeholder="Foro" />
                  </div>
                  <input className="mt-2 w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.valorCausa} onChange={e => update('valorCausa', e.target.value)} placeholder="Valor da causa" />
                </CardRevisao>

                <CardRevisao titulo="Áreas excluídas">
                  <textarea className="h-24 w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.areasExcluidas} onChange={e => update('areasExcluidas', e.target.value)} placeholder="Áreas excluídas" />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input className="rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.vigenciaInicio} onChange={e => update('vigenciaInicio', e.target.value)} placeholder="Vigência início" />
                    <input className="rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.vigenciaFim} onChange={e => update('vigenciaFim', e.target.value)} placeholder="Vigência fim" />
                  </div>
                </CardRevisao>
              </div>

              {dados.tipoDocumento === 'procuracao' && (
                <CardRevisao titulo="Poderes da procuração">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PODERES_ESPECIAIS.map(poder => (
                      <label key={poder} className="flex items-center gap-2 rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px]">
                        <input
                          type="checkbox"
                          checked={dados.poderesProcuracao.includes(poder)}
                          onChange={e => {
                            const next = e.target.checked
                              ? [...dados.poderesProcuracao, poder]
                              : dados.poderesProcuracao.filter(item => item !== poder)
                            update('poderesProcuracao', next)
                          }}
                        />
                        {poder}
                      </label>
                    ))}
                  </div>
                </CardRevisao>
              )}

              {dados.tipoDocumento === 'hipossuficiencia' && (
                <CardRevisao titulo="Finalidade da hipossuficiência">
                  <textarea className="h-20 w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.finalidadeHipossuficiencia} onChange={e => update('finalidadeHipossuficiencia', e.target.value)} placeholder="Finalidade" />
                </CardRevisao>
              )}

              {dados.tipoDocumento === 'peticao_comum' && (
                <CardRevisao titulo="Opções da petição">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px]">
                      <input type="checkbox" checked={dados.urgencia} onChange={e => update('urgencia', e.target.checked)} />
                      Inserir destaque “URGENTE”
                    </label>
                    <label className="flex items-center gap-2 rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px]">
                      <input type="checkbox" checked={dados.gratuidadeJustica} onChange={e => update('gratuidadeJustica', e.target.checked)} />
                      Incluir “DA GRATUIDADE DA JUSTIÇA”
                    </label>
                  </div>
                  <input className="mt-2 w-full rounded border border-[#E2DDD8] bg-white px-2 py-1.5 text-[12px] outline-none" value={dados.localData} onChange={e => update('localData', e.target.value)} placeholder="Local e data. Ex.: Belo Horizonte, 18 de maio de 2026." />
                </CardRevisao>
              )}

              <div className="grid gap-4 xl:grid-cols-2">
                <CardRevisao titulo="Campos ausentes">
                  {dados.camposAusentes.length ? (
                    <ul className="list-disc space-y-1 pl-4 text-[#9A5B2F]">
                      {dados.camposAusentes.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  ) : <p className="text-emerald-700">Nenhum campo obrigatório ausente detectado.</p>}
                </CardRevisao>
                <CardRevisao titulo="Alertas">
                  {dados.alertas.length ? (
                    <ul className="list-disc space-y-1 pl-4 text-[#9A5B2F]">
                      {dados.alertas.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  ) : <p className="text-[#7a8899]">Sem alertas adicionais.</p>}
                </CardRevisao>
              </div>

              <div className="rounded-lg border border-[#D8C4AA] bg-white p-4">
                <label className="flex items-start gap-3 text-[13px] font-medium text-[#1B2A4E]">
                  <input type="checkbox" checked={confirmou} onChange={e => setConfirmou(e.target.checked)} className="mt-0.5" />
                  Confirmo que revisei os dados extraídos e autorizo a geração do documento.
                </label>
                <button
                  onClick={gerar}
                  disabled={!confirmou || gerando}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#B8864B] px-4 py-3 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#9A6F3F] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileText size={15} /> {gerando ? 'Gerando...' : 'Gerar e baixar DOCX'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
