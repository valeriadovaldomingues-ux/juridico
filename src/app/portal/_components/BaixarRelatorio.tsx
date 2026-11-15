import { FileDown } from 'lucide-react'

/** Link de download do relatório em PDF (processos visíveis do cliente). É um link simples: funciona sem JavaScript. */
export default function BaixarRelatorio({ compacto = false }: { compacto?: boolean }) {
  return (
    <a
      href="/api/portal/relatorio"
      download
      className={`inline-flex items-center justify-center gap-2 bg-[#0C1B2A] text-white hover:bg-[#13283D] transition-colors tracking-[0.08em] uppercase font-medium ${
        compacto ? 'text-[10px] px-3 py-2' : 'text-[11px] px-4 py-3'
      }`}
    >
      <FileDown size={compacto ? 12 : 14} />
      Baixar relatório (PDF)
    </a>
  )
}
