'use client'

import { useState, useCallback } from 'react'
import nextDynamic from 'next/dynamic'
import { Upload } from 'lucide-react'
import TrelloCsvImportModal from '@/components/kanban/TrelloCsvImportModal'

// KanbanBoard usa DnD Kit — evitar mismatch de hidratação no SSR
const KanbanBoard = nextDynamic(
  () => import('@/components/kanban/KanbanBoard'),
  { ssr: false }
)

export default function KanbanPage() {
  const [showImport,  setShowImport]  = useState(false)
  const [refreshKey,  setRefreshKey]  = useState(0)

  const handleImportDone = useCallback(async () => {
    // Força remount dos dois boards para recarregar dados frescos
    setRefreshKey(k => k + 1)
  }, [])

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-[1600px]">

        {/* Cabeçalho da página */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
              Gestão de tarefas
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
              Kanban Jurídico
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Visualização profissional das tarefas do escritório, com quadro
              pessoal por status e quadro geral por responsável.
            </p>
          </div>

          {/* Botão fixo de importação */}
          <div className="shrink-0 pt-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#e5e7eb] text-[#374151] text-[13px] font-semibold rounded-xl hover:bg-[#f9fafb] transition-colors shadow-sm"
              title="Importar tarefas a partir de CSV exportado do Trello"
            >
              <Upload size={14} className="text-[#145A5B]" />
              Importar CSV do Trello
            </button>
          </div>
        </div>

        {/* Quadro pessoal */}
        <section className="mb-10">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-zinc-900">Meu quadro</h2>
            <p className="text-sm text-zinc-500">
              Tarefas do usuário logado agrupadas por status.
            </p>
          </div>
          <KanbanBoard key={`personal-${refreshKey}`} view="personal" />
        </section>

        {/* Quadro geral */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-zinc-900">
              Quadro geral do escritório
            </h2>
            <p className="text-sm text-zinc-500">
              Tarefas agrupadas por responsável.
            </p>
          </div>
          <KanbanBoard key={`office-${refreshKey}`} view="office" />
        </section>
      </div>

      {/* Modal de importação */}
      {showImport && (
        <TrelloCsvImportModal
          onClose={() => setShowImport(false)}
          onImportDone={handleImportDone}
        />
      )}
    </main>
  )
}
