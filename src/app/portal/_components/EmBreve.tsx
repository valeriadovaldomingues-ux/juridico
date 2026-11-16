import Link from 'next/link'
import { Clock } from 'lucide-react'
import EmptyState from './EmptyState'

export default function EmBreve({ titulo }: { titulo: string }) {
  return (
    <div className="space-y-5 max-w-xl">
      <EmptyState icon={Clock} titulo={`${titulo}: em breve`} descricao="Esta área ainda não está disponível. Por enquanto, fale com o escritório se precisar." />
      <Link href="/portal" className="text-[11px] text-[#C49557] tracking-wider uppercase hover:underline">Voltar ao início</Link>
    </div>
  )
}
