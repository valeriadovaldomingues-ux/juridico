import type { Metadata } from 'next'
import ArticleLayout from '../ArticleLayout'

export const metadata: Metadata = {
  title: 'O que muda na NR-1 com os riscos psicossociais? — Pessoa e do Val Advocacia',
  description:
    'A atualização da NR-1 tornou obrigatório o gerenciamento de riscos psicossociais. Entenda o que mudou, quem está obrigado e quais são as consequências do descumprimento.',
}

const H2 = '[font-family:var(--font-serif)] text-[#0D2235] font-bold text-2xl sm:text-3xl mt-12 mb-5 leading-tight'
const H3 = '[font-family:var(--font-serif)] text-[#0D2235] font-semibold text-xl mt-8 mb-3 leading-tight'
const P  = 'text-[#4B5563] text-lg leading-relaxed mb-5'
const BOX = 'bg-white border border-[#E2DDD8] rounded-xl p-7 my-8 shadow-[0_2px_16px_rgba(17,24,39,0.04)]'
const NAVY = 'bg-[#0D2235] rounded-xl p-7 my-8'

function Dot() {
  return <div className="w-1.5 h-1.5 rounded-full bg-[#B8784A] mt-2.5 shrink-0" />
}

export default function Page() {
  return (
    <ArticleLayout
      categoria="Legislação"
      titulo="O que muda na NR-1 com os riscos psicossociais?"
      subtitulo="A atualização da NR-1 tornou obrigatório o gerenciamento de riscos psicossociais no Programa de Gerenciamento de Riscos. Entenda o que mudou, quem está obrigado e o que sua empresa precisa fazer."
      dataPublicacao="Maio de 2026"
    >
      <p className={P}>
        A Norma Regulamentadora nº 1 (NR-1) foi atualizada pelo Ministério do Trabalho e Emprego para incluir expressamente o gerenciamento de riscos psicossociais como obrigação de todas as empresas com empregados regidos pela CLT. A mudança amplia o escopo do Programa de Gerenciamento de Riscos (PGR) — até então focado principalmente em riscos físicos, químicos e biológicos — para abranger também os fatores organizacionais que afetam a saúde mental dos trabalhadores.
      </p>
      <p className={P}>
        O impacto é imediato e alcança empresas de todos os portes e segmentos. Não se trata de uma diretriz futura: a obrigação de mapear e gerenciar riscos psicossociais já está em vigor.
      </p>

      <h2 className={H2}>O que são riscos psicossociais?</h2>
      <p className={P}>
        Riscos psicossociais são fatores organizacionais que, quando mal gerenciados, podem causar danos à saúde física e mental dos trabalhadores. Diferentemente dos riscos físicos tradicionais, eles emergem da forma como o trabalho é organizado, das relações interpessoais e da cultura da empresa.
      </p>
      <p className={P}>
        A NR-1 não apresenta uma lista taxativa, mas a literatura científica e a própria norma apontam como principais exemplos:
      </p>

      <div className={BOX}>
        <p className="font-semibold text-[#111827] mb-4">Fatores de risco psicossocial reconhecidos pela NR-1:</p>
        <ul className="space-y-3">
          {[
            'Sobrecarga de trabalho e pressão excessiva por resultados',
            'Jornadas de trabalho excessivas e falta de recuperação adequada',
            'Assédio moral e sexual no ambiente de trabalho',
            'Conflitos interpessoais e clima organizacional deteriorado',
            'Liderança inadequada, autoritária ou baseada em humilhação',
            'Falta de autonomia e micro-gestão excessiva',
            'Ausência de reconhecimento e perspectivas de crescimento',
            'Desequilíbrio entre vida pessoal e profissional',
          ].map(item => (
            <li key={item} className="flex items-start gap-3">
              <Dot />
              <span className="text-[#4B5563]">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <h2 className={H2}>O que a NR-1 passou a exigir das empresas?</h2>
      <p className={P}>
        A atualização da norma estabelece que os riscos psicossociais devem ser tratados com o mesmo rigor dos demais riscos ocupacionais. Na prática, isso significa que toda empresa precisa:
      </p>

      <div className={NAVY}>
        <ul className="space-y-4">
          {[
            { n: '01', txt: 'Incluir os riscos psicossociais no inventário de riscos do PGR' },
            { n: '02', txt: 'Identificar e avaliar os fatores presentes no ambiente de trabalho' },
            { n: '03', txt: 'Estabelecer medidas de prevenção e controle documentadas' },
            { n: '04', txt: 'Monitorar continuamente a eficácia das medidas adotadas' },
            { n: '05', txt: 'Registrar e revisar periodicamente o PGR com as informações atualizadas' },
          ].map(item => (
            <li key={item.n} className="flex items-start gap-4">
              <span className="font-mono text-[#B8784A] text-sm font-bold shrink-0 mt-0.5">{item.n}</span>
              <span className="text-white/70 leading-relaxed">{item.txt}</span>
            </li>
          ))}
        </ul>
      </div>

      <h2 className={H2}>Quais empresas estão obrigadas?</h2>
      <p className={P}>
        Todas as empresas que possuem empregados com vínculo empregatício regido pela Consolidação das Leis do Trabalho (CLT). A obrigação não exclui microempresas, empresas individuais ou organizações do terceiro setor que contratem trabalhadores formais.
      </p>

      <h3 className={H3}>Há exceções?</h3>
      <p className={P}>
        Microempresas e empresas de pequeno porte possuem simplificações na elaboração do PGR, mas não estão isentas da obrigação de identificar e gerenciar riscos psicossociais. A simplificação diz respeito ao grau de detalhamento do documento, não à dispensa da análise.
      </p>

      <h2 className={H2}>Quais são as consequências do descumprimento?</h2>
      <p className={P}>
        Empresas que não cumprem as obrigações da NR-1 ficam expostas a três frentes de risco simultâneas:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8">
        {[
          {
            titulo: 'Fiscalização do MTE',
            desc: 'Autuações e multas aplicadas pelos Auditores Fiscais do Trabalho em inspeções administrativas.',
          },
          {
            titulo: 'Ações do MPT',
            desc: 'O Ministério Público do Trabalho tem intensificado inquéritos e ações civis públicas em empresas sem PGR atualizado.',
          },
          {
            titulo: 'Passivo trabalhista',
            desc: 'Ações individuais e coletivas por danos morais, adoecimento ocupacional e indenizações por violação de direitos.',
          },
        ].map(item => (
          <div key={item.titulo} className={BOX + ' my-0'}>
            <div className="w-5 h-px bg-[#B8784A] mb-4" />
            <p className="font-semibold text-[#111827] mb-2 text-sm">{item.titulo}</p>
            <p className="text-[#9CA3AF] text-sm leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <h2 className={H2}>Como iniciar a adequação?</h2>
      <p className={P}>
        O ponto de partida é sempre o diagnóstico: entender em quais fatores psicossociais a empresa apresenta maior vulnerabilidade. Sem esse mapeamento, qualquer plano de ação será genérico e pouco efetivo.
      </p>
      <p className={P}>
        A partir do diagnóstico, a empresa pode elaborar ou atualizar o PGR com as medidas de controle e prevenção adequadas ao seu perfil. Esse processo deve envolver as lideranças, o setor de RH e, idealmente, assessoria jurídica especializada — para garantir que as medidas adotadas tenham validade como evidência de compliance em eventuais autuações ou processos.
      </p>

      <div className="border-l-4 border-[#B8784A] pl-6 my-8">
        <p className="text-[#4B5563] text-lg leading-relaxed italic">
          &ldquo;A NR-1 não exige perfeição — exige evidência de que a empresa identificou os riscos e adotou medidas concretas para gerenciá-los.&rdquo;
        </p>
        <p className="text-[#B8784A] text-sm font-semibold mt-3 tracking-wide">
          Pessoa e do Val Advocacia
        </p>
      </div>

      <p className={P}>
        Empresas que documentam adequadamente o processo de adequação — mesmo que ainda em andamento — estão em posição jurídica significativamente mais sólida do que aquelas que simplesmente ignoram a norma.
      </p>
    </ArticleLayout>
  )
}
