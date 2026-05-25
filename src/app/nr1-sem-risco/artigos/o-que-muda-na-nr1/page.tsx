import type { Metadata } from 'next'
import ArticleLayout from '../ArticleLayout'

export const metadata: Metadata = {
  title: 'O que muda na NR-1 com os riscos psicossociais? — Pessoa e do Val Advocacia',
  description:
    'A atualização da NR-1 tornou obrigatório o gerenciamento de riscos psicossociais. Entenda o que mudou e o que sua empresa precisa fazer para estar em conformidade.',
}

const H2 = '[font-family:var(--font-serif)] text-[#0D2235] font-bold text-2xl sm:text-3xl mt-12 mb-5 leading-tight'
const P  = 'text-[#4B5563] text-lg leading-relaxed mb-5'

function Dot() {
  return <div className="w-1.5 h-1.5 rounded-full bg-[#B8784A] mt-2.5 shrink-0" />
}

export default function Page() {
  return (
    <ArticleLayout
      categoria="Legislação"
      titulo="O que muda na NR-1 com os riscos psicossociais?"
      subtitulo="Os fatores de risco psicossociais passaram a integrar expressamente o Gerenciamento de Riscos Ocupacionais. Entenda o que mudou e o que sua empresa precisa fazer."
      dataPublicacao="Maio de 2026"
      autor="Valéria do Val"
    >
      <p className={P}>
        A atualização da NR-1 trouxe uma mudança relevante para as empresas brasileiras: os fatores de risco psicossociais passaram a integrar expressamente o Gerenciamento de Riscos Ocupacionais, o chamado GRO, e devem ser considerados no PGR — Programa de Gerenciamento de Riscos.
      </p>
      <p className={P}>
        Na prática, isso significa que a empresa não pode mais olhar apenas para riscos físicos, químicos, biológicos, ergonômicos ou de acidentes. Agora, fatores como sobrecarga de trabalho, metas abusivas, assédio moral, conflitos internos, falhas de liderança, pressão excessiva, jornadas desorganizadas e ambiente emocionalmente adoecedor também precisam ser identificados, avaliados e tratados.
      </p>
      <p className={P}>
        A mudança foi consolidada pela Portaria MTE nº 1.419/2024, que deu nova redação à NR-1 e incluiu os fatores de risco psicossociais relacionados ao trabalho no âmbito do gerenciamento de riscos ocupacionais. A própria página oficial da NR-1 informa que essa redação entra em vigor em 26 de maio de 2026.
      </p>
      <p className={P}>
        O Ministério do Trabalho e Emprego também publicou materiais orientativos sobre o Capítulo 1.5 da NR-1, especialmente no contexto do GRO/PGR, reforçando que a gestão dos fatores psicossociais deve ser tratada como parte da prevenção em segurança e saúde no trabalho.
      </p>
      <p className={P}>
        O ponto central é simples: saúde mental no trabalho deixou de ser apenas tema de palestra motivacional. Agora é matéria de gestão, prevenção, documentação e responsabilidade empresarial.
      </p>
      <p className={P}>
        Empresas que não se adequarem poderão enfrentar riscos trabalhistas, previdenciários, administrativos e reputacionais. E, como sempre acontece, o problema não costuma aparecer no dia em que nasce. Ele aparece quando já virou afastamento, denúncia, reclamação trabalhista ou fiscalização.
      </p>

      <h2 className={H2}>O que a empresa precisa fazer?</h2>
      <p className={P}>
        A empresa deve revisar seu PGR, identificar os fatores de risco psicossociais existentes no ambiente de trabalho, avaliar sua gravidade, registrar as medidas preventivas e acompanhar a efetividade dessas ações.
      </p>
      <p className={P}>Isso envolve olhar para a rotina real da empresa:</p>
      <ul className="space-y-3 mb-8">
        {[
          'como as metas são cobradas;',
          'como os gestores tratam as equipes;',
          'como os conflitos são conduzidos;',
          'se há excesso de jornada;',
          'se existe canal seguro de denúncia;',
          'se os empregados sabem a quem recorrer;',
          'se há documentação mínima das ações preventivas.',
        ].map(item => (
          <li key={item} className="flex items-start gap-3">
            <Dot />
            <span className="text-[#4B5563] text-lg leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
      <p className={P}>
        Não basta &ldquo;ter um RH&rdquo;. Não basta &ldquo;ter uma clínica de medicina do trabalho&rdquo;. Não basta dizer que &ldquo;nunca deu problema&rdquo;. No Direito do Trabalho, essa frase costuma aparecer tarde demais — e quase sempre no polo passivo.
      </p>
      <p className={P}>
        A adequação à nova NR-1 deve ser feita de forma técnica, documentada e integrada entre jurídico, RH, SST e gestão empresarial. Quando bem conduzida, ela reduz riscos, melhora o ambiente de trabalho e protege a empresa contra passivos futuros.
      </p>

      <h2 className={H2}>Conclusão</h2>
      <p className={P}>
        A nova abordagem da NR-1 exige que as empresas tratem os riscos psicossociais com seriedade. Não se trata de burocracia vazia, mas de prevenção concreta.
      </p>
      <p className={P}>
        Empresas organizadas sairão na frente. Empresas que improvisarem podem descobrir, tarde demais, que saúde mental também gera passivo trabalhista.
      </p>
    </ArticleLayout>
  )
}
