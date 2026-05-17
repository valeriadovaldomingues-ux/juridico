'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, ExternalLink, X } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types/automations'

const TYPE_STYLE: Record<string, string> = {
  info:     'bg-blue-50   border-blue-100   text-blue-700',
  warning:  'bg-amber-50  border-amber-100  text-amber-700',
  critical: 'bg-red-50    border-red-100    text-red-700',
  success:  'bg-emerald-50 border-emerald-100 text-emerald-700',
}

const TYPE_DOT: Record<string, string> = {
  info:     'bg-blue-400',
  warning:  'bg-amber-400',
  critical: 'bg-red-500',
  success:  'bg-emerald-400',
}

function fmtRelativo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const horas = Math.floor(diff / 3_600_000)
  if (mins < 1)   return 'agora'
  if (mins < 60)  return `${mins}min`
  if (horas < 24) return `${horas}h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function NotificationBell() {
  const [open,         setOpen]         = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread,       setUnread]       = useState(0)
  const [loading,      setLoading]      = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fechar ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Buscar notificações não lidas ao montar
  useEffect(() => {
    fetchNotifications()
    // Polling leve: a cada 2 min apenas atualiza o contador
    const id = setInterval(() => fetchUnreadCount(), 120_000)
    return () => clearInterval(id)
  }, [])

  async function fetchUnreadCount() {
    try {
      const res = await fetch('/api/notifications?unread=true&limit=1')
      if (!res.ok) return
      const data = await res.json()
      // Aproximação: se retornou pelo menos 1, busca count real
      if (Array.isArray(data)) {
        const countRes = await fetch('/api/notifications?unread=true&limit=99')
        if (countRes.ok) {
          const all = await countRes.json()
          setUnread(Array.isArray(all) ? all.length : 0)
        }
      }
    } catch { /* silent */ }
  }

  async function fetchNotifications() {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=15')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) {
        setNotifications(data)
        setUnread(data.filter((n: Notification) => !n.is_read).length)
      }
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnread(0)
  }

  function handleOpen() {
    setOpen(v => !v)
    if (!open) fetchNotifications()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center transition-all relative',
          open
            ? 'text-[#0F3D3E] bg-[#E8F2F2]'
            : 'text-[#7a8899] hover:text-[#0f1923] hover:bg-[#F7F9F9]',
        )}
        title="Notificações"
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-lg shadow-xl border border-[#E8F0F0] z-50 overflow-hidden">

          {/* Header do dropdown */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0F4F4]">
            <span className="text-[13px] font-semibold text-[#0f1923]">Notificações</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-[#1D5F60] hover:underline font-medium"
                >
                  <Check size={10} /> Marcar todas como lidas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-[#9ca3af] hover:text-[#374151]">
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="text-[12px] text-[#9ca3af] text-center py-6">Carregando…</p>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell size={24} className="text-[#D0DCDC] mx-auto mb-2" />
                <p className="text-[12px] text-[#9ca3af]">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    'flex gap-2.5 px-4 py-3 border-b border-[#F9FAFB] hover:bg-[#FAFBFB] transition-colors',
                    !n.is_read && 'bg-[#FAFFFE]',
                  )}
                >
                  <div className="mt-1.5 flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full ${n.is_read ? 'bg-[#D0DCDC]' : TYPE_DOT[n.type] ?? 'bg-blue-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-[12px] font-semibold truncate', !n.is_read ? 'text-[#0f1923]' : 'text-[#374151]')}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-[#7a8899] line-clamp-2 mt-0.5">{n.message}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-[#9ca3af]">{fmtRelativo(n.created_at)}</span>
                      {n.link && (
                        <Link href={n.link} onClick={() => setOpen(false)} className="text-[10px] text-[#1D5F60] hover:underline flex items-center gap-0.5">
                          Ver <ExternalLink size={9} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-[#F0F4F4] bg-[#FAFBFB]">
            <Link
              href="/automacoes"
              onClick={() => setOpen(false)}
              className="text-[11px] text-[#1D5F60] font-medium hover:underline"
            >
              Ver automações →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
