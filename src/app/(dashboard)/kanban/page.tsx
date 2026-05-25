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
    <main className="internal-page min-h-screen">
      <div className="mx-auto max-w-[1600px]">

        {/* Cabeçalho da página */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 sm:px-7 sm:py-6 shadow-[0_18px_48px_rgba(13,34,53,0.06)] mb-8">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[var(--color-petrol-light)] to-transparent pointer-events-none" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-copper)] mb-2">
                Gestão de tarefas
              </p>
              <h1 className="font-brand text-[34px] font-semibold text-[var(--color-ink)] tracking-tight leading-none">
                Kanban Jurídico
              </h1>
              <p className="mt-2 max-w-3xl text-[13px] text-[var(--color-ink-3)]">
                Visualização profissional das tarefas do escritório, com quadro
                pessoal por status e quadro geral por responsável.
              </p>
            </div>

            {/* Botão fixo de importação */}
            <div className="shrink-0 pt-2">
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-sidebar)] border border-[var(--color-sidebar)] text-white text-[13px] font-semibold rounded-xl hover:bg-[var(--color-petrol)] transition-colors shadow-sm"
                title="Importar tarefas a partir de CSV exportado do Trello"
              >
                <Upload size={14} className="text-[var(--color-gold-light)]" />
                Importar CSV do Trello
              </button>
            </div>
          </div>
        </div>

        {/* Quadro pessoal */}
        <section className="mb-10">
          <div className="mb-4 border-l-2 border-[var(--color-copper)] pl-4">
            <h2 className="font-brand text-[25px] font-semibold text-[var(--color-ink)]">Meu quadro</h2>
            <p className="text-[13px] text-[var(--color-ink-3)]">
              Tarefas do usuário logado agrupadas por status.
            </p>
          </div>
          <KanbanBoard key={`personal-${refreshKey}`} view="personal" />
        </section>

        {/* Quadro geral */}
        <section>
          <div className="mb-4 border-l-2 border-[var(--color-copper)] pl-4">
            <h2 className="font-brand text-[25px] font-semibold text-[var(--color-ink)]">
              Quadro geral do escritório
            </h2>
            <p className="text-[13px] text-[var(--color-ink-3)]">
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
