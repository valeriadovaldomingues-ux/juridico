import { Hourglass, TriangleAlert } from 'lucide-react'

export function AvisoAguardandoAtivacao() {
  return (
    <div className="max-w-xl mx-auto mt-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-8 text-center shadow-[0_12px_36px_rgba(13,34,53,0.05)]">
      <div className="mx-auto mb-4 w-11 h-11 rounded-xl bg-[var(--color-gold-light)] border border-[var(--color-border)] flex items-center justify-center">
        <Hourglass size={20} className="text-[var(--color-copper)]" strokeWidth={1.5} />
      </div>
      <h1 className="font-brand text-[26px] font-semibold text-[var(--color-ink)] leading-tight">CRM Cris e Val</h1>
      <p className="mt-2 text-[13px] font-semibold text-[var(--color-copper)] uppercase tracking-[0.14em]">Módulo aguardando ativação</p>
      <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
        A tela já está pronta, mas as tabelas do módulo ainda não foram criadas no banco de dados.
        Assim que a ativação for autorizada e feita, o funil de oportunidades e as propostas de honorários aparecem aqui.
      </p>
      <p className="mt-3 text-[12px] text-[var(--color-ink-3)]">Nada foi perdido: ainda não existe nenhum dado deste módulo.</p>
    </div>
  )
}

export function AvisoErroCarregamento() {
  return (
    <div className="max-w-xl mx-auto mt-10 rounded-2xl border border-red-200 bg-red-50 px-6 py-6 text-center">
      <TriangleAlert size={20} className="mx-auto mb-2 text-red-600" />
      <p className="text-[14px] font-semibold text-red-800">Não foi possível carregar o CRM Cris e Val.</p>
      <p className="mt-1 text-[12px] text-red-700">Recarregue a página. Se continuar, avise o suporte.</p>
    </div>
  )
}
