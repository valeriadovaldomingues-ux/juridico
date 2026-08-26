'use client'

import { useEffect, useState } from 'react'
import { Archive, RotateCcw, X } from 'lucide-react'
import { getKanbanTasks, setTaskArquivado } from '@/lib/kanban.service'
import type { KanbanTask } from '@/types/kanban'

function fmt(iso?: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export default function ArquivadasModal({
  onClose,
  onRestored,
}: {
  onClose: () => void
  onRestored: () => void
}) {
  const [tasks,      setTasks]      = useState<KanbanTask[]>([])
  const [loading,    setLoading]    = useState(true)
  const [erro,       setErro]       = useState('')
  const [restaurando, setRestaurando] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getKanbanTasks({ arquivadas: true })
      .then(data => { if (!cancelled) setTasks(data) })
      .catch(() => { if (!cancelled) setErro('Erro ao carregar tarefas arquivadas.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleRestaurar(id: string) {
    setRestaurando(id)
    try {
      await setTaskArquivado(id, false)
      setTasks(prev => prev.filter(t => t.id !== id))
      onRestored()
    } catch {
      setErro('Erro ao restaurar tarefa. Tente novamente.')
    } finally {
      setRestaurando(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F4F4]">
          <div className="flex items-center gap-2.5">
            <Archive size={15} className="text-[var(--color-ink-3)]" />
            <div>
              <h2 className="text-[15px] font-semibold text-[#0f1923]">Tarefas arquivadas</h2>
              <p className="text-[11.5px] text-[#9aabb8]">
                Backlog antigo sem prazo/SLA definido, retirado do quadro em massa.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#9aabb8] hover:text-[#4a5a6a] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-6 py-10 text-center text-[13px] text-[#9aabb8]">Carregando…</p>
          ) : erro ? (
            <p className="px-6 py-10 text-center text-[13px] text-rose-600">{erro}</p>
          ) : tasks.length === 0 ? (
            <p className="px-6 py-10 text-center text-[13px] text-[#9aabb8]">Nenhuma tarefa arquivada.</p>
          ) : (
            <div className="divide-y divide-[#F7F9F9]">
              {tasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#0f1923] truncate">{task.titulo}</p>
                    <p className="text-[11px] text-[#9aabb8] mt-0.5">
                      Arquivada em {fmt(task.arquivado_em)}
                      {task.responsavel?.nome ? ` · ${task.responsavel.nome}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestaurar(task.id)}
                    disabled={restaurando === task.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2DDD8] text-[12px] font-medium text-[#4a5a6a] hover:bg-[#F3F1EE] transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    <RotateCcw size={12} />
                    {restaurando === task.id ? 'Restaurando…' : 'Reabrir'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
