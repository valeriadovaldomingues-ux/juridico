import { requireRole } from '@/lib/auth/guards'
import Link from 'next/link'
import { FileText, Newspaper, Bot, ArrowRight, Sparkles, FolderArchive } from 'lucide-react'
import TestePublicacaoIA from './TestePublicacaoIA'

const modulos = [
  {
    href:   '/ia-juridica/aurora',
    icon:   Sparkles,
    cor:    { bg: 'bg-[#0B1C2D]', icon: 'text-[#C49557]', btn: 'text-[#A07840]', hover: 'hover:border-[#C49557] hover:shadow-[0_4px_20px_rgba(196,149,87,0.16)]' },
    titulo: 'Aurora',
    desc:   'Assistente executiva jurídica dos sócios, voltada a análise estratégica, priorização de urgências, riscos e planos de ação.',
    tags:   ['Exclusivo sócios', 'Estratégia', 'Riscos', 'Providências'],
    socioOnly: true,
  },
  {
    href:   '/dashboard/central-arquivos',
    icon:   FolderArchive,
    cor:    { bg: 'bg-slate-50', icon: 'text-slate-700', btn: 'text-slate-700', hover: 'hover:border-slate-300 hover:shadow-[0_4px_20px_rgba(15,23,42,0.08)]' },
    titulo: 'Dossiê Aurora',
    desc:   'Junte documentos, fotos, áudios, prints, certidões, contratos e demais arquivos para que a Aurora analise o caso com base no material enviado.',
    tags:   ['Arquivos', 'Análise futura', 'Sócios', 'Contexto jurídico'],
    socioOnly: true,
  },
  {
    href:   '/ia-juridica/peca',
    icon:   FileText,
    cor:    { bg: 'bg-[#E8F2F2]', icon: 'text-[#1D5F60]', btn: 'text-[#1D5F60]', hover: 'hover:border-[#145A5B] hover:shadow-[0_4px_20px_rgba(20,90,91,0.1)]' },
    titulo: 'Gerar Peça Jurídica',
    desc:   'Selecione o processo e o tipo de documento. A IA redigirá a peça completa com fundamentos legais, qualificação das partes e pedidos estruturados.',
    tags:   ['Petição Inicial', 'Contestação', 'Recurso', 'Memoriais'],
    socioOnly: false,
  },
  {
    href:   '/ia-juridica/publicacao',
    icon:   Newspaper,
    cor:    { bg: 'bg-violet-50', icon: 'text-violet-600', btn: 'text-violet-600', hover: 'hover:border-violet-300 hover:shadow-[0_4px_20px_rgba(109,40,217,0.08)]' },
    titulo: 'Analisar Publicação',
    desc:   'Selecione uma publicação do DJe. A IA extrai o resumo, identifica prazos e sugere a próxima ação processual com avaliação de urgência.',
    tags:   ['Resumo', 'Prazo', 'Urgência', 'Ação sugerida'],
    socioOnly: false,
  },
  {
    href:   '/ia-juridica/assistente',
    icon:   Bot,
    cor:    { bg: 'bg-amber-50', icon: 'text-amber-600', btn: 'text-amber-600', hover: 'hover:border-amber-300 hover:shadow-[0_4px_20px_rgba(217,119,6,0.08)]' },
    titulo: 'Assistente Jurídico',
    desc:   'Faça perguntas jurídicas em linguagem natural. Vincule opcionalmente a um processo para respostas contextualizadas com os dados do caso.',
    tags:   ['Consulta livre', 'Contexto de processo', 'Doutrina', 'Jurisprudência'],
    socioOnly: false,
  },
]

export default async function IAJuridicaPage() {
  // Sincronizado com ALLOWED_ROUTES: advogado, gerente, socio.
  const { profile } = await requireRole(['advogado', 'gerente', 'socio'])
  // Verificação feita no servidor — OPENAI_API_KEY nunca é exposta ao cliente
  const iaConfigurada = !!process.env.OPENAI_API_KEY
  const modulosVisiveis = modulos.filter(mod => !mod.socioOnly || profile.role === 'socio')

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight flex items-center gap-2">
            IA Jurídica
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1D5F60] bg-[#E8F2F2] px-2 py-0.5 rounded-full uppercase tracking-wider">
              <Sparkles size={9} /> Beta
            </span>
          </h1>
          <p className="text-[13px] text-[#7a8899] mt-0.5">
            Assistente inteligente integrado ao seu escritório
          </p>
        </div>
      </div>

      {/* Cards dos módulos */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {modulosVisiveis.map((mod) => {
          const Icon = mod.icon
          const actionLabel = mod.href === '/dashboard/central-arquivos' ? 'Abrir Dossiê' : 'Acessar'
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className={`group bg-white rounded-lg border border-[#E2DDD8] p-6 flex flex-col gap-4 transition-all duration-200 ${mod.cor.hover}`}
            >
              <div className={`w-11 h-11 rounded-xl ${mod.cor.bg} flex items-center justify-center`}>
                <Icon size={20} className={mod.cor.icon} />
              </div>

              <div className="flex-1">
                <h2 className="text-[15px] font-semibold text-[#0f1923] mb-2 leading-tight">
                  {mod.titulo}
                </h2>
                <p className="text-[12px] text-[#7a8899] leading-relaxed">
                  {mod.desc}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {mod.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-[10px] font-medium text-[#9ca3af] bg-[#f9fafb] px-2 py-0.5 rounded-full ring-1 ring-[#f3f4f6]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${mod.cor.btn} group-hover:underline`}>
                {actionLabel} <ArrowRight size={13} />
              </div>
            </Link>
          )
        })}
      </div>

      {/* Seção de teste de publicação */}
      {iaConfigurada && (
        <>
          <hr className="border-[#f3f4f6]" />
          <TestePublicacaoIA />
        </>
      )}

      {/* Aviso de configuração — exibido apenas se OPENAI_API_KEY não estiver definida no servidor */}
      {!iaConfigurada && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
          <p className="text-[12px] text-amber-800 leading-relaxed">
            <strong>Configuração necessária:</strong> adicione{' '}
            <code className="font-mono bg-amber-100 px-1 rounded">OPENAI_API_KEY=sua_chave</code>{' '}
            ao arquivo <code className="font-mono bg-amber-100 px-1 rounded">.env.local</code>{' '}
            e reinicie o servidor para ativar as funcionalidades de IA.
          </p>
        </div>
      )}

    </div>
  )
}
