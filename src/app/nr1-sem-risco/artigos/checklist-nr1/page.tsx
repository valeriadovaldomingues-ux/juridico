import type { Metadata } from 'next'
import ArticleLayout from '../ArticleLayout'

export const metadata: Metadata = {
  title: 'Checklist NR-1: sua empresa está preparada? — Pessoa e do Val Advocacia',
  description:
    'Verifique em minutos o grau de conformidade da sua empresa com as novas exigências da NR-1 sobre riscos psicossociais. Checklist estruturado por área.',
}

const H2 = '[font-family:var(--font-serif)] text-[#0D2235] font-bold text-2xl sm:text-3xl mt-12 mb-5 leading-tight'
const P  = 'text-[#4B5563] text-lg leading-relaxed mb-5'
const BOX = 'bg-white border border-[#E2DDD8] rounded-xl p-7 my-6 shadow-[0_2px_16px_rgba(17,24,39,0.04)]'
const NAVY = 'bg-[#0D2235] rounded-xl p-7 my-8'

function CheckItem({ children, alerta }: { children: React.ReactNode; alerta?: boolean }) {
  return (
    <li className="flex items-start gap-4 py-3 border-b border-[#F3F1EE] last:border-0">
      <div className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${alerta ? 'border-[#ea580c]' : 'border-[#E2DDD8]'}`}>
        {alerta && (
          <svg viewBox="0 0 10 10" fill="none" className="w-3 h-3">
            <path d="M2 5h6M5 2v6" stroke="#ea580c" strokeWidth={1.5} strokeLinecap="round" />
          </svg>
        )}
      </div>
      <span className={`text-base leading-relaxed ${alerta ? 'text-[#9a3412]' : 'text-[#4B5563]'}`}>{children}</span>
    </li>
  )
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className={BOX}>
      <p className="font-semibold text-[#111827] mb-1 text-base">{titulo}</p>
      <ul className="mt-3">{children}</ul>
    </div>
  )
}

export default function Page() {
  return (
    <ArticleLayout
      categoria="Ferramenta"
      titulo="Checklist NR-1: sua empresa está preparada?"
      subtitulo="Verifique em minutos o grau de conformidade da sua empresa com as novas exigências da NR-1 sobre riscos psicossociais. Use este checklist como ponto de partida para identificar lacunas e priorizar ações."
      dataPublicacao="Maio de 2026"
    >
      <p className={P}>
        A adequação à NR-1 atualizada envolve mais do que a elaboração de um documento. Ela exige que a empresa efetivamente identifique, avalie e controle os fatores de risco psicossocial presentes no seu ambiente de trabalho — e que tenha evidência documentada disso.
      </p>
      <p className={P}>
        Este checklist está organizado por área e cobre os principais requisitos da norma. Use os itens marcados com ⊕ como pontos de atenção prioritária para sua empresa.
      </p>

      <h2 className={H2}>1. Programa de Gerenciamento de Riscos (PGR)</h2>

      <Section titulo="Documentação e atualização">
        <CheckItem>A empresa possui PGR formalmente elaborado e atualizado.</CheckItem>
        <CheckItem>O PGR inclui inventário de riscos que contempla fatores psicossociais.</CheckItem>
        <CheckItem alerta>Os riscos psicossociais estão identificados com medidas de controle definidas.</CheckItem>
        <CheckItem alerta>O PGR foi revisado após a entrada em vigor da atualização da NR-1.</CheckItem>
        <CheckItem>Existe responsável interno designado para o acompanhamento do PGR.</CheckItem>
      </Section>

      <h2 className={H2}>2. Mapeamento de riscos psicossociais</h2>

      <Section titulo="Identificação e avaliação">
        <CheckItem>Foram avaliados os fatores de carga e organização do trabalho.</CheckItem>
        <CheckItem alerta>Existe registro formal da avaliação de riscos ligados à liderança e relações interpessoais.</CheckItem>
        <CheckItem>O equilíbrio entre vida pessoal e profissional foi considerado na avaliação.</CheckItem>
        <CheckItem alerta>Há mecanismo para que funcionários reportem percepções de risco psicossocial.</CheckItem>
        <CheckItem>A avaliação foi realizada com metodologia estruturada (não apenas por percepção subjetiva dos gestores).</CheckItem>
      </Section>

      <h2 className={H2}>3. Prevenção ao assédio moral e sexual</h2>

      <Section titulo="Políticas e processos">
        <CheckItem alerta>A empresa possui política formal e escrita de prevenção ao assédio moral e sexual.</CheckItem>
        <CheckItem alerta>A política foi comunicada formalmente a todos os funcionários.</CheckItem>
        <CheckItem alerta>Existe canal de denúncia acessível, com garantia de anonimato.</CheckItem>
        <CheckItem>O canal de denúncia é efetivamente conhecido pelos funcionários (não apenas formalmente existente).</CheckItem>
        <CheckItem>Há processo formal de apuração de denúncias com prazos e responsáveis definidos.</CheckItem>
        <CheckItem alerta>As lideranças receberam treinamento sobre prevenção e identificação de assédio.</CheckItem>
      </Section>

      <h2 className={H2}>4. Liderança e clima organizacional</h2>

      <Section titulo="Gestão de pessoas">
        <CheckItem>Os gestores recebem capacitação sobre saúde mental e gestão de pessoas.</CheckItem>
        <CheckItem>Existe avaliação periódica de clima organizacional.</CheckItem>
        <CheckItem alerta>Os resultados das avaliações de clima geram planos de ação documentados.</CheckItem>
        <CheckItem>Há processo de feedback estruturado entre gestores e equipes.</CheckItem>
        <CheckItem>Decisões relevantes são comunicadas de forma transparente e com antecedência.</CheckItem>
      </Section>

      <h2 className={H2}>5. Carga de trabalho e jornada</h2>

      <Section titulo="Controle e monitoramento">
        <CheckItem>A empresa possui controle efetivo de jornada para todos os funcionários.</CheckItem>
        <CheckItem alerta>Horas extras são monitoradas e há limites estabelecidos por política interna.</CheckItem>
        <CheckItem>As metas são revisadas periodicamente quanto à sua razoabilidade.</CheckItem>
        <CheckItem>Existe processo para que funcionários reportem sobrecarga sem medo de represálias.</CheckItem>
        <CheckItem alerta>O banco de horas, quando utilizado, está devidamente documentado e compensado.</CheckItem>
      </Section>

      <h2 className={H2}>Como interpretar os resultados</h2>

      <div className={NAVY}>
        <div className="space-y-4">
          {[
            { cor: '#16a34a', fundo: 'rgba(22,163,74,0.15)', label: 'Todos os itens marcados', desc: 'Boa aderência formal. O próximo passo é verificar se as práticas são efetivas na prática e se a documentação está consolidada.' },
            { cor: '#ca8a04', fundo: 'rgba(202,138,4,0.15)', label: '1 a 3 itens ⊕ não atendidos', desc: 'Risco moderado. Lacunas pontuais que podem ser corrigidas com ações direcionadas. Priorize os itens marcados com ⊕.' },
            { cor: '#ea580c', fundo: 'rgba(234,88,12,0.15)', label: '4 ou mais itens ⊕ não atendidos', desc: 'Risco alto. A empresa está exposta a autuações e processos trabalhistas. Recomenda-se diagnóstico jurídico imediato.' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-4 rounded-lg p-4" style={{ background: item.fundo }}>
              <div className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ background: item.cor }} />
              <div>
                <p className="font-semibold text-white text-sm mb-1">{item.label}</p>
                <p className="text-white/65 text-sm leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <h2 className={H2}>O que fazer com os resultados</h2>
      <p className={P}>
        Este checklist é uma ferramenta de diagnóstico inicial — ele indica onde estão as lacunas, mas não substitui uma análise jurídica individualizada. Para transformar os resultados em um plano de ação juridicamente sólido, é necessário avaliar o contexto específico da empresa, o setor de atuação e a exposição histórica a riscos.
      </p>
      <p className={P}>
        O diagnóstico interativo disponível nesta plataforma vai além do checklist: ele avalia 8 fatores de risco com base nas respostas dos responsáveis pela empresa e gera um relatório com score por fator e recomendações prioritárias.
      </p>

      <div className="border-l-4 border-[#B8784A] pl-6 my-8">
        <p className="text-[#4B5563] text-lg leading-relaxed italic">
          &ldquo;Um checklist aponta o que falta. O diagnóstico mostra o grau de risco e o que priorizar. A assessoria jurídica garante que as ações adotadas tenham validade como evidência de compliance.&rdquo;
        </p>
        <p className="text-[#B8784A] text-sm font-semibold mt-3 tracking-wide">
          Pessoa e do Val Advocacia
        </p>
      </div>
    </ArticleLayout>
  )
}
