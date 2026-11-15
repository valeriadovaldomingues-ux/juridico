'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Trash2, X } from 'lucide-react'
import SearchableCombobox from '@/components/ui/SearchableCombobox'
import { fetchClienteOptions } from '@/lib/search/remote'
import {
  ETAPAS, ETAPA_INICIAL, ETAPA_LABEL, ETAPA_PERDIDO, STATUS_OPORTUNIDADE_LABEL,
  TIPOS_PESSOA, TIPO_PESSOA_LABEL,
  type EtapaId, type StatusProposta, type TipoPessoa,
} from '@/lib/crm-socios/constants'
import { sugerirEtapaPorProposta } from '@/lib/crm-socios/regras'
import { lerValorBR } from '@/lib/crm-socios/formato'
import { jsonInit, requisitar } from '@/lib/crm-socios/cliente-http'
import type { CrmInteracao, CrmOportunidade, CrmPerfilSocio, CrmProposta } from '@/types/crm-socios'
import InteracoesPanel from './InteracoesPanel'
import PropostasPanel from './PropostasPanel'
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, INPUT_CLASSE, ROTULO_CLASSE, STATUS_OPORTUNIDADE_CLASSE } from './visual'

interface Props {
  /** null = nova oportunidade */
  oportunidade: CrmOportunidade | null
  perfis: CrmPerfilSocio[]
  usuarioAtualId: string
  onClose: () => void
  onSalva: (op: CrmOportunidade) => void
  onExcluida: (id: string) => void
}

type Aba = 'dados' | 'interacoes' | 'propostas'

interface FormOportunidade {
  nome: string
  tipo_pessoa: TipoPessoa
  contato_nome: string
  contato_telefone: string
  contato_email: string
  origem: string
  indicado_por: string
  area_interesse: string
  valor_estimado: string
  responsavel_id: string
  etapa: EtapaId
  proxima_acao: string
  proxima_acao_data: string
  motivo_perda: string
  notas: string
  cliente_id: string
}

function formularioDe(op: CrmOportunidade | null, usuarioAtualId: string, perfis: CrmPerfilSocio[]): FormOportunidade {
  return {
    nome: op?.nome ?? '',
    tipo_pessoa: op?.tipo_pessoa ?? 'juridica',
    contato_nome: op?.contato_nome ?? '',
    contato_telefone: op?.contato_telefone ?? '',
    contato_email: op?.contato_email ?? '',
    origem: op?.origem ?? '',
    indicado_por: op?.indicado_por ?? '',
    area_interesse: op?.area_interesse ?? '',
    valor_estimado: op?.valor_estimado == null ? '' : String(op.valor_estimado).replace('.', ','),
    responsavel_id: op ? (op.responsavel_id ?? '') : (perfis.some(p => p.id === usuarioAtualId) ? usuarioAtualId : ''),
    etapa: op?.etapa ?? ETAPA_INICIAL,
    proxima_acao: op?.proxima_acao ?? '',
    proxima_acao_data: op?.proxima_acao_data ?? '',
    motivo_perda: op?.motivo_perda ?? '',
    notas: op?.notas ?? '',
    cliente_id: op?.cliente_id ?? '',
  }
}

export default function OportunidadeModal({ oportunidade, perfis, usuarioAtualId, onClose, onSalva, onExcluida }: Props) {
  const [op, setOp] = useState<CrmOportunidade | null>(oportunidade)
  const [form, setForm] = useState<FormOportunidade>(() => formularioDe(oportunidade, usuarioAtualId, perfis))
  const [aba, setAba] = useState<Aba>('dados')
  const [interacoes, setInteracoes] = useState<CrmInteracao[]>([])
  const [propostas, setPropostas] = useState<CrmProposta[]>([])
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(!!oportunidade)
  const [detalheFalhou, setDetalheFalhou] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [sugestao, setSugestao] = useState<EtapaId | null>(null)
  const [clienteSelecionado, setClienteSelecionado] = useState<{ value: string; label: string } | null>(
    oportunidade?.cliente ? { value: oportunidade.cliente.id, label: oportunidade.cliente.nome } : null,
  )

  const campo = <K extends keyof FormOportunidade>(k: K, v: FormOportunidade[K]) => setForm(f => ({ ...f, [k]: v }))

  // Fecha com Esc.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [onClose])

  // Carrega interações e propostas da oportunidade aberta.
  const idAberto = oportunidade?.id
  useEffect(() => {
    if (!idAberto) return
    let cancelado = false
    requisitar<CrmOportunidade>(`/api/crm-socios/oportunidades/${idAberto}`)
      .then(json => {
        if (cancelado) return
        setInteracoes(json.interacoes ?? [])
        setPropostas(json.propostas ?? [])
      })
      .catch(e => {
        if (cancelado) return
        setDetalheFalhou(true)
        setErro(e instanceof Error ? e.message : 'Não foi possível carregar o histórico.')
      })
      .finally(() => { if (!cancelado) setCarregandoDetalhe(false) })
    return () => { cancelado = true }
  }, [idAberto])

  async function salvar() {
    if (!form.nome.trim()) { setErro('Informe o nome da pessoa ou empresa.'); setAba('dados'); return }
    const valor = lerValorBR(form.valor_estimado)
    if (valor !== null && Number.isNaN(valor)) { setErro('Valor estimado inválido.'); setAba('dados'); return }
    if (form.etapa === ETAPA_PERDIDO && !form.motivo_perda.trim()) { setErro('Informe o motivo da perda.'); setAba('dados'); return }

    setSalvando(true); setErro(null)
    try {
      const corpo = {
        nome: form.nome,
        tipo_pessoa: form.tipo_pessoa,
        contato_nome: form.contato_nome,
        contato_telefone: form.contato_telefone,
        contato_email: form.contato_email,
        origem: form.origem,
        indicado_por: form.indicado_por,
        area_interesse: form.area_interesse,
        valor_estimado: valor,
        responsavel_id: form.responsavel_id || null,
        etapa: form.etapa,
        proxima_acao: form.proxima_acao,
        proxima_acao_data: form.proxima_acao_data || null,
        motivo_perda: form.etapa === ETAPA_PERDIDO ? form.motivo_perda : null,
        notas: form.notas,
        cliente_id: form.cliente_id || null,
      }
      const salva = await requisitar<CrmOportunidade>(
        op ? `/api/crm-socios/oportunidades/${op.id}` : '/api/crm-socios/oportunidades',
        jsonInit(op ? 'PATCH' : 'POST', corpo),
      )
      onSalva(salva)
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!op) return
    setSalvando(true); setErro(null)
    try {
      await requisitar(`/api/crm-socios/oportunidades/${op.id}`, jsonInit('DELETE'))
      onExcluida(op.id)
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir.')
      setConfirmandoExclusao(false)
    } finally {
      setSalvando(false)
    }
  }

  function aoMudarInteracoes(lista: CrmInteracao[], ultimoContatoEm: string | null) {
    setInteracoes(lista)
    if (!op) return
    const atualizada = { ...op, ultimo_contato_em: ultimoContatoEm }
    setOp(atualizada)
    onSalva(atualizada)
  }

  function aoDefinirStatusProposta(status: StatusProposta) {
    if (!op) return
    setSugestao(sugerirEtapaPorProposta(status, op.etapa))
  }

  async function aplicarSugestao() {
    if (!op || !sugestao) return
    setErro(null)
    try {
      const movida = await requisitar<CrmOportunidade>(`/api/crm-socios/oportunidades/${op.id}`, jsonInit('PATCH', { etapa: sugestao }))
      const atualizada = { ...op, ...movida }
      setOp(atualizada)
      setForm(f => ({ ...f, etapa: atualizada.etapa, motivo_perda: '' }))
      onSalva(atualizada)
      setSugestao(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível mover a oportunidade.')
    }
  }

  const abas: Array<[Aba, string]> = [['dados', 'Dados']]
  if (op) abas.push(['interacoes', `Interações${interacoes.length ? ` (${interacoes.length})` : ''}`], ['propostas', `Propostas${propostas.length ? ` (${propostas.length})` : ''}`])

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center bg-black/40 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="oport-titulo">
      <div className="bg-white sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col max-h-screen sm:max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-[var(--color-border)]">
          <div className="min-w-0">
            <h2 id="oport-titulo" className="text-[16px] font-semibold text-[var(--color-ink)] truncate">
              {op ? op.nome : 'Nova oportunidade'}
            </h2>
            {op && (
              <p className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-ink-3)]">
                <span className={`font-semibold px-2 py-0.5 rounded-full ${STATUS_OPORTUNIDADE_CLASSE[op.status]}`}>{STATUS_OPORTUNIDADE_LABEL[op.status]}</span>
                {ETAPA_LABEL[op.etapa]}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100"><X size={18} /></button>
        </div>

        {abas.length > 1 && (
          <div className="flex gap-1 px-5 pt-2 border-b border-[var(--color-border)]" role="tablist">
            {abas.map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aba === id}
                onClick={() => setAba(id)}
                className={`px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${aba === id ? 'border-[var(--color-copper)] text-[var(--color-ink)]' : 'border-transparent text-[var(--color-ink-3)] hover:text-[var(--color-ink-2)]'}`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {sugestao && (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 flex flex-wrap items-center gap-2">
              <span className="flex-1 min-w-[200px]">Mover esta oportunidade para <strong>{ETAPA_LABEL[sugestao]}</strong>?</span>
              <button type="button" onClick={aplicarSugestao} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[12px] font-semibold hover:bg-amber-700">Mover</button>
              <button type="button" onClick={() => setSugestao(null)} className="px-3 py-1.5 rounded-lg border border-amber-300 text-[12px] font-medium hover:bg-amber-100">Agora não</button>
            </div>
          )}

          {erro && aba !== 'dados' && <p role="alert" className="text-[12px] text-red-600">{erro}</p>}

          {aba === 'dados' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="op-nome" className={ROTULO_CLASSE}>Pessoa ou empresa <span className="text-red-500">*</span></label>
                  <input id="op-nome" value={form.nome} onChange={e => campo('nome', e.target.value)} className={INPUT_CLASSE} autoFocus={!op} />
                </div>
                <div>
                  <label htmlFor="op-tipo" className={ROTULO_CLASSE}>Tipo</label>
                  <select id="op-tipo" value={form.tipo_pessoa} onChange={e => campo('tipo_pessoa', e.target.value as TipoPessoa)} className={INPUT_CLASSE}>
                    {TIPOS_PESSOA.map(t => <option key={t} value={t}>{TIPO_PESSOA_LABEL[t]}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="op-contato" className={ROTULO_CLASSE}>Contato</label>
                  <input id="op-contato" value={form.contato_nome} onChange={e => campo('contato_nome', e.target.value)} placeholder="Nome" className={INPUT_CLASSE} />
                </div>
                <div>
                  <label htmlFor="op-tel" className={ROTULO_CLASSE}>Telefone</label>
                  <input id="op-tel" inputMode="tel" value={form.contato_telefone} onChange={e => campo('contato_telefone', e.target.value)} className={INPUT_CLASSE} />
                </div>
                <div>
                  <label htmlFor="op-email" className={ROTULO_CLASSE}>E-mail</label>
                  <input id="op-email" type="email" value={form.contato_email} onChange={e => campo('contato_email', e.target.value)} className={INPUT_CLASSE} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="op-origem" className={ROTULO_CLASSE}>Origem</label>
                  <input id="op-origem" value={form.origem} onChange={e => campo('origem', e.target.value)} placeholder="Ex.: evento, site, parceiro" className={INPUT_CLASSE} />
                </div>
                <div>
                  <label htmlFor="op-indicado" className={ROTULO_CLASSE}>Indicado por</label>
                  <input id="op-indicado" value={form.indicado_por} onChange={e => campo('indicado_por', e.target.value)} className={INPUT_CLASSE} />
                </div>
                <div>
                  <label htmlFor="op-area" className={ROTULO_CLASSE}>Área de interesse</label>
                  <input id="op-area" value={form.area_interesse} onChange={e => campo('area_interesse', e.target.value)} placeholder="Ex.: societário" className={INPUT_CLASSE} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="op-valor" className={ROTULO_CLASSE}>Valor estimado (R$)</label>
                  <input id="op-valor" inputMode="decimal" value={form.valor_estimado} onChange={e => campo('valor_estimado', e.target.value)} placeholder="0,00" className={INPUT_CLASSE} />
                </div>
                <div>
                  <label htmlFor="op-resp" className={ROTULO_CLASSE}>Responsável</label>
                  <select id="op-resp" value={form.responsavel_id} onChange={e => campo('responsavel_id', e.target.value)} className={INPUT_CLASSE}>
                    <option value="">Sem responsável</option>
                    {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="op-etapa" className={ROTULO_CLASSE}>Etapa</label>
                  <select id="op-etapa" value={form.etapa} onChange={e => campo('etapa', e.target.value as EtapaId)} className={INPUT_CLASSE}>
                    {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
              </div>

              {form.etapa === ETAPA_PERDIDO && (
                <div>
                  <label htmlFor="op-motivo" className={ROTULO_CLASSE}>Motivo da perda <span className="text-red-500">*</span></label>
                  <textarea id="op-motivo" rows={2} value={form.motivo_perda} onChange={e => campo('motivo_perda', e.target.value)} className={INPUT_CLASSE} />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="op-acao" className={ROTULO_CLASSE}>Próxima ação</label>
                  <input id="op-acao" value={form.proxima_acao} onChange={e => campo('proxima_acao', e.target.value)} placeholder="Ex.: ligar para confirmar a reunião" className={INPUT_CLASSE} />
                </div>
                <div>
                  <label htmlFor="op-acao-data" className={ROTULO_CLASSE}>Data</label>
                  <input id="op-acao-data" type="date" value={form.proxima_acao_data} onChange={e => campo('proxima_acao_data', e.target.value)} className={INPUT_CLASSE} />
                </div>
              </div>

              <div>
                <label className={ROTULO_CLASSE}>Cliente vinculado</label>
                <SearchableCombobox
                  value={form.cliente_id}
                  onChange={(value, option) => {
                    campo('cliente_id', value)
                    setClienteSelecionado(value && option ? { value, label: option.label } : null)
                  }}
                  loadOptions={q => fetchClienteOptions(q, 10)}
                  selectedOption={clienteSelecionado}
                  placeholder="Sem cliente vinculado"
                  searchPlaceholder="Buscar cliente por nome, CPF ou CNPJ"
                  helperText="Digite ao menos 2 caracteres."
                  emptyText="Digite para buscar clientes."
                  noResultsText="Nenhum cliente encontrado."
                  allowClear
                />
                <p className="mt-1.5 text-[11px] text-[var(--color-ink-3)]">
                  Quando a oportunidade for fechada, vincule ao cadastro do cliente.{' '}
                  <a href="/clientes/novo" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[var(--color-copper)] hover:underline">
                    Cadastrar novo cliente <ExternalLink size={10} />
                  </a>{' '}
                  (abre em outra aba).
                </p>
              </div>

              <div>
                <label htmlFor="op-notas" className={ROTULO_CLASSE}>Notas</label>
                <textarea id="op-notas" rows={3} value={form.notas} onChange={e => campo('notas', e.target.value)} className={INPUT_CLASSE} />
              </div>

              {erro && <p role="alert" className="text-[12px] text-red-600">{erro}</p>}
            </div>
          )}

          {aba === 'interacoes' && op && (
            carregandoDetalhe || detalheFalhou
              ? <p className="text-[13px] text-[var(--color-ink-3)]">{carregandoDetalhe ? 'Carregando…' : 'Não foi possível carregar o histórico desta oportunidade.'}</p>
              : <InteracoesPanel oportunidadeId={op.id} interacoes={interacoes} onMudou={aoMudarInteracoes} />
          )}

          {aba === 'propostas' && op && (
            carregandoDetalhe || detalheFalhou
              ? <p className="text-[13px] text-[var(--color-ink-3)]">{carregandoDetalhe ? 'Carregando…' : 'Não foi possível carregar as propostas desta oportunidade.'}</p>
              : <PropostasPanel oportunidadeId={op.id} propostas={propostas} onMudou={setPropostas} onStatusDefinido={aoDefinirStatusProposta} />
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-[var(--color-border)]">
          {op && !confirmandoExclusao && (
            <button type="button" onClick={() => setConfirmandoExclusao(true)} className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50">
              <Trash2 size={13} />Excluir
            </button>
          )}
          {op && confirmandoExclusao && (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-red-700">Excluir também o histórico e as propostas?</span>
              <button type="button" onClick={excluir} disabled={salvando} className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60">Excluir</button>
              <button type="button" onClick={() => setConfirmandoExclusao(false)} className="px-2.5 py-1 rounded-lg border border-zinc-200 hover:bg-zinc-50">Não</button>
            </div>
          )}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className={BOTAO_SECUNDARIO}>{aba === 'dados' ? 'Cancelar' : 'Fechar'}</button>
          {aba === 'dados' && (
            <button type="button" onClick={salvar} disabled={salvando} className={BOTAO_PRIMARIO}>
              {salvando ? 'Salvando…' : op ? 'Salvar' : 'Criar oportunidade'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
