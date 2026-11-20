import { ExternalLink, FileText, FolderOpen } from 'lucide-react'
import { pastaDropboxDoCliente } from '@/lib/portal-cliente/pasta-dropbox'
import { exigirSessaoPortal, dataCurta } from '@/lib/portal-cliente/pagina'
import { listarProcessosDoCliente } from '@/lib/portal-cliente/consultas'
import { listarEnviosDoCliente, tamanhoLegivel } from '@/lib/portal-cliente/envios'
import EmptyState from '../_components/EmptyState'
import EmBreve from '../_components/EmBreve'
import { PortalIndisponivel } from '@/lib/portal-cliente/segredos'
import EnviarDocumento from './EnviarDocumento'

export default async function PortalDocumentosPage() {
  const { session, db } = await exigirSessaoPortal()

  let envios: Awaited<ReturnType<typeof listarEnviosDoCliente>>
  try {
    envios = await listarEnviosDoCliente(db, session.clienteId)
  } catch (e) {
    // Migração ainda não aplicada → mantém a tela antiga ("em breve") em vez de quebrar.
    if (e instanceof PortalIndisponivel) return <EmBreve titulo="Documentos" />
    throw e
  }
  const pastaDropbox = await pastaDropboxDoCliente(db, session.clienteId)
  const processos = (await listarProcessosDoCliente(db, session.clienteId)).map(p => ({ id: p.id, rotulo: [p.numero, p.titulo].filter(Boolean).join(' · ') || 'Processo' }))

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <p className="text-[10px] text-[#9CA3AF] tracking-[0.2em] uppercase mb-1">Portal</p>
        <h1 className="text-[26px] sm:text-[28px] text-[#1C1C2E] leading-none tracking-tight" style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}>
          Documentos
        </h1>
        <p className="text-[12px] text-[#6B7280] mt-2">Envie aqui os documentos que o escritório pediu (ou que você queira nos mostrar). Tudo fica guardado e a equipe é quem recebe.</p>
      </div>

      {pastaDropbox && (
        <div className="bg-white border border-[#E8E3D8] px-4 py-4 flex items-start gap-3">
          <FolderOpen size={18} className="text-[#C49557] mt-0.5 shrink-0" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-[#1C1C2E] font-medium">Sua pasta no Dropbox</p>
            <p className="text-[12px] text-[#6B7280] mt-0.5">Os documentos do escritório compartilhados com você ficam nesta pasta.</p>
            <a
              href={pastaDropbox}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 bg-[#145A5B] px-3.5 py-2 text-[12px] font-medium text-white hover:bg-[#1B6E70]"
            >
              Abrir minha pasta <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      <EnviarDocumento processos={processos} somenteLeitura={!!session.previa} />

      <div>
        <p className="text-[11px] text-[#9CA3AF] tracking-[0.15em] uppercase mb-2">Enviados por você</p>
        {envios.length === 0 ? (
          <EmptyState icon={FileText} titulo="Nenhum documento enviado ainda" descricao="Os arquivos que você enviar aparecem aqui." />
        ) : (
          <ul className="bg-white border border-[#E8E3D8] divide-y divide-[#EDE8DF]">
            {envios.map(e => (
              <li key={e.id} className="px-4 py-3 flex items-start gap-3">
                <FileText size={15} className="text-[#C49557] mt-0.5 shrink-0" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-[#1C1C2E] break-words">{e.nome}</p>
                  <p className="text-[11px] text-[#9CA3AF]">
                    {dataCurta(e.enviadoEm.slice(0, 10))}{e.tamanho ? ` · ${tamanhoLegivel(e.tamanho)}` : ''}{e.processoNumero ? ` · Processo ${e.processoNumero}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
