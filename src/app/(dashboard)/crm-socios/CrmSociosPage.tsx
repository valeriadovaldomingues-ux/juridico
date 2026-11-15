'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, Clock, Plus, Search, X } from 'lucide-react'
import {
  CRM_SOCIOS_DIAS_PARADA, ETAPAS, ETAPA_PERDIDO, STATUS_OPORTUNIDADE, STATUS_OPORTUNIDADE_LABEL,
  type EtapaId, type StatusOportunidade,
} from '@/lib/crm-socios/constants'
import {
  filtrarOportunidades, resumoFunil, statusDaEtapa, type FiltrosOportunidades,
} from '@/lib/crm-socios/regras'
import { formatarBRL } from '@/lib/crm-socios/formato'
import { jsonInit, requisitar } from '@/lib/crm-socios/cliente-http'
import type { CrmOportunidade, CrmPerfilSocio } from '@/types/crm-socios'
import OportunidadesBoard from './OportunidadesBoard'
import ListaOportunidades from './ListaOportunidades'
import ProximasAcoes from './ProximasAcoes'
import MotivoPerdaDialog from './MotivoPerdaDialog'
import OportunidadeModal from './OportunidadeModal'
import { BOTAO_PRIMARIO } from './visual'

interface Props {
  oportunidadesIniciais: CrmOportunidade[]
  perfis: CrmPerfilSocio[]
  usuarioAtualId: string
}

type Aba = 'quadro' | 'lista'

const SELECT_CLASSE =
  'border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs bg-white text-[var(--color-ink-2)] focus:outline-none focus:border-[var(--color-copper)]'

export default function CrmSociosPage({ oportunidadesIniciais, perfis, usuarioAtualId }: Props) {
  const [ops, setOps] = useState<CrmOportunidade[]>(oportunidadesIniciais)
  const [aba, setAba] = useState<Aba>('quadro')
  const [filtros, setFiltros] = useState<FiltrosOportunidades>({ busca: '', etapa: '', responsavelId: '', status: '', alerta: '' })
  // undefined = modal fechado · null = nova oportunidade · objeto = editando
  const [modal, setModal] = useState<CrmOportunidade | null | undefined>(undefined)
  const [perdendo, setPerdendo] = useState<CrmOportunidade | null>(null)
  const [salvandoPerda, setSalvandoPerda] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [hoje] = useState(() => new Date())

  const resumo = useMemo(() => resumoFunil(ops, hoje), [ops, hoje])
  const visiveis = useMemo(() => filtrarOportunidades(ops, filtros, hoje), [ops, filtros, hoje])
  const temFiltro = !!(filtros.busca || filtros.etapa || filtros.responsavelId || filtros.status || filtros.alerta)

  function mesclar(atualizada: CrmOportunidade) {
    setOps(prev => {
      const existe = prev.some(o => o.id === atualizada.id)
      if (!existe) return [atualizada, ...prev]
      // Mantém os joins que a resposta não trouxer (ex.: lista não carrega interações/propostas).
      return prev.map(o => (o.id === atualizada.id ? { ...o, ...atualizada } : o))
    })
  }

  function patchOportunidade(id: string, corpo: Record<string, unknown>) {
    return requisitar<CrmOportunidade>(`/api/crm-socios/oportunidades/${id}`, jsonInit('PATCH', corpo))
  }

  async function mover(op: CrmOportunidade, etapa: EtapaId) {
    setErro(null)
    if (etapa === ETAPA_PERDIDO) {
      setPerdendo(op)
      return
    }
    // Otimista: o cartão muda de coluna já; se a API recusar, volta.
    const antes = op
    mesclar({ ...op, etapa, status: statusDaEtapa(etapa), motivo_perda: null })
    try {
      mesclar(await patchOportunidade(op.id, { etapa }))
    } catch (e) {
      mesclar(antes)
      setErro(e instanceof Error ? e.message : 'Não foi possível mover a oportunidade.')
    }
  }

  async function confirmarPerda(motivo: string) {
    if (!perdendo) return
    setSalvandoPerda(true)
    try {
      mesclar(await patchOportunidade(perdendo.id, { etapa: ETAPA_PERDIDO, motivo_perda: motivo }))
      setPerdendo(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível marcar como perdida.')
      setPerdendo(null)
    } finally {
      setSalvandoPerda(false)
    }
  }

  function atalhoAlerta(alerta: 'paradas' | 'vencidas') {
    setAba('lista')
    setFiltros({ busca: '', etapa: '', responsavelId: '', status: 'aberto', alerta })
  }

  const cartoes: Array<{ rotulo: string; valor: string; sub: string; cor: string; onClick?: () => void }> = [
    { rotulo: 'Em aberto', valor: String(resumo.abertas), sub: formatarBRL(resumo.valorEmAberto, true), cor: '#12324A' },
    { rotulo: 'Paradas', valor: String(resumo.paradas), sub: `sem interação há ${CRM_SOCIOS_DIAS_PARADA}+ dias`, cor: resumo.paradas ? '#b45309' : '#7E8896', onClick: resumo.paradas ? () => atalhoAlerta('paradas') : undefined },
    { rotulo: 'Ações vencidas', valor: String(resumo.acoesVencidas), sub: 'próxima ação atrasada', cor: resumo.acoesVencidas ? '#dc2626' : '#7E8896', onClick: resumo.acoesVencidas ? () => atalhoAlerta('vencidas') : undefined },
    { rotulo: 'Ganhas', valor: String(resumo.ganhas), sub: formatarBRL(resumo.valorGanho, true), cor: '#059669' },
    { rotulo: 'Perdidas', valor: String(resumo.perdidas), sub: 'no total', cor: '#7E8896' },
  ]

  return (
    <div className="flex flex-col gap-5 max-w-[1500px]">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-brand text-[30px] font-semibold text-[var(--color-ink)] leading-none">CRM Cris e Val</h1>
          <p className="text-[12px] text-[var(--color-ink-3)] mt-1.5">Oportunidades e propostas de honorários · visível só para os sócios</p>
        </div>
        <button type="button" onClick={() => setModal(null)} className={BOTAO_PRIMARIO}>
          <Plus size={15} />Nova oportunidade
        </button>
      </div>

      {erro && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
          <span>{erro}</span>
          <button type="button" onClick={() => setErro(null)} aria-label="Fechar aviso" className="text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      <ProximasAcoes oportunidades={ops} hoje={hoje} onAbrir={setModal} />

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {cartoes.map(c => {
          const conteudo = (
            <>
              <p className="text-[10px] font-semibold text-[var(--color-ink-3)] uppercase tracking-wider">{c.rotulo}</p>
              <p className="text-[22px] font-bold leading-tight mt-1" style={{ color: c.cor }}>{c.valor}</p>
              <p className="text-[11px] text-[var(--color-ink-3)] mt-0.5 truncate">{c.sub}</p>
            </>
          )
          const classe = 'text-left rounded-xl border border-[var(--color-border)] bg-white px-4 py-3'
          return c.onClick ? (
            <button key={c.rotulo} type="button" onClick={c.onClick} className={`${classe} hover:bg-[var(--color-surface-warm)] transition-colors`}>{conteudo}</button>
          ) : (
            <div key={c.rotulo} className={classe}>{conteudo}</div>
          )
        })}
      </div>

      {/* Abas + filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1" role="tablist">
          {([['quadro', 'Quadro'], ['lista', 'Lista']] as Array<[Aba, string]>).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={aba === id}
              onClick={() => setAba(id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${aba === id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={filtros.busca ?? ''}
            onChange={e => setFiltros(f => ({ ...f, busca: e.target.value }))}
            placeholder="Buscar nome, contato, origem…"
            aria-label="Buscar oportunidades"
            className="pl-8 pr-3 py-2 border border-[var(--color-border)] rounded-xl text-xs focus:outline-none focus:border-[var(--color-copper)] w-56 bg-white"
          />
        </div>

        <select value={filtros.responsavelId ?? ''} onChange={e => setFiltros(f => ({ ...f, responsavelId: e.target.value }))} aria-label="Filtrar por responsável" className={SELECT_CLASSE}>
          <option value="">Todos os responsáveis</option>
          {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>

        {aba === 'lista' && (
          <>
            <select value={filtros.etapa ?? ''} onChange={e => setFiltros(f => ({ ...f, etapa: e.target.value as EtapaId | '' }))} aria-label="Filtrar por etapa" className={SELECT_CLASSE}>
              <option value="">Todas as etapas</option>
              {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
            <select value={filtros.status ?? ''} onChange={e => setFiltros(f => ({ ...f, status: e.target.value as StatusOportunidade | '' }))} aria-label="Filtrar por status" className={SELECT_CLASSE}>
              <option value="">Todos os status</option>
              {STATUS_OPORTUNIDADE.map(s => <option key={s} value={s}>{STATUS_OPORTUNIDADE_LABEL[s]}</option>)}
            </select>
            <select value={filtros.alerta ?? ''} onChange={e => setFiltros(f => ({ ...f, alerta: e.target.value as 'paradas' | 'vencidas' | '' }))} aria-label="Filtrar por alerta" className={SELECT_CLASSE}>
              <option value="">Sem filtro de alerta</option>
              <option value="paradas">Só paradas</option>
              <option value="vencidas">Só com ação vencida</option>
            </select>
          </>
        )}

        {temFiltro && (
          <button type="button" onClick={() => setFiltros({ busca: '', etapa: '', responsavelId: '', status: '', alerta: '' })} className="text-xs text-zinc-500 hover:text-zinc-700 underline">
            Limpar
          </button>
        )}
        <span className="ml-auto text-xs text-[var(--color-ink-3)] flex items-center gap-2">
          {resumo.paradas > 0 && <span className="inline-flex items-center gap-1 text-amber-700"><Clock size={11} />{resumo.paradas}</span>}
          {resumo.acoesVencidas > 0 && <span className="inline-flex items-center gap-1 text-red-600"><AlertCircle size={11} />{resumo.acoesVencidas}</span>}
          {visiveis.length} de {ops.length}
        </span>
      </div>

      {ops.length === 0 && (
        <p className="rounded-xl border border-dashed border-[var(--color-border-mid)] bg-[var(--color-surface)] px-4 py-3 text-[13px] text-[var(--color-ink-2)]">
          Ainda não há oportunidades. Clique em <strong>Nova oportunidade</strong> para começar o funil.
        </p>
      )}

      {aba === 'quadro' ? (
        <OportunidadesBoard oportunidades={visiveis} hoje={hoje} onMover={mover} onAbrir={setModal} />
      ) : (
        <ListaOportunidades oportunidades={visiveis} hoje={hoje} onAbrir={setModal} />
      )}

      {modal !== undefined && (
        <OportunidadeModal
          oportunidade={modal}
          perfis={perfis}
          usuarioAtualId={usuarioAtualId}
          onClose={() => setModal(undefined)}
          onSalva={mesclar}
          onExcluida={id => setOps(prev => prev.filter(o => o.id !== id))}
        />
      )}

      {perdendo && (
        <MotivoPerdaDialog
          nome={perdendo.nome}
          salvando={salvandoPerda}
          onConfirmar={confirmarPerda}
          onCancelar={() => setPerdendo(null)}
        />
      )}
    </div>
  )
}
