import AuroraClienteHistoricoList from '@/components/aurora-cliente/AuroraClienteHistoricoList'
import type { AuroraClienteConversa } from '@/lib/aurora-cliente'

export default function AuroraClienteTab({
  historico,
}: {
  historico: AuroraClienteConversa[]
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#E8E3D8] bg-white p-5 shadow-sm">
        <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase">Aurora Cliente</p>
        <h3 className="mt-1 text-[16px] font-semibold text-[#1C1C2E]">Histórico de perguntas do portal</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6B7280]">
          Registros do que o cliente perguntou, da resposta gerada e do status de encaminhamento.
        </p>
      </div>

      <AuroraClienteHistoricoList items={historico} showAuthor />
    </div>
  )
}
