import type { Metadata } from 'next'
import DiagnosticoNR1 from './DiagnosticoNR1'

export const metadata: Metadata = {
  title: 'Diagnóstico de Riscos Psicossociais NR-1 — Pessoa e do Val Advocacia',
  description:
    'Avalie em 5 a 8 minutos os riscos psicossociais da sua empresa conforme a NR-1 atualizada. Diagnóstico gratuito em 8 fatores com recomendações prioritárias.',
}

export default function DiagnosticoPage() {
  return (
    <div>
      <DiagnosticoNR1 />
    </div>
  )
}
