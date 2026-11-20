import { FolderUp, FileText } from 'lucide-react'
import { tamanhoLegivel, type EnvioParaEquipe } from '@/lib/portal-cliente/envios'

const dataHora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))

/** Documentos que o cliente enviou pelo portal (chegam direto à equipe). Server component: só lista e linka o download. */
export default function DocumentosDoPortalCard({ envios }: { envios: EnvioParaEquipe[] }) {
  const novos = envios.filter(e => !e.visto).length
  return (
    <div className="bg-white rounded-lg border border-[#E2DDD8] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-3">
      <p className="text-[11px] font-semibold text-[#a8b3c4] uppercase tracking-wider flex items-center gap-1.5">
        <FolderUp size={12} /> Documentos enviados pelo cliente
        {novos > 0 && <span className="ml-1 rounded-full bg-[#C49557] px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-white">{novos} {novos === 1 ? 'novo' : 'novos'}</span>}
      </p>
      {envios.length === 0 ? (
        <p className="text-[12px] text-[#7a8899]">Nada enviado pelo portal até agora.</p>
      ) : (
        <ul className="divide-y divide-[#EDE8DF]">
          {envios.map(e => (
            <li key={e.id} className="py-2 flex items-start gap-2">
              <FileText size={13} className="mt-0.5 shrink-0 text-[#a8b3c4]" />
              <div className="min-w-0 flex-1">
                <a href={`/api/portal-admin/envios/${e.id}/download`} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-[#145A5B] hover:underline break-words">{e.nome}</a>
                {!e.visto && <span className="ml-2 text-[10px] font-semibold text-[#C49557] uppercase tracking-wide">novo</span>}
                <p className="text-[11px] text-[#7a8899]">
                  {dataHora(e.enviadoEm)}{e.tamanho ? ` · ${tamanhoLegivel(e.tamanho)}` : ''}{e.processoNumero ? ` · Processo ${e.processoNumero}` : ''}
                </p>
                {e.descricao && <p className="text-[12px] text-[#3d4a5c] break-words">“{e.descricao}”</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
