'use client'

import { useState } from 'react'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/permissions'
import type { Profile, UserRole } from '@/types'
import {
  Plus, Pencil, Power, Mail, X, Check,
  Loader2, Shield, ChevronDown,
} from 'lucide-react'

const ROLES: UserRole[] = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio']

interface NovoForm {
  nome: string
  email: string
  role: UserRole
  senha: string
}

interface EditForm {
  nome: string
  role: UserRole
}

const NOVO_VAZIO: NovoForm = { nome: '', email: '', role: 'advogado', senha: '' }

function getInitials(nome: string): string {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function UsuariosPage({
  usuarios: inicial,
  currentUserRole,
  currentUserId,
}: {
  usuarios: Profile[]
  currentUserRole: UserRole
  currentUserId: string
}) {
  const [usuarios, setUsuarios]   = useState<Profile[]>(inicial)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm]   = useState<EditForm>({ nome: '', role: 'advogado' })
  const [novoForm, setNovoForm]   = useState<NovoForm>(NOVO_VAZIO)
  const [saving, setSaving]       = useState(false)
  const [flash, setFlash]         = useState<{ msg: string; ok: boolean } | null>(null)

  const isSocio = currentUserRole === 'socio'

  function toast(msg: string, ok = true) {
    setFlash({ msg, ok })
    setTimeout(() => setFlash(null), 4500)
  }

  // ── Criar usuário ────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (novoForm.senha.length < 6) { toast('A senha deve ter pelo menos 6 caracteres', false); return }
    setSaving(true)

    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoForm),
    })
    const json = await res.json()
    setSaving(false)

    if (!res.ok) { toast(json.error ?? 'Erro ao criar usuário', false); return }

    // Recarregar lista completa via API
    const listRes = await fetch('/api/usuarios')
    if (listRes.ok) setUsuarios(await listRes.json())
    setShowModal(false)
    setNovoForm(NOVO_VAZIO)
    toast('Usuário criado com sucesso!')
  }

  // ── Editar usuário ───────────────────────────────────────────────────────────

  function abrirEdicao(u: Profile) {
    setEditingId(u.id)
    setEditForm({ nome: u.nome, role: u.role })
  }

  async function salvarEdicao(id: string) {
    if (!editForm.nome.trim()) { toast('Nome obrigatório', false); return }
    setSaving(true)
    const res = await fetch(`/api/usuarios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: editForm.nome.trim(), role: editForm.role }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { toast(json.error ?? 'Erro ao atualizar', false); return }
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, nome: editForm.nome.trim(), role: editForm.role } : u))
    setEditingId(null)
    toast('Usuário atualizado!')
  }

  // ── Ativar / Desativar ───────────────────────────────────────────────────────

  async function toggleAtivo(u: Profile) {
    if (u.id === currentUserId) { toast('Você não pode desativar sua própria conta.', false); return }
    const novoAtivo = !u.ativo
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: novoAtivo }),
    })
    const json = await res.json()
    if (!res.ok) { toast(json.error ?? 'Erro ao alterar status', false); return }
    setUsuarios(prev => prev.map(p => p.id === u.id ? { ...p, ativo: novoAtivo } : p))
    toast(novoAtivo ? 'Usuário reativado.' : 'Usuário desativado.')
  }

  // ── Reset de senha ───────────────────────────────────────────────────────────

  async function enviarReset(email: string) {
    const res = await fetch('/api/usuarios/reset-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirectTo: `${window.location.origin}/reset-password` }),
    })
    const json = await res.json()
    if (!res.ok) toast(json.error ?? 'Erro ao enviar e-mail', false)
    else toast(`E-mail de redefinição enviado para ${email}`)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const ativos   = usuarios.filter(u => u.ativo).length
  const inativos = usuarios.length - ativos

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header da página */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight">Usuários</h1>
          <p className="text-[13px] text-[#7a8899] mt-0.5">
            {usuarios.length} cadastrado{usuarios.length !== 1 ? 's' : ''} &middot; {ativos} ativo{ativos !== 1 ? 's' : ''}
            {inativos > 0 && ` · ${inativos} inativo${inativos !== 1 ? 's' : ''}`}
          </p>
        </div>
        {isSocio && (
          <button
            onClick={() => { setShowModal(true); setFlash(null) }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1D5F60] hover:bg-[#27777A] text-white text-[13px] font-medium rounded-xl transition-colors flex-shrink-0"
          >
            <Plus size={15} /> Novo Usuário
          </button>
        )}
      </div>

      {/* Flash message */}
      {flash && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] border ${
          flash.ok
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {flash.ok ? <Check size={14} /> : <X size={14} />}
          {flash.msg}
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-lg border border-[#E2DDD8] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        {usuarios.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-[#f3f4f6] flex items-center justify-center">
              <Shield size={20} className="text-[#d1d5db]" />
            </div>
            <p className="text-sm font-medium text-[#6b7280]">Nenhum usuário cadastrado</p>
            {isSocio && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-1 text-[13px] font-semibold text-[#1D5F60] hover:underline inline-flex items-center gap-1"
              >
                <Plus size={12} /> Criar primeiro usuário
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f3f4f6]">
                <th className="px-6 py-3.5 text-left text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">
                  Perfil
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">
                  Status
                </th>
                {isSocio && (
                  <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f9fafb]">
              {usuarios.map(u => {
                const isEditing     = editingId === u.id
                const isCurrentUser = u.id === currentUserId

                return (
                  <tr
                    key={u.id}
                    className={`transition-colors hover:bg-[#fafafa] ${!u.ativo ? 'opacity-50' : ''}`}
                  >
                    {/* Usuário */}
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editForm.nome}
                          onChange={e => setEditForm(prev => ({ ...prev, nome: e.target.value }))}
                          placeholder="Nome completo"
                          className="w-full px-3 py-1.5 text-sm border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] focus:ring-2 focus:ring-[#1D5F60]/10"
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1D5F60] flex items-center justify-center flex-shrink-0">
                            <span className="text-[11px] font-bold text-white leading-none select-none">
                              {getInitials(u.nome)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#1a1d23] truncate">
                              {u.nome}
                              {isCurrentUser && (
                                <span className="ml-2 text-[10px] font-normal text-[#9ca3af]">(você)</span>
                              )}
                            </p>
                            <p className="text-[11px] text-[#9ca3af] truncate">{u.email}</p>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Perfil */}
                    <td className="px-4 py-4">
                      {isEditing ? (
                        <div className="relative">
                          <select
                            value={editForm.role}
                            onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                            className="appearance-none pl-3 pr-8 py-1.5 text-[13px] border border-[#e5e7eb] rounded-lg outline-none focus:border-[#1D5F60] bg-white cursor-pointer"
                          >
                            {ROLES.map(r => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
                        </div>
                      ) : (
                        <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                        u.ativo
                          ? 'bg-green-50 text-green-700 ring-1 ring-green-200/70'
                          : 'bg-red-50 text-red-600 ring-1 ring-red-200/70'
                      }`}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>

                    {/* Ações (apenas sócio) */}
                    {isSocio && (
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => salvarEdicao(u.id)}
                                disabled={saving}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#145A5B] hover:bg-[#1B6E70] text-white text-[12px] font-medium rounded-lg transition-colors disabled:opacity-60"
                              >
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                Salvar
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => abrirEdicao(u)}
                                className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
                                title="Editar nome e perfil"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => enviarReset(u.email)}
                                className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#1D5F60] hover:bg-[#E8F2F2] transition-colors"
                                title="Enviar e-mail de redefinição de senha"
                              >
                                <Mail size={14} />
                              </button>
                              {!isCurrentUser && (
                                <button
                                  onClick={() => toggleAtivo(u)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    u.ativo
                                      ? 'text-[#9ca3af] hover:text-red-500 hover:bg-red-50'
                                      : 'text-[#9ca3af] hover:text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                  title={u.ativo ? 'Desativar conta' : 'Reativar conta'}
                                >
                                  <Power size={14} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal de criação ───────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => { setShowModal(false); setFlash(null) }}
          />

          {/* Card */}
          <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md">
            {/* Header do modal */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#f3f4f6]">
              <h2 className="text-[16px] font-semibold text-[#1a1d23]">Novo Usuário</h2>
              <button
                onClick={() => { setShowModal(false); setFlash(null) }}
                className="p-1.5 rounded-lg hover:bg-[#f3f4f6] transition-colors"
              >
                <X size={16} className="text-[#9ca3af]" />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1.5">
                  Nome completo *
                </label>
                <input
                  required
                  autoFocus
                  value={novoForm.nome}
                  onChange={e => setNovoForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Maria Silva"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#1D5F60] focus:ring-2 focus:ring-[#1D5F60]/10 bg-[#fafbfc] placeholder:text-[#d1d5db]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1.5">
                  E-mail *
                </label>
                <input
                  required
                  type="email"
                  value={novoForm.email}
                  onChange={e => setNovoForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="usuario@escritorio.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#1D5F60] focus:ring-2 focus:ring-[#1D5F60]/10 bg-[#fafbfc] placeholder:text-[#d1d5db]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1.5">
                    Perfil *
                  </label>
                  <div className="relative">
                    <select
                      value={novoForm.role}
                      onChange={e => setNovoForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                      className="w-full appearance-none pl-3.5 pr-8 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#1D5F60] bg-white cursor-pointer"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1.5">
                    Senha provisória *
                  </label>
                  <input
                    required
                    type="password"
                    minLength={6}
                    value={novoForm.senha}
                    onChange={e => setNovoForm(prev => ({ ...prev, senha: e.target.value }))}
                    placeholder="Mín. 6 caracteres"
                    className="w-full px-3.5 py-2.5 text-sm border border-[#e5e7eb] rounded-xl outline-none focus:border-[#1D5F60] focus:ring-2 focus:ring-[#1D5F60]/10 bg-[#fafbfc] placeholder:text-[#d1d5db]"
                  />
                </div>
              </div>

              <p className="text-[11px] text-[#9ca3af]">
                O usuário receberá acesso imediato. Use "Redefinir senha" depois para enviar e-mail de troca.
              </p>

              {flash && !flash.ok && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-xl">
                  <X size={13} /> {flash.msg}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#1D5F60] hover:bg-[#27777A] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Criando...
                    </span>
                  ) : (
                    'Criar Usuário'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFlash(null) }}
                  className="px-4 py-2.5 text-sm text-[#6b7280] hover:text-[#1a1d23] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
