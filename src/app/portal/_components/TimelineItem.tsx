'use client'

import { useState } from 'react'

interface Props {
  data:      string | null   // ISO date
  titulo:    string          // texto amigável
  subtitulo?: string         // ex: número do processo, tipo
  detalhe?:  string          // texto completo; quando houver, o item abre ao clicar
  tipo:      'publicacao' | 'audiencia' | 'prazo' | 'documento' | 'distribuicao' | 'mensagem'
  alerta?:   boolean         // prazo urgente / audiência próxima
  last?:     boolean         // não renderiza linha de conexão abaixo
}

const TIPO_CONFIG = {
  publicacao:   { dot: 'bg-[#C49557]',    ring: 'ring-[#C49557]/20'    },
  audiencia:    { dot: 'bg-[#0C1B2A]',    ring: 'ring-[#0C1B2A]/10'   },
  prazo:        { dot: 'bg-amber-500',     ring: 'ring-amber-200'       },
  documento:    { dot: 'bg-[#9CA3AF]',    ring: 'ring-[#E8E3D8]'      },
  distribuicao: { dot: 'bg-emerald-500',  ring: 'ring-emerald-100'     },
  mensagem:     { dot: 'bg-[#C49557]/60', ring: 'ring-[#C49557]/10'   },
} satisfies Record<string, { dot: string; ring: string }>

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function formatarData(iso: string) {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  return `${String(d.getDate()).padStart(2,'0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

export default function TimelineItem({ data, titulo, subtitulo, detalhe, tipo, alerta, last }: Props) {
  const cfg = TIPO_CONFIG[tipo]
  const [aberto, setAberto] = useState(false)
  // Só vira clicável quando o texto não cabe nas 3 linhas do resumo.
  const abrivel = !!detalhe && (detalhe.length > 200 || detalhe.includes('\n'))
  const conteudo = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className={`block text-[12px] leading-snug font-medium ${alerta ? 'text-amber-700' : 'text-[#1C1C2E]'}`}>
          {titulo}
        </span>
        {data && (
          <span className="text-[10px] text-[#C5C0B8] shrink-0 tabular-nums mt-0.5">
            {formatarData(data)}
          </span>
        )}
      </span>
      {detalhe ? (
        <>
          <span className={`block text-[10px] text-[#9CA3AF] mt-0.5 tracking-wide whitespace-pre-line break-words ${abrivel && !aberto ? 'line-clamp-3' : ''}`}>{detalhe}</span>
          {abrivel && <span className="inline-block mt-1 text-[10px] text-[#C49557] tracking-wide">{aberto ? 'Recolher' : 'Ver completo'}</span>}
        </>
      ) : subtitulo ? (
        <p className="text-[10px] text-[#9CA3AF] mt-0.5 tracking-wide">{subtitulo}</p>
      ) : null}
    </>
  )

  return (
    <div className="flex gap-4">

      {/* Coluna do dot + linha */}
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <span className={`w-2.5 h-2.5 rounded-full ring-4 ${cfg.dot} ${cfg.ring} ${alerta ? 'ring-amber-200' : ''} shrink-0`} />
        {!last && <span className="w-px flex-1 bg-[#F0EBE4] mt-1.5" />}
      </div>

      {/* Conteúdo */}
      <div className={`flex-1 min-w-0 ${last ? 'pb-0' : 'pb-5'}`}>
        {abrivel ? (
          <button
            type="button"
            onClick={() => setAberto(v => !v)}
            aria-expanded={aberto}
            className="block w-full text-left cursor-pointer"
          >
            {conteudo}
          </button>
        ) : conteudo}
      </div>

    </div>
  )
}
