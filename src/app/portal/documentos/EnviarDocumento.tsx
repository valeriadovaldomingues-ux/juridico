'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EXTENSOES_ACEITAS, TAMANHO_MAXIMO_BYTES, extensaoDe } from '@/lib/portal-cliente/envios-constantes'

interface Processo { id: string; rotulo: string }
type Msg = { tipo: 'ok' | 'erro'; texto: string }

export default function EnviarDocumento({ processos, somenteLeitura }: { processos: Processo[]; somenteLeitura: boolean }) {
  const router = useRouter()
  const entrada = useRef<HTMLInputElement>(null)
  const [processoId, setProcessoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<Msg | null>(null)

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length || somenteLeitura) return
    setEnviando(true)
    setMsg(null)
    const enviados: string[] = []
    try {
      for (const arquivo of Array.from(arquivos)) {
        if (!EXTENSOES_ACEITAS.includes(extensaoDe(arquivo.name))) throw new Error(`"${arquivo.name}": tipo não aceito. Envie PDF, foto, Word, Excel, TXT ou CSV.`)
        if (arquivo.size > TAMANHO_MAXIMO_BYTES) throw new Error(`"${arquivo.name}" passa de 25 MB.`)
        const pedido = await fetch('/api/portal/envios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: arquivo.name, tamanho: arquivo.size, processo_id: processoId || undefined, descricao: descricao || undefined }),
        })
        const dados = await pedido.json().catch(() => ({}))
        if (!pedido.ok) throw new Error(dados.error ?? `Não foi possível enviar "${arquivo.name}".`)
        const { error } = await createClient().storage.from(dados.bucket).uploadToSignedUrl(dados.caminho, dados.token, arquivo, { contentType: dados.contentType })
        if (error) throw new Error(`Não foi possível enviar "${arquivo.name}". Tente de novo.`)
        const fim = await fetch(`/api/portal/envios/${dados.id}/confirmar`, { method: 'POST' })
        const fimDados = await fim.json().catch(() => ({}))
        if (!fim.ok) throw new Error(fimDados.error ?? `Não foi possível concluir o envio de "${arquivo.name}".`)
        enviados.push(arquivo.name)
      }
      setDescricao('')
      setMsg({ tipo: 'ok', texto: enviados.length === 1 ? 'Documento enviado ao escritório.' : `${enviados.length} documentos enviados ao escritório.` })
      router.refresh()
    } catch (e) {
      const concluidos = enviados.length ? ` (${enviados.length} já enviado${enviados.length > 1 ? 's' : ''}.)` : ''
      setMsg({ tipo: 'erro', texto: `${e instanceof Error ? e.message : 'Não foi possível enviar.'}${concluidos}` })
      if (enviados.length) router.refresh()
    } finally {
      setEnviando(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  return (
    <div className="bg-white border border-[#E8E3D8] p-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[11px] text-[#6B7280] tracking-wide">
          Sobre qual processo? <span className="text-[#9CA3AF]">(opcional)</span>
          <select value={processoId} onChange={e => setProcessoId(e.target.value)} disabled={somenteLeitura || enviando} className="mt-1 w-full border border-[#E8E3D8] bg-white px-3 py-2 text-[13px] text-[#1C1C2E]">
            <option value="">Não é sobre um processo específico</option>
            {processos.map(p => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
          </select>
        </label>
        <label className="block text-[11px] text-[#6B7280] tracking-wide">
          Recado para o escritório <span className="text-[#9CA3AF]">(opcional)</span>
          <input value={descricao} maxLength={300} onChange={e => setDescricao(e.target.value)} disabled={somenteLeitura || enviando} placeholder="Ex.: comprovante de endereço atualizado" className="mt-1 w-full border border-[#E8E3D8] px-3 py-2 text-[13px] text-[#1C1C2E]" />
        </label>
      </div>

      <input ref={entrada} type="file" multiple accept={EXTENSOES_ACEITAS.map(e => `.${e}`).join(',')} className="hidden" id="portal-arquivos" onChange={e => enviar(e.target.files)} disabled={somenteLeitura || enviando} />
      <button type="button" onClick={() => entrada.current?.click()} disabled={somenteLeitura || enviando} className="inline-flex items-center gap-2 bg-[#0C1B2A] text-white px-4 py-2.5 text-[11px] tracking-[0.1em] uppercase font-medium hover:bg-[#13304a] disabled:opacity-50">
        {enviando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {enviando ? 'Enviando…' : 'Escolher arquivos para enviar'}
      </button>
      <p className="text-[11px] text-[#9CA3AF]">PDF, foto (JPG, PNG, HEIC), Word, Excel, TXT ou CSV. Até 25 MB por arquivo. Os arquivos chegam direto à equipe do escritório.</p>
      {somenteLeitura && <p className="text-[12px] text-amber-700">Visualização do escritório: o envio fica desativado.</p>}
      {msg && <p role="status" className={`text-[12px] ${msg.tipo === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.texto}</p>}
    </div>
  )
}
