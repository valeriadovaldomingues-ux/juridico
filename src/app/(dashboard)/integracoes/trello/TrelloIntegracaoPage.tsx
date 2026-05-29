'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Check, ChevronDown, ChevronUp, ExternalLink,
  Loader2, RefreshCw, Unlink, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import SearchableCombobox from '@/components/ui/SearchableCombobox'
import { fetchUsuarioOptions } from '@/lib/search/remote'
import type { TrelloIntegration, TrelloList, TrelloMember, TrelloListMapping, TrelloMemberMapping, TrelloSyncLog } from '@/types/trello'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_OPTS = [
  { v: 'a_fazer',       l: 'A Fazer'       },
  { v: 'fazendo',       l: 'Fazendo'       },
  { v: 'com_pendencia', l: 'Com Pendência' },
  { v: 'concluido',     l: 'Concluído'     },
  { v: 'ignorar',       l: '— Ignorar —'   },
]

function fmtRelativo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const horas = Math.floor(diff / 3_600_000)
  const dias  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return 'agora mesmo'
  if (mins  < 60)  return `${mins} min atrás`
  if (horas < 24)  return `${horas}h atrás`
  if (dias  === 1) return 'ontem'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const inputCls = 'w-full px-3 py-2.5 text-[13px] bg-[#f9fafb] border border-[#e5e7eb] rounded-xl outline-none focus:bg-white focus:border-[#1D5F60] text-[#374151] placeholder:text-[#c5cdd8] transition-all'
const selectCls = inputCls

// ─── Props ────────────────────────────────────────────────────────────────────

interface Profile { id: string; nome: string; role?: string | null }

interface Props {
  initialIntegration:    TrelloIntegration | null
  initialListMappings:   TrelloListMapping[]
  initialMemberMappings: TrelloMemberMapping[]
  profiles:              Profile[]
  initialLogs:           TrelloSyncLog[]
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function TrelloIntegracaoPage({
  initialIntegration,
  initialListMappings,
  initialMemberMappings,
  profiles,
  initialLogs,
}: Props) {
  // ── Integração ──
  const [integration, setIntegration] = useState<TrelloIntegration | null>(initialIntegration)

  // ── Form de credenciais ──
  const [apiKey,   setApiKey]   = useState('')
  const [apiToken, setApiToken] = useState('')
  const [boardId,  setBoardId]  = useState(initialIntegration?.board_id ?? '')
  const [saving,   setSaving]   = useState(false)
  const [credErr,  setCredErr]  = useState('')
  const [helpOpen, setHelpOpen] = useState(false)

  // ── Listas e membros do Trello ──
  const [trelloLists,   setTrelloLists]   = useState<TrelloList[]>([])
  const [trelloMembers, setTrelloMembers] = useState<TrelloMember[]>([])
  const [loadingData,   setLoadingData]   = useState(false)
  const [dataErr,       setDataErr]       = useState('')

  // ── Mapeamentos locais ──
  const [listMap,   setListMap]   = useState<Record<string, string>>({})   // trello_list_id → kanban_status
  const [memberMap, setMemberMap] = useState<Record<string, string>>({})   // trello_member_id → profile_id
  const [savingMap, setSavingMap] = useState(false)
  const [mapMsg,    setMapMsg]    = useState('')

  // ── Sync ──
  const [syncing, setSyncing]   = useState(false)
  const [logs,    setLogs]      = useState<TrelloSyncLog[]>(initialLogs)
  const [syncErr, setSyncErr]   = useState('')

  // ── Inicializar mapeamentos a partir dos dados do servidor ──
  useEffect(() => {
    const lm: Record<string, string> = {}
    for (const m of initialListMappings) lm[m.trello_list_id] = m.kanban_status
    setListMap(lm)

    const mm: Record<string, string> = {}
    for (const m of initialMemberMappings) mm[m.trello_member_id] = m.profile_id ?? ''
    setMemberMap(mm)
  }, [initialListMappings, initialMemberMappings])

  // ── Carregar listas e membros quando há integração ──
  const loadTrelloData = useCallback(async () => {
    setLoadingData(true)
    setDataErr('')
    try {
      const [listsRes, membersRes] = await Promise.all([
        fetch('/api/trello/lists'),
        fetch('/api/trello/members'),
      ])
      if (!listsRes.ok || !membersRes.ok) throw new Error('Erro ao buscar dados do Trello')
      const [lists, members] = await Promise.all([listsRes.json(), membersRes.json()])
      setTrelloLists(lists)
      setTrelloMembers(members)
    } catch (err) {
      setDataErr(err instanceof Error ? err.message : 'Erro ao conectar ao Trello')
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (integration) loadTrelloData()
  }, [integration, loadTrelloData])

  // ── Salvar credenciais ──
  async function handleSaveCredentials() {
    if (!apiKey.trim() || !apiToken.trim() || !boardId.trim()) {
      setCredErr('Preencha todos os campos')
      return
    }
    setSaving(true)
    setCredErr('')
    try {
      const res = await fetch('/api/trello/config', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ board_id: boardId.trim(), api_key: apiKey.trim(), api_token: apiToken.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setCredErr(data.error ?? `Erro ${res.status}`); return }
      setIntegration(data)
      setApiKey('')
      setApiToken('')
    } catch {
      setCredErr('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  // ── Desconectar ──
  async function handleDisconnect() {
    if (!confirm('Deseja desconectar a integração com o Trello? Os cards já importados serão mantidos.')) return
    await fetch('/api/trello/config', { method: 'DELETE' })
    setIntegration(null)
    setTrelloLists([])
    setTrelloMembers([])
  }

  // ── Salvar mapeamentos ──
  async function handleSaveMappings() {
    setSavingMap(true)
    setMapMsg('')

    const lists = trelloLists.map(l => ({
      trello_list_id:   l.id,
      trello_list_name: l.name,
      kanban_status:    listMap[l.id] ?? 'ignorar',
    }))

    const members = trelloMembers.map(m => ({
      trello_member_id: m.id,
      trello_username:  m.username,
      trello_full_name: m.fullName,
      profile_id:       memberMap[m.id] ?? null,
    }))

    try {
      const res = await fetch('/api/trello/mappings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ lists, members }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        setMapMsg(e.error ?? 'Erro ao salvar')
      } else {
        setMapMsg('Mapeamentos salvos!')
        setTimeout(() => setMapMsg(''), 3000)
      }
    } catch {
      setMapMsg('Erro de conexão')
    } finally {
      setSavingMap(false)
    }
  }

  // ── Sincronizar ──
  async function handleSync() {
    setSyncing(true)
    setSyncErr('')
    try {
      const res = await fetch('/api/trello/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setSyncErr(data.error ?? `Erro ${res.status}`); return }

      // Exibir aviso se houve membros sem mapping
      if (data.membros_nao_mapeados?.length > 0) {
        setSyncErr(
          `Sync concluído com avisos: ${data.sem_responsavel} tarefa(s) ficaram sem responsável ` +
          `porque os seguintes membros do Trello não têm mapeamento configurado: ` +
          data.membros_nao_mapeados.join(', ') +
          `. Configure os mapeamentos na aba "Membros" e sincronize novamente.`
        )
      }

      // Recarregar logs
      const logsRes = await fetch('/api/trello/sync-logs')
      if (logsRes.ok) setLogs(await logsRes.json())
    } catch {
      setSyncErr('Erro de conexão')
    } finally {
      setSyncing(false)
    }
  }

  const lastLog = logs[0]

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-[#0f1923]">Integração Trello</h1>
        <p className="text-[13px] text-[#7a8899] mt-1">
          Sincronize cards do Trello com o Kanban automaticamente.
        </p>
      </div>

      {/* ── Credenciais ──────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-lg border border-[#e5e7eb] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f3f4f6] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-[#0f1923]">Credenciais</span>
            {integration && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold rounded-full">
                <Check size={10} />
                Conectado — {integration.board_name}
              </span>
            )}
          </div>
          {integration && (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 text-[12px] text-red-500 hover:text-red-700 transition-colors"
            >
              <Unlink size={12} /> Desconectar
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Ajuda */}
          <button
            onClick={() => setHelpOpen(v => !v)}
            className="flex items-center gap-1.5 text-[12px] text-[#1D5F60] font-medium hover:underline"
          >
            {helpOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Como obter as credenciais do Trello
          </button>

          {helpOpen && (
            <div className="bg-[#f9fafb] rounded-xl px-4 py-3 space-y-1.5 text-[12px] text-[#374151] border border-[#e5e7eb]">
              <p><strong>API Key:</strong> acesse{' '}
                <a href="https://trello.com/app-key" target="_blank" rel="noreferrer" className="text-[#1D5F60] underline inline-flex items-center gap-1">
                  trello.com/app-key <ExternalLink size={10} />
                </a>
                {' '}e copie a chave.
              </p>
              <p><strong>Token:</strong> na mesma página, clique em &ldquo;Token&rdquo; e autorize o acesso.</p>
              <p><strong>Board ID:</strong> abra o board no Trello e copie o trecho da URL entre <code className="bg-white px-1 rounded">/b/</code> e o próximo <code className="bg-white px-1 rounded">/</code>. Ex: <code className="bg-white px-1 rounded">trello.com/b/<u>BOARD_ID</u>/nome</code>.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">
                API Key
              </label>
              <input
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setCredErr('') }}
                placeholder={integration ? '••••••••••••' : 'Cole sua API Key'}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">
                Token
              </label>
              <input
                value={apiToken}
                onChange={e => { setApiToken(e.target.value); setCredErr('') }}
                placeholder={integration ? '••••••••••••' : 'Cole seu Token'}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#7a8899] uppercase tracking-wide mb-1.5">
              Board ID
            </label>
            <input
              value={boardId}
              onChange={e => { setBoardId(e.target.value); setCredErr('') }}
              placeholder="Ex: xYz1aBcD"
              className={inputCls}
            />
          </div>

          {credErr && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{credErr}</p>}

          <div className="flex justify-end">
            <button
              onClick={handleSaveCredentials}
              disabled={saving || (!apiKey.trim() || !apiToken.trim() || !boardId.trim())}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1D5F60] text-white text-[13px] font-semibold rounded-xl hover:bg-[#145A5B] disabled:opacity-40 transition-colors"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Conectando…' : integration ? 'Atualizar credenciais' : 'Conectar board'}
            </button>
          </div>
        </div>
      </section>

      {/* ── Mapeamento de Listas ─────────────────────────────────────────────── */}
      {integration && (
        <section className="bg-white rounded-lg border border-[#e5e7eb] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#f3f4f6] flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#0f1923]">Mapeamento de Listas</span>
            <button
              onClick={loadTrelloData}
              className="flex items-center gap-1.5 text-[12px] text-[#7a8899] hover:text-[#1D5F60] transition-colors"
            >
              <RefreshCw size={12} className={loadingData ? 'animate-spin' : ''} />
              Recarregar
            </button>
          </div>

          <div className="px-6 py-5">
            {loadingData && (
              <div className="flex items-center gap-2 text-[12px] text-[#9ca3af] py-4">
                <Loader2 size={14} className="animate-spin" /> Carregando listas…
              </div>
            )}
            {dataErr && (
              <p className="text-[12px] text-red-500 bg-red-50 px-3 py-2 rounded-lg">{dataErr}</p>
            )}

            {!loadingData && !dataErr && trelloLists.length === 0 && (
              <p className="text-[12px] text-[#9ca3af] py-4 text-center">Nenhuma lista encontrada.</p>
            )}

            {trelloLists.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wide px-1 mb-3">
                  <span>Lista no Trello</span>
                  <span />
                  <span>Status no Kanban</span>
                </div>
                {trelloLists.map(list => (
                  <div key={list.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="px-3 py-2.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-xl text-[13px] text-[#374151] truncate">
                      {list.name}
                    </div>
                    <span className="text-[#9ca3af] text-[12px]">→</span>
                    <select
                      value={listMap[list.id] ?? 'ignorar'}
                      onChange={e => setListMap(prev => ({ ...prev, [list.id]: e.target.value }))}
                      className={selectCls}
                    >
                      {STATUS_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Mapeamento de Membros ──────────────────────────────────────── */}
          {trelloMembers.length > 0 && (
            <>
              <div className="mx-6 border-t border-[#f3f4f6]" />
              <div className="px-6 py-5">
                <p className="text-[14px] font-semibold text-[#0f1923] mb-4">Mapeamento de Membros</p>
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-3 text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wide px-1 mb-3">
                    <span>Membro no Trello</span>
                    <span />
                    <span>Usuário do sistema</span>
                  </div>
                  {trelloMembers.map(member => (
                    <div key={member.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="px-3 py-2.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-xl">
                        <p className="text-[13px] text-[#374151] font-medium truncate">{member.fullName}</p>
                        <p className="text-[10px] text-[#9ca3af]">@{member.username}</p>
                      </div>
                      <span className="text-[#9ca3af] text-[12px]">→</span>
                      <div className="min-w-[260px]">
                        <SearchableCombobox
                          value={memberMap[member.id] ?? ''}
                          onChange={(value) => setMemberMap(prev => ({ ...prev, [member.id]: value }))}
                          loadOptions={async (query) => fetchUsuarioOptions(query, 10)}
                          selectedOption={profiles.find(p => p.id === (memberMap[member.id] ?? '')) ? {
                            value: memberMap[member.id] ?? '',
                            label: profiles.find(p => p.id === (memberMap[member.id] ?? ''))?.nome ?? '',
                            description: profiles.find(p => p.id === (memberMap[member.id] ?? ''))?.role ?? null,
                          } : null}
                          placeholder="— Sem vínculo —"
                          searchPlaceholder="Buscar membro por nome, e-mail ou função"
                          helperText="Digite ao menos 2 caracteres."
                          emptyText="Digite para buscar usuários."
                          noResultsText="Nenhum resultado encontrado."
                          allowClear
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Ações de mapeamento */}
          {(trelloLists.length > 0 || trelloMembers.length > 0) && (
            <div className="px-6 pb-5 flex items-center justify-between">
              {mapMsg && (
                <span className={cn(
                  'text-[12px] font-medium',
                  mapMsg.includes('!') ? 'text-emerald-600' : 'text-red-500',
                )}>
                  {mapMsg}
                </span>
              )}
              <div className="ml-auto">
                <button
                  onClick={handleSaveMappings}
                  disabled={savingMap}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#1D5F60] text-white text-[13px] font-semibold rounded-xl hover:bg-[#145A5B] disabled:opacity-40 transition-colors"
                >
                  {savingMap && <Loader2 size={13} className="animate-spin" />}
                  {savingMap ? 'Salvando…' : 'Salvar mapeamentos'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Sincronização ────────────────────────────────────────────────────── */}
      {integration && (
        <section className="bg-white rounded-lg border border-[#e5e7eb] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#f3f4f6]">
            <span className="text-[14px] font-semibold text-[#0f1923]">Sincronização</span>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                {lastLog ? (
                  <p className="text-[13px] text-[#374151]">
                    Última sincronização:{' '}
                    <span className={cn(
                      'font-semibold',
                      lastLog.status === 'sucesso'      ? 'text-emerald-600'
                      : lastLog.status === 'erro'       ? 'text-red-600'
                      : 'text-amber-600',
                    )}>
                      {lastLog.status === 'em_andamento' ? 'Em andamento…' : fmtRelativo(lastLog.finished_at ?? lastLog.started_at)}
                    </span>
                  </p>
                ) : (
                  <p className="text-[13px] text-[#9ca3af]">Nenhuma sincronização realizada ainda.</p>
                )}
              </div>

              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#1D5F60] text-white text-[13px] font-semibold rounded-xl hover:bg-[#145A5B] disabled:opacity-40 transition-colors"
              >
                {syncing
                  ? <><Loader2 size={13} className="animate-spin" /> Sincronizando…</>
                  : <><Zap size={13} /> Sincronizar agora</>
                }
              </button>
            </div>

            {syncErr && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{syncErr}</p>}

            {/* Tabela de logs */}
            {logs.length > 0 && (
              <div className="rounded-xl border border-[#f0f2f5] overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-[#f9fafb] border-b border-[#f0f2f5]">
                      <th className="text-left px-4 py-2.5 text-[#9ca3af] font-semibold">Data</th>
                      <th className="text-left px-4 py-2.5 text-[#9ca3af] font-semibold">Status</th>
                      <th className="text-right px-4 py-2.5 text-[#9ca3af] font-semibold">Criados</th>
                      <th className="text-right px-4 py-2.5 text-[#9ca3af] font-semibold">Atualizados</th>
                      <th className="text-right px-4 py-2.5 text-[#9ca3af] font-semibold">Ignorados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-b border-[#f9fafb] hover:bg-[#fafafa]">
                        <td className="px-4 py-2.5 text-[#374151]">
                          {fmtRelativo(log.finished_at ?? log.started_at)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                            log.status === 'sucesso'       ? 'bg-emerald-50 text-emerald-700'
                            : log.status === 'erro'        ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700',
                          )}>
                            {log.status === 'sucesso' ? 'Sucesso'
                            : log.status === 'erro'   ? 'Erro'
                            : 'Em andamento'}
                          </span>
                          {log.erro_detalhes && (
                            <p className="text-[10px] text-red-500 mt-0.5 max-w-xs truncate" title={log.erro_detalhes}>
                              {log.erro_detalhes}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-emerald-600 font-semibold">{log.cards_criados > 0 ? `+${log.cards_criados}` : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-blue-600 font-semibold">{log.cards_atualizados > 0 ? `~${log.cards_atualizados}` : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-[#9ca3af]">{log.cards_ignorados}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
