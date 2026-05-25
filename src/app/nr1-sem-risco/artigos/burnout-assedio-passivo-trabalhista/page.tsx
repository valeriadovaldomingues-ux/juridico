import type { Metadata } from 'next'
import ArticleLayout from '../ArticleLayout'

export const metadata: Metadata = {
  title: 'Burnout, assédio e passivo trabalhista — Pessoa e do Val Advocacia',
  description:
    'O custo de ignorar os riscos psicossociais vai além das indenizações. Veja como burnout e assédio se tornam passivo trabalhista e como a NR-1 mudou o cenário jurídico.',
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
      categoria="Gestão de Risco"
      titulo="Burnout, assédio e passivo trabalhista"
      subtitulo="O custo de ignorar os riscos psicossociais vai muito além das indenizações. Entenda como burnout e assédio se convertem em passivo trabalhista e como a NR-1 atualizada mudou o cenário jurídico para as empresas."
      dataPublicacao="Maio de 2026"
    >
      <p className={P}>
        Durante décadas, o debate sobre saúde mental no trabalho foi tratado pelas empresas como uma questão de recursos humanos — importante, mas distante do departamento jurídico. A atualização da NR-1 encerrou essa separação. Burnout, assédio moral e conflitos organizacionais são hoje fatores de risco com obrigação legal de gerenciamento, e a omissão da empresa diante desses fatores passou a ser argumento direto em processos trabalhistas.
      </p>

      <h2 className={H2}>Burnout: quando a sobrecarga vira ação trabalhista</h2>
      <p className={P}>
        O burnout — síndrome de esgotamento profissional reconhecida pela OMS como fenômeno ocupacional — é hoje uma das principais causas de afastamento por doenças relacionadas ao trabalho no Brasil. Quando o trabalhador consegue demonstrar nexo causal entre o adoecimento e as condições de trabalho, a empresa pode ser responsabilizada por danos materiais (tratamento, lucros cessantes) e morais.
      </p>
      <p className={P}>
        Com a nova NR-1, a equação muda: se a empresa tinha a obrigação legal de identificar e controlar a sobrecarga de trabalho — e não o fez — essa omissão deixa de ser um mero descuido de gestão e passa a ser descumprimento de norma regulamentadora. Na prática, isso facilita a caracterização de culpa em processos de indenização.
      </p>

      <div className={BOX}>
        <p className="font-semibold text-[#111827] mb-4">Situações que configuram risco de responsabilização:</p>
        <ul className="space-y-3">
          {[
            'Funcionários com histórico documentado de horas extras excessivas',
            'Metas comprovadamente inatingíveis pela maioria da equipe',
            'Ausência de controle de jornada ou banco de horas sem compensação adequada',
            'Afastamentos por ansiedade ou depressão sem investigação do nexo com o trabalho',
            'PGR desatualizado ou sem menção a riscos psicossociais',
          ].map(item => (
            <li key={item} className="flex items-start gap-3">
              <Dot />
              <span className="text-[#4B5563]">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <h2 className={H2}>Assédio moral e sexual: responsabilidade que recai sobre a empresa</h2>
      <p className={P}>
        O assédio moral é uma das condutas mais litigadas no direito do trabalho brasileiro. A empresa pode ser responsabilizada tanto quando o assédio é praticado por um gestor (responsabilidade direta) quanto quando tolera condutas abusivas entre pares sem tomar providências (responsabilidade por omissão).
      </p>

      <h3 className={H3}>O que a NR-1 exige sobre prevenção ao assédio</h3>
      <p className={P}>
        A norma atualizada exige que a empresa não apenas proíba o assédio em teoria, mas que adote medidas concretas e documentadas de prevenção: política escrita, canal de denúncias acessível e conhecido pelos funcionários, processo formal de apuração e treinamento das lideranças. A ausência de qualquer um desses elementos é evidência de falta de diligência preventiva.
      </p>
      <p className={P}>
        Em um processo trabalhista, a empresa que possui política formalizada, treinamentos registrados e canal de denúncia operacional está em posição jurídica radicalmente diferente daquela que não tem nada disso — ainda que o episódio de assédio tenha ocorrido de forma isolada.
      </p>

      <div className={NAVY}>
        <p className="text-[#B8784A] text-[11px] font-semibold tracking-widest uppercase mb-3">Ponto de atenção jurídico</p>
        <p className="text-white/75 leading-relaxed">
          A ausência de política de prevenção ao assédio pode ser interpretada pelos Tribunais do Trabalho como evidência de que a empresa criou ou tolerou um ambiente propício ao assédio. Isso pode elevar o valor das indenizações e, em alguns casos, configurar dano moral coletivo.
        </p>
      </div>

      <h2 className={H2}>O custo real do passivo trabalhista</h2>
      <p className={P}>
        É comum que empresas enxerguem a adequação à NR-1 como um custo. A perspectiva muda quando se considera o passivo potencial do descumprimento.
      </p>
      <p className={P}>
        Uma única ação por dano moral decorrente de assédio ou adoecimento ocupacional pode resultar em condenações que variam de 10 a 50 salários da vítima — fora os honorários advocatícios, custas processuais e eventual repercussão reputacional. Ações coletivas movidas pelo Ministério Público do Trabalho, por sua vez, podem gerar obrigações de fazer (implementar políticas, realizar treinamentos) sob pena de multas diárias.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-8">
        {[
          {
            label: 'Custo de prevenção',
            desc: 'Diagnóstico, política formalizada, treinamentos e assessoria jurídica preventiva.',
          },
          {
            label: 'Custo do passivo',
            desc: 'Indenizações, honorários, multas, afastamentos, improdutividade e dano reputacional.',
          },
        ].map(item => (
          <div key={item.label} className={BOX + ' my-0'}>
            <div className="w-5 h-px bg-[#B8784A] mb-4" />
            <p className="font-semibold text-[#111827] mb-2">{item.label}</p>
            <p className="text-[#9CA3AF] text-sm leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <p className={P}>
        Estudos do setor de saúde ocupacional indicam que o custo de prevenção representa, em média, 10% do custo de uma condenação trabalhista em caso de adoecimento relacionado ao trabalho. Empresas que adotam uma postura preventiva estruturada não apenas reduzem o risco de litígios — elas também criam documentação que, em caso de processo, demonstra diligência.
      </p>

      <h2 className={H2}>O que fazer agora</h2>
      <p className={P}>
        O primeiro passo é entender onde sua empresa está. Isso significa mapear os fatores de risco psicossocial presentes — sobrecarga, qualidade da liderança, prevenção ao assédio, reconhecimento, equilíbrio vida-trabalho — e avaliar o nível de exposição em cada um deles.
      </p>
      <p className={P}>
        Com esse diagnóstico em mãos, é possível priorizar as ações que reduzem mais risco jurídico com menos esforço. A formalização das medidas adotadas — por escrito, com data e responsáveis — é o que transforma uma boa prática de gestão em evidência de compliance.
      </p>

      <div className="border-l-4 border-[#B8784A] pl-6 my-8">
        <p className="text-[#4B5563] text-lg leading-relaxed italic">
          &ldquo;Empresas que documentam sua jornada de adequação à NR-1 estão construindo sua defesa antes mesmo de precisar dela.&rdquo;
        </p>
        <p className="text-[#B8784A] text-sm font-semibold mt-3 tracking-wide">
          Pessoa e do Val Advocacia
        </p>
      </div>
    </ArticleLayout>
  )
}
