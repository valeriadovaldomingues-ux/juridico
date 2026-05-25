import type { Metadata } from 'next'
import { Cormorant_Garamond } from 'next/font/google'
import DiagnosticoNR1 from './DiagnosticoNR1'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-serif',
})

export const metadata: Metadata = {
  title: 'Diagnóstico de Riscos Psicossociais NR-1 — Pessoa e do Val Advocacia',
  description:
    'Avalie em 5 a 8 minutos os riscos psicossociais da sua empresa conforme a NR-1 atualizada. Diagnóstico gratuito em 8 fatores com recomendações prioritárias.',
}

export default function DiagnosticoPage() {
  return (
    <div className={cormorant.variable}>
      <DiagnosticoNR1 />
    </div>
  )
}
