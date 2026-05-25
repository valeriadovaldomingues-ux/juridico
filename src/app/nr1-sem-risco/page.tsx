import type { Metadata } from 'next'
import { Cormorant_Garamond } from 'next/font/google'
import ContactForm from './ContactForm'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-serif',
})

export const metadata: Metadata = {
  title: 'NR-1 sem Risco — Pessoa e do Val Advocacia',
  description:
    'Diagnóstico Jurídico-Preventivo NR-1. Identifique e gerencie riscos psicossociais antes que virem passivo trabalhista. Assessoria especializada em conformidade com a NR-1.',
}

const WA =
  'https://wa.me/5531971766583?text=Olá,%20gostaria%20de%20saber%20mais%20sobre%20o%20Diagnóstico%20NR-1'

const RISCOS = [
  {
    titulo: 'Assédio Moral',
    descricao:
      'Condutas abusivas repetidas que degradam o ambiente de trabalho e afetam a dignidade do trabalhador.',
  },
  {
    titulo: 'Metas Abusivas',
    descricao:
      'Cobrança excessiva por resultados que gera pressão desproporcional e comprometimento da saúde mental.',
  },
  {
    titulo: 'Sobrecarga de Trabalho',
    descricao:
      'Volume de tarefas além da capacidade razoável, gerando esgotamento físico e psíquico.',
  },
  {
    titulo: 'Jornadas Excessivas',
    descricao:
      'Horas de trabalho além dos limites legais, impedindo a recuperação adequada do trabalhador.',
  },
  {
    titulo: 'Liderança Tóxica',
    descricao:
      'Gestão baseada em humilhação, favoritismo ou autoritarismo que afeta a saúde de toda a equipe.',
  },
  {
    titulo: 'Conflitos Internos',
    descricao:
      'Disputas não mediadas entre equipes ou indivíduos que deterioram o clima organizacional.',
  },
  {
    titulo: 'Ambiente Hostil',
    descricao:
      'Condições de trabalho que geram medo, insegurança ou discriminação de forma sistemática.',
  },
]

const ETAPAS = [
  {
    num: '01',
    titulo: 'Questionário Inicial',
    desc: 'Levantamento estruturado sobre práticas de gestão, clima organizacional e processos internos.',
  },
  {
    num: '02',
    titulo: 'Mapeamento dos Riscos',
    desc: 'Identificação e classificação dos riscos psicossociais presentes no ambiente de trabalho.',
  },
  {
    num: '03',
    titulo: 'Análise Documental e Jurídica',
    desc: 'Revisão de políticas internas, contratos, reclamações e histórico trabalhista da empresa.',
  },
  {
    num: '04',
    titulo: 'Relatório Preventivo',
    desc: 'Documento detalhado com diagnóstico completo e exposição das vulnerabilidades identificadas.',
  },
  {
    num: '05',
    titulo: 'Plano de Ação',
    desc: 'Conjunto de medidas corretivas e preventivas priorizadas por nível de risco e impacto.',
  },
  {
    num: '06',
    titulo: 'Treinamento de Líderes e RH',
    desc: 'Capacitação da liderança e equipe de RH para identificar, prevenir e gerenciar riscos.',
  },
]

const PLANOS = [
  {
    nome: 'Completo',
    ideal: 'Indicado para empresas que desejam estruturar a adequação à NR-1 com segurança jurídica.',
    destaque: true,
    itens: [
      'Questionário diagnóstico online',
      'Mapeamento dos riscos psicossociais',
      'Análise documental e jurídica',
      'Relatório preventivo detalhado',
      'Plano de ação completo e priorizado',
      'Treinamento para líderes e RH',
      'Consultoria pós-diagnóstico por 30 dias',
    ],
  },
  {
    nome: 'Preventivo Mensal',
    ideal: 'Indicado para empresas que querem acompanhamento contínuo, atualização preventiva e suporte jurídico recorrente.',
    destaque: false,
    itens: [
      'Tudo do plano Completo',
      'Monitoramento periódico de riscos psicossociais',
      'Atualizações normativas contínuas',
      'Suporte jurídico preventivo',
      'Reuniões estratégicas com RH, liderança ou diretoria',
      'Relatórios periódicos de acompanhamento',
      'Apoio na revisão de políticas internas e medidas preventivas',
    ],
  },
]

const ARTIGOS = [
  {
    tag: 'Legislação',
    titulo: 'O que muda na NR-1 com os riscos psicossociais?',
    resumo:
      'A atualização da NR-1 tornou obrigatório o gerenciamento de riscos psicossociais. Entenda o que mudou e o que sua empresa precisa fazer para estar em conformidade.',
  },
  {
    tag: 'Gestão de Risco',
    titulo: 'Burnout, assédio e passivo trabalhista',
    resumo:
      'O custo de ignorar os riscos psicossociais vai além das indenizações. Veja como o passivo trabalhista pode comprometer a sustentabilidade do negócio.',
  },
  {
    tag: 'Ferramenta',
    titulo: 'Checklist NR-1: sua empresa está preparada?',
    resumo:
      'Verifique em minutos o grau de conformidade da sua empresa com as novas exigências da NR-1 sobre riscos psicossociais.',
  },
]

function Divider() {
  return <div className="w-8 h-px bg-[#C49557] mb-5" />
}

function Tag({ label }: { label: string }) {
  return (
    <span className="inline-block text-[#C49557] text-[11px] font-semibold tracking-widest uppercase">
      {label}
    </span>
  )
}

export default function NR1SemRiscoPage() {
  return (
    <div className={`${cormorant.variable} min-h-screen bg-[#F3F1EE] text-[#111827]`}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#162030] border-b border-[#C49557]/20 shadow-[0_8px_30px_rgba(17,24,39,0.12)]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Pessoa e do Val Advocacia"
              className="h-9 w-9 rounded-lg border border-[#C49557]/25 bg-[#C49557]/10 object-contain p-1"
            />
            <div className="hidden sm:block leading-none">
              <p className="[font-family:var(--font-serif)] text-white text-[19px] font-semibold tracking-tight">
                Pessoa e do Val
              </p>
              <p className="text-[#C49557] text-[9px] mt-0.5 tracking-[0.2em] uppercase">
                Advocacia
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-8">
            <a href="#o-que-mudou" className="hidden md:block text-white/50 hover:text-[#C49557] text-sm transition-colors">
              A NR-1
            </a>
            <a href="#diagnostico" className="hidden md:block text-white/50 hover:text-[#C49557] text-sm transition-colors">
              Diagnóstico
            </a>
            <a href="#planos" className="hidden md:block text-white/50 hover:text-[#C49557] text-sm transition-colors">
              Planos
            </a>
            <a
              href={WA}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#C49557] hover:bg-[#A07840] text-[#111827] text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              WhatsApp
            </a>
          </nav>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-[#C49557]/40 to-transparent" />
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="bg-[#162030] pt-24 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block border border-[#C49557]/30 text-[#C49557] text-[11px] font-semibold tracking-widest uppercase px-5 py-2 rounded-full mb-8">
            NR-1 sem Risco por Pessoa e do Val Advocacia
          </span>
          <h1 className="[font-family:var(--font-serif)] text-white font-bold text-4xl sm:text-5xl md:text-6xl leading-tight mb-6">
            NR-1 e riscos psicossociais:{' '}
            <span className="text-[#C49557]">sua empresa está preparada?</span>
          </h1>
          <p className="text-white/55 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto mb-12">
            A nova NR-1 exige o gerenciamento de riscos psicossociais. Empresas sem conformidade
            enfrentam multas, ações do MPT e passivos trabalhistas crescentes. Nós ajudamos sua
            empresa a se proteger.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#contato"
              className="bg-[#C49557] hover:bg-[#A07840] text-[#111827] font-semibold px-10 py-4 rounded-xl text-base transition-colors"
            >
              Solicitar diagnóstico
            </a>
            <a
              href="#contato"
              className="border border-white/15 hover:border-[#C49557]/60 text-white/70 hover:text-[#C49557] font-semibold px-10 py-4 rounded-xl text-base transition-colors"
            >
              Solicitar checklist gratuito
            </a>
          </div>
        </div>
      </section>

      {/* ── Aula gratuita ─────────────────────────────────────────────────── */}
      <section id="aula" className="py-24 px-6 bg-[#162030]">
        <div className="max-w-6xl mx-auto">
          <Tag label="Aula gratuita NR-1" />
          <h2 className="[font-family:var(--font-serif)] text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
            Aula gratuita: o que sua empresa precisa entender sobre a nova NR-1
          </h2>
          <p className="text-white/50 text-lg leading-relaxed max-w-2xl mb-10">
            Em 26 minutos, veja os principais pontos sobre riscos psicossociais, prevenção
            trabalhista e primeiros passos para adequação.
          </p>
          <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-10 bg-black/20">
            <iframe
              src="https://www.youtube.com/embed/jLIdgBTlkWU?rel=0&modestbranding=1"
              title="Aula gratuita NR-1"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="/nr1-sem-risco/diagnostico"
              className="inline-block bg-[#C49557] hover:bg-[#A07840] text-[#111827] font-semibold px-8 py-4 rounded-xl text-sm transition-colors text-center"
            >
              Fazer diagnóstico NR-1
            </a>
            <a
              href="https://wa.me/5531971766583?text=Olá,%20assisti%20à%20aula%20sobre%20NR-1%20e%20gostaria%20de%20orientação"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block border border-white/15 hover:border-[#C49557]/60 text-white/70 hover:text-[#C49557] font-semibold px-8 py-4 rounded-xl text-sm transition-colors text-center"
            >
              Falar com o Pessoa e do Val
            </a>
          </div>
        </div>
      </section>

      {/* ── O que mudou na NR-1 ────────────────────────────────────────────── */}
      <section id="o-que-mudou" className="py-24 px-6 bg-[#F3F1EE]">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <Tag label="Legislação" />
            <h2 className="[font-family:var(--font-serif)] text-3xl sm:text-4xl font-bold text-[#111827] mt-3 mb-6">
              O que mudou na NR-1
            </h2>
            <p className="text-[#4B5563] text-lg leading-relaxed mb-5">
              A Norma Regulamentadora nº 1 foi atualizada para incluir expressamente o gerenciamento
              de riscos psicossociais no Programa de Gerenciamento de Riscos (PGR). Toda empresa com
              empregados regidos pela CLT está obrigada a identificar, avaliar e controlar esses
              fatores.
            </p>
            <p className="text-[#4B5563] text-lg leading-relaxed mb-5">
              Os riscos psicossociais são fatores organizacionais que podem causar danos à saúde
              física e mental dos trabalhadores: assédio, sobrecarga, conflitos, pressão por metas e
              liderança inadequada são exemplos que a norma agora exige mapear formalmente.
            </p>
            <p className="text-[#4B5563] text-lg leading-relaxed">
              Empresas que não cumprirem ficam expostas a autuações da fiscalização do trabalho,
              ações coletivas do Ministério Público do Trabalho e indenizações por adoecimento
              ocupacional.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { label: 'Multas e autuações', detalhe: 'Fiscalização do Ministério do Trabalho e Emprego' },
              { label: 'Ações trabalhistas', detalhe: 'Indenizações por danos morais e materiais' },
              { label: 'Afastamentos e improdutividade', detalhe: 'Custo elevado com saúde ocupacional' },
            ].map(item => (
              <div key={item.label} className="bg-white border border-[#E2DDD8] rounded-xl p-7 shadow-[0_2px_16px_rgba(17,24,39,0.04)]">
                <Divider />
                <p className="font-semibold text-[#111827] mb-1.5">{item.label}</p>
                <p className="text-[#9CA3AF] text-sm leading-relaxed">{item.detalhe}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Riscos Psicossociais ────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <Tag label="Riscos Psicossociais" />
            <h2 className="[font-family:var(--font-serif)] text-3xl sm:text-4xl font-bold text-[#111827] mt-3 mb-4">
              Os riscos que sua empresa precisa conhecer
            </h2>
            <p className="text-[#4B5563] text-lg leading-relaxed">
              A NR-1 exige que esses fatores sejam formalmente mapeados e gerenciados no PGR.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {RISCOS.map(r => (
              <div
                key={r.titulo}
                className="bg-white border border-[#E2DDD8] rounded-xl p-6 hover:border-[#C49557]/40 transition-colors shadow-[0_2px_16px_rgba(17,24,39,0.035)]"
              >
                <div className="w-5 h-px bg-[#C49557] mb-4" />
                <h3 className="font-semibold text-[#111827] mb-2 text-sm">{r.titulo}</h3>
                <p className="text-[#6B7280] text-sm leading-relaxed">{r.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Diagnóstico ────────────────────────────────────────────────────── */}
      <section id="diagnostico" className="py-24 px-6 bg-[#F3F1EE]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <Tag label="Nosso Produto" />
              <h2 className="[font-family:var(--font-serif)] text-3xl sm:text-4xl font-bold text-[#111827] mt-3 mb-6">
                Diagnóstico Jurídico-Preventivo NR-1
              </h2>
              <p className="text-[#4B5563] text-lg leading-relaxed mb-5">
                Uma solução completa desenvolvida por especialistas em direito do trabalho para
                identificar vulnerabilidades, construir compliance NR-1 e proteger sua empresa de
                passivos trabalhistas.
              </p>
              <p className="text-[#4B5563] text-lg leading-relaxed mb-8">
                Mais do que um relatório: entregamos um plano de ação concreto, com etapas
                priorizadas, treinamento para lideranças e suporte jurídico especializado ao longo
                do processo.
              </p>
              <a
                href="#contato"
                className="inline-block bg-[#162030] hover:bg-[#1D5F60] text-white font-semibold px-8 py-4 rounded-xl text-base transition-colors"
              >
                Solicitar diagnóstico
              </a>
            </div>
            <div className="bg-[#162030] rounded-2xl p-8 shadow-[0_18px_60px_rgba(17,24,39,0.18)]">
              <Tag label="Por que agir agora" />
              <ul className="mt-5 space-y-4">
                {[
                  'A NR-1 atualizada já está em vigor para novas obrigações',
                  'O MPT tem intensificado ações em empresas sem PGR atualizado',
                  'Burnout e assédio lideram ações trabalhistas no Brasil',
                  'Prevenção custa em média 10x menos que uma indenização',
                  'Conformidade NR-1 começa a ser critério ESG para investidores',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C49557] mt-2 shrink-0" />
                    <p className="text-white/65 text-sm leading-relaxed">{item}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Etapas ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#162030]">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <Tag label="Como Funciona" />
            <h2 className="[font-family:var(--font-serif)] text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
              Etapas do serviço
            </h2>
            <p className="text-white/50 text-lg leading-relaxed">
              Um processo estruturado, do levantamento inicial à implementação das melhorias.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ETAPAS.map(e => (
              <div
                key={e.num}
                className="border border-white/10 rounded-xl p-7 hover:border-[#C49557]/30 transition-colors"
              >
                <span className="font-mono text-[#C49557] text-sm font-bold">{e.num}</span>
                <h3 className="text-white font-semibold mt-4 mb-2">{e.titulo}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{e.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Planos ─────────────────────────────────────────────────────────── */}
      <section id="planos" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <Tag label="Planos" />
            <h2 className="[font-family:var(--font-serif)] text-3xl sm:text-4xl font-bold text-[#111827] mt-3 mb-4">
              Escolha o plano ideal para sua empresa
            </h2>
            <p className="text-gray-400 text-lg">
              Soluções adaptadas ao porte e à complexidade de cada organização.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {PLANOS.map(p => (
              <div
                key={p.nome}
                className={`rounded-xl p-8 flex flex-col ${
                  p.destaque
                    ? 'bg-[#162030] ring-1 ring-[#C49557]/60 shadow-[0_18px_60px_rgba(17,24,39,0.14)]'
                    : 'border border-[#E2DDD8] shadow-[0_2px_16px_rgba(17,24,39,0.035)]'
                }`}
              >
                {p.destaque && (
                  <span className="text-[#C49557] text-[11px] font-semibold tracking-widest uppercase mb-4">
                    Mais escolhido
                  </span>
                )}
                <h3
                  className={`[font-family:var(--font-serif)] text-2xl font-bold mb-1 ${
                    p.destaque ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {p.nome}
                </h3>
                <p className={`text-sm mb-7 leading-relaxed ${p.destaque ? 'text-white/40' : 'text-gray-400'}`}>
                  {p.ideal}
                </p>
                <ul className="space-y-3 flex-1 mb-8">
                  {p.itens.map(item => (
                    <li key={item} className="flex items-start gap-3">
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        className="w-4 h-4 mt-0.5 shrink-0"
                      >
                        <polyline points="3 8 6.5 11.5 13 5" stroke="#C49557" strokeWidth={1.5} />
                      </svg>
                      <span
                        className={`text-sm leading-relaxed ${
                          p.destaque ? 'text-white/70' : 'text-gray-600'
                        }`}
                      >
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
                <a
                  href="https://wa.me/5531971766583?text=Olá,%20gostaria%20de%20solicitar%20uma%20proposta%20para%20o%20Diagnóstico%20NR-1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-center text-sm font-semibold px-6 py-3.5 rounded transition-colors ${
                    p.destaque
                      ? 'bg-[#C49557] hover:bg-[#A07840] text-[#111827]'
                      : 'border border-gray-200 hover:border-[#C49557]/50 text-gray-700 hover:text-[#C49557]'
                  }`}
                >
                  Solicitar proposta
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Blog ───────────────────────────────────────────────────────────── */}
      <section id="blog" className="py-24 px-6 bg-[#F3F1EE]">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <Tag label="Conteúdo" />
            <h2 className="[font-family:var(--font-serif)] text-3xl sm:text-4xl font-bold text-[#111827] mt-3 mb-4">
              Artigos e recursos
            </h2>
            <p className="text-gray-400 text-lg">
              Informação especializada para decisões mais seguras.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ARTIGOS.map(a => (
              <article
                key={a.titulo}
                className="bg-white border border-[#E2DDD8] rounded-xl p-8 flex flex-col hover:border-[#C49557]/30 transition-colors shadow-[0_2px_16px_rgba(17,24,39,0.035)]"
              >
                <Tag label={a.tag} />
                <h3 className="[font-family:var(--font-serif)] text-[#111827] font-bold text-lg leading-snug mt-4 mb-4">
                  {a.titulo}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed flex-1">{a.resumo}</p>
                <div className="mt-7 pt-6 border-t border-gray-50 flex items-center gap-2">
                  <span className="text-[#C49557] text-sm font-semibold">Ler artigo</span>
                  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="#C49557" strokeWidth={1.5} strokeLinecap="round" />
                  </svg>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Formulário de Contato ───────────────────────────────────────────── */}
      <section id="contato" className="py-24 px-6 bg-[#162030]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <Tag label="Contato" />
            <h2 className="[font-family:var(--font-serif)] text-3xl sm:text-4xl font-bold text-white mt-3 mb-4">
              Solicite seu diagnóstico
            </h2>
            <p className="text-white/50 text-lg leading-relaxed">
              Preencha o formulário e um de nossos especialistas entrará em contato em até 24 horas úteis.
            </p>
          </div>
          <ContactForm />
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-[#111827] border-t border-[#C49557]/15 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Pessoa e do Val Advocacia"
                className="h-11 w-11 rounded-xl border border-[#C49557]/25 bg-[#C49557]/10 object-contain p-1.5 mb-3"
              />
              <p className="text-white/35 text-sm leading-relaxed">
                Pessoa e do Val Advocacia
              </p>
            </div>
            <div>
              <p className="text-white/25 text-[11px] font-semibold uppercase tracking-widest mb-4">
                Endereço
              </p>
              <p className="text-white/50 text-sm leading-relaxed">
                Rua Gonçalves Dias, 874 — 8º andar<br />
                Savassi — Belo Horizonte/MG
              </p>
            </div>
            <div>
              <p className="text-white/25 text-[11px] font-semibold uppercase tracking-widest mb-4">
                Contato
              </p>
              <p className="text-white/50 text-sm leading-relaxed">
                (31) 3226-6583 / 97176-6583<br />
                contato@pessoaedoval.com.br<br />
                www.pessoaedoval.com.br
              </p>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-white/20 text-xs">
              © 2026 Pessoa e do Val Advocacia. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>

      {/* ── WhatsApp FAB ───────────────────────────────────────────────────── */}
      <a
        href={WA}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20BA5A] flex items-center justify-center shadow-2xl transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      </a>
    </div>
  )
}
