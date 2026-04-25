import Link from 'next/link'
import { FileText, Newspaper, Bot, ArrowRight, Sparkles } from 'lucide-react'
import TestePublicacaoIA from './TestePublicacaoIA'

const modulos = [
  {
    href:   '/ia-juridica/peca',
    icon:   FileText,
    cor:    { bg: 'bg-[#E8F0F0]', icon: 'text-[#145A5B]', btn: 'text-[#145A5B]', hover: 'hover:border-[#145A5B] hover:shadow-[0_4px_20px_rgba(20,90,91,0.1)]' },
    titulo: 'Gerar Peça Jurídica',
    desc:   'Selecione o processo e o tipo de documento. A IA redigirá a peça completa com fundamentos legais, qualificação das partes e pedidos estruturados.',
    tags:   ['Petição Inicial', 'Contestação', 'Recurso', 'Memoriais'],
  },
  {
    href:   '/ia-juridica/publicacao',
    icon:   Newspaper,
    cor:    { bg: 'bg-violet-50', icon: 'text-violet-600', btn: 'text-violet-600', hover: 'hover:border-violet-300 hover:shadow-[0_4px_20px_rgba(109,40,217,0.08)]' },
    titulo: 'Analisar Publicação',
    desc:   'Selecione uma publicação do DJe. A IA extrai o resumo, identifica prazos e sugere a próxima ação processual com avaliação de urgência.',
    tags:   ['Resumo', 'Prazo', 'Urgência', 'Ação sugerida'],
  },
  {
    href:   '/ia-juridica/assistente',
    icon:   Bot,
    cor:    { bg: 'bg-amber-50', icon: 'text-amber-600', btn: 'text-amber-600', hover: 'hover:border-amber-300 hover:shadow-[0_4px_20px_rgba(217,119,6,0.08)]' },
    titulo: 'Assistente Jurídico',
    desc:   'Faça perguntas jurídicas em linguagem natural. Vincule opcionalmente a um processo para respostas contextualizadas com os dados do caso.',
    tags:   ['Consulta livre', 'Contexto de processo', 'Doutrina', 'Jurisprudência'],
  },
]

export default function IAJuridicaPage() {
  // Verificação feita no servidor — OPENAI_API_KEY nunca é exposta ao cliente
  const iaConfigurada = !!process.env.OPENAI_API_KEY

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0f1923] tracking-tight flex items-center gap-2">
            IA Jurídica
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#145A5B] bg-[#E8F0F0] px-2 py-0.5 rounded-full uppercase tracking-wider">
              <Sparkles size={9} /> Beta
            </span>
          </h1>
          <p className="text-[13px] text-[#7a8899] mt-0.5">
            Assistente inteligente integrado ao seu escritório
          </p>
        </div>
      </div>

      {/* Cards dos módulos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modulos.map((mod) => {
          const Icon = mod.icon
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className={`group bg-white rounded-2xl border border-[#D0DCDC] p-6 flex flex-col gap-4 transition-all duration-200 ${mod.cor.hover}`}
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
                Acessar <ArrowRight size={13} />
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
