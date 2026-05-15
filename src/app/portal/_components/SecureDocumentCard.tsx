import { Download, FileText } from 'lucide-react'

interface Props {
  id:            string
  nome:          string
  tipo?:         string | null
  data:          string
  processoRef?:  string | null  // número ou título do processo vinculado
}

/**
 * Card de documento com download via signed URL.
 * O href aponta para o endpoint server-side que gera o redirect 302.
 * Nunca expõe storage_path ou signed URL no markup.
 */
export default function SecureDocumentCard({ id, nome, tipo, data, processoRef }: Props) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#FDFAF7] transition-colors duration-150 group">

      {/* Ícone */}
      <div className="w-8 h-8 border border-[#E8E3D8] group-hover:border-[#C49557]/30 flex items-center justify-center shrink-0 transition-colors duration-200">
        <FileText size={13} className="text-[#C49557]" strokeWidth={1.5} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[#1C1C2E] truncate">{nome}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {tipo && (
            <span className="text-[10px] text-[#9CA3AF] tracking-wide">{tipo}</span>
          )}
          {tipo && processoRef && <span className="text-[10px] text-[#DDD8D0]">·</span>}
          {processoRef && (
            <span className="text-[10px] text-[#9CA3AF] tracking-wide truncate">{processoRef}</span>
          )}
        </div>
      </div>

      {/* Data */}
      <span className="text-[10px] text-[#C5C0B8] shrink-0 tabular-nums hidden sm:block">
        {new Date(data).toLocaleDateString('pt-BR')}
      </span>

      {/* Botão de download — redireciona para signed URL via server */}
      <a
        href={`/api/portal/documentos?download=${id}`}
        className="flex items-center gap-1.5 text-[10px] text-white bg-[#C49557] hover:bg-[#A8803D] px-3 py-1.5 tracking-[0.1em] uppercase transition-colors duration-200 shrink-0"
        aria-label={`Baixar ${nome}`}
      >
        <Download size={10} />
        <span className="hidden sm:inline">Baixar</span>
      </a>

    </div>
  )
}
