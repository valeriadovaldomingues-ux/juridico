'use client'

import { useState } from 'react'
import { MessageSquare, Phone, Mail, Users, StickyNote, Trash2, Plus } from 'lucide-react'
import {
  TIPOS_INTERACAO, TIPO_INTERACAO_LABEL, type TipoInteracao,
} from '@/lib/crm-socios/constants'
import { dataISOLocal } from '@/lib/crm-socios/regras'
import { formatarDataHora } from '@/lib/crm-socios/formato'
import { jsonInit, requisitar } from '@/lib/crm-socios/cliente-http'
import type { CrmInteracao } from '@/types/crm-socios'
import { BOTAO_PRIMARIO, INPUT_CLASSE, ROTULO_CLASSE } from './visual'

const ICONE: Record<TipoInteracao, React.ElementType> = {
  ligacao: Phone,
  reuniao: Users,
  whatsapp: MessageSquare,
  email: Mail,
  nota: StickyNote,
}

interface Props {
  oportunidadeId: string
  interacoes: CrmInteracao[]
  onMudou: (interacoes: CrmInteracao[], ultimoContatoEm: string | null) => void
}

function maisRecente(lista: CrmInteracao[]): string | null {
  return lista.reduce<string | null>((acc, i) => (!acc || i.data_interacao > acc ? i.data_interacao : acc), null)
}

/** Histórico cronológico (mais recente primeiro). Registrar uma interação atualiza o "último contato". */
export default function InteracoesPanel({ oportunidadeId, interacoes, onMudou }: Props) {
  const [tipo, setTipo] = useState<TipoInteracao>('ligacao')
  const [data, setData] = useState(() => dataISOLocal(new Date()))
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function registrar() {
    if (!descricao.trim()) { setErro('Descreva a interação.'); return }
    setSalvando(true); setErro(null)
    try {
      const json = await requisitar<{ interacao: CrmInteracao; ultimo_contato_em: string | null }>(
        `/api/crm-socios/oportunidades/${oportunidadeId}/interacoes`,
        jsonInit('POST', { tipo, descricao, data_interacao: data }),
      )
      const nova = json.interacao
      const lista = [nova, ...interacoes].sort((a, b) => (a.data_interacao < b.data_interacao ? 1 : -1))
      onMudou(lista, json.ultimo_contato_em ?? maisRecente(lista))
      setDescricao('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar.')
    } finally {
      setSalvando(false)
    }
  }

  async function apagar(id: string) {
    if (!window.confirm('Excluir esta interação do histórico?')) return
    setErro(null)
    try {
      const json = await requisitar<{ ultimo_contato_em: string | null }>(`/api/crm-socios/interacoes/${id}`, jsonInit('DELETE'))
      const lista = interacoes.filter(i => i.id !== id)
      onMudou(lista, json.ultimo_contato_em ?? maisRecente(lista))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="inter-tipo" className={ROTULO_CLASSE}>Tipo</label>
            <select id="inter-tipo" value={tipo} onChange={e => setTipo(e.target.value as TipoInteracao)} className={INPUT_CLASSE}>
              {TIPOS_INTERACAO.map(t => <option key={t} value={t}>{TIPO_INTERACAO_LABEL[t]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="inter-data" className={ROTULO_CLASSE}>Data</label>
            <input id="inter-data" type="date" value={data} onChange={e => setData(e.target.value)} className={INPUT_CLASSE} />
          </div>
        </div>
        <div>
          <label htmlFor="inter-desc" className={ROTULO_CLASSE}>O que aconteceu</label>
          <textarea id="inter-desc" rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Resumo da conversa, combinados, dúvidas…" className={INPUT_CLASSE} />
        </div>
        {erro && <p role="alert" className="text-[12px] text-red-600">{erro}</p>}
        <div className="flex justify-end">
          <button type="button" onClick={registrar} disabled={salvando} className={BOTAO_PRIMARIO}>
            <Plus size={14} />{salvando ? 'Registrando…' : 'Registrar interação'}
          </button>
        </div>
      </div>

      {interacoes.length === 0 ? (
        <p className="text-[13px] text-[var(--color-ink-3)] text-center py-6">Nenhuma interação registrada ainda.</p>
      ) : (
        <ol className="space-y-2">
          {interacoes.map(i => {
            const Icone = ICONE[i.tipo]
            return (
              <li key={i.id} className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-[var(--color-petrol-light)] text-[var(--color-petrol)] flex items-center justify-center flex-shrink-0">
                  <Icone size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-[var(--color-ink-3)]">
                    <strong className="text-[var(--color-ink-2)]">{TIPO_INTERACAO_LABEL[i.tipo]}</strong>
                    {' · '}{formatarDataHora(i.data_interacao)}
                    {i.autor?.nome ? ` · ${i.autor.nome}` : ''}
                  </p>
                  <p className="text-[13px] text-[var(--color-ink)] whitespace-pre-wrap break-words mt-0.5">{i.descricao}</p>
                </div>
                <button type="button" onClick={() => apagar(i.id)} aria-label="Excluir interação" className="p-1 h-fit rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
