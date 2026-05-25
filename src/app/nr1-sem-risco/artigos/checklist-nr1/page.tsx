import type { Metadata } from 'next'
import ArticleLayout from '../ArticleLayout'

export const metadata: Metadata = {
  title: 'Checklist NR-1: sua empresa está preparada? — Pessoa e do Val Advocacia',
  description:
    'Verifique em minutos o grau de conformidade da sua empresa com as novas exigências da NR-1 sobre riscos psicossociais. Checklist estruturado por área.',
}

const H2 = '[font-family:var(--font-serif)] text-[#0D2235] font-bold text-2xl sm:text-3xl mt-12 mb-5 leading-tight'
const P  = 'text-[#4B5563] text-lg leading-relaxed mb-5'

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-[#B8784A] pl-6 my-6">
      <p className="text-[#4B5563] text-lg leading-relaxed italic">{children}</p>
    </div>
  )
}

export default function Page() {
  return (
    <ArticleLayout
      categoria="Ferramenta"
      titulo="Checklist NR-1: sua empresa está preparada?"
      subtitulo="A pergunta não é se sua empresa terá que olhar para os riscos psicossociais. A pergunta é se ela fará isso agora, com estratégia, ou depois, com pressa e advogado correndo atrás do prejuízo."
      dataPublicacao="Maio de 2026"
    >
      <p className={P}>
        A atualização da NR-1 exige que as empresas incluam os fatores de risco psicossociais no gerenciamento de riscos ocupacionais. Isso significa que o PGR deve contemplar não apenas os riscos tradicionais, mas também fatores relacionados à organização do trabalho, à gestão, às relações interpessoais e ao ambiente psicossocial.
      </p>
      <p className={P}>
        Segundo o Ministério do Trabalho e Emprego, o Manual de Interpretação e Aplicação do Capítulo 1.5 da NR-1 foi lançado para orientar empregadores, trabalhadores e profissionais de segurança e saúde na implementação do Gerenciamento de Riscos Ocupacionais, incluindo os riscos psicossociais.
      </p>
      <p className={P}>
        Mas a pergunta prática é: sua empresa já está preparada?
      </p>
      <p className={P}>
        Abaixo, veja um checklist inicial para avaliar o grau de conformidade da empresa.
      </p>

      <h2 className={H2}>1. O PGR da empresa foi revisado?</h2>
      <p className={P}>
        O primeiro ponto é verificar se o Programa de Gerenciamento de Riscos está atualizado e se contempla os fatores de risco psicossociais.
      </p>
      <p className={P}>
        Se o PGR ainda trata apenas de riscos físicos, químicos, biológicos, ergonômicos e de acidentes, ele provavelmente precisa ser revisto.
      </p>
      <p className={P}>
        A empresa deve identificar fatores como excesso de carga de trabalho, pressão por metas, conflitos internos, falhas de comunicação, assédio, violência no trabalho, baixa autonomia, insegurança, jornadas desorganizadas e ausência de suporte adequado.
      </p>

      <h2 className={H2}>2. A empresa possui inventário de riscos psicossociais?</h2>
      <p className={P}>
        A identificação dos riscos precisa ser documentada. Não basta saber informalmente que &ldquo;o setor comercial é mais estressante&rdquo; ou que &ldquo;aquele gerente é difícil&rdquo;.
      </p>
      <p className={P}>
        O inventário deve apontar quais riscos existem, onde estão, quem está exposto e qual o nível de gravidade. Também deve indicar medidas de prevenção e controle.
      </p>
      <Callout>Sem documento, no processo, vira conversa. E conversa, sem prova, costuma apanhar da realidade.</Callout>

      <h2 className={H2}>3. Existem medidas preventivas claras?</h2>
      <p className={P}>
        Depois de identificar os riscos, a empresa precisa agir.
      </p>
      <p className={P}>
        As medidas podem incluir reorganização de processos, revisão de metas, treinamento de lideranças, melhoria dos canais de comunicação, criação de política contra assédio, canal de denúncia, protocolo de apuração interna e acompanhamento de afastamentos relacionados à saúde mental.
      </p>
      <p className={P}>
        O importante é que essas ações sejam reais, aplicáveis e registradas.
      </p>

      <h2 className={H2}>4. Os gestores foram treinados?</h2>
      <p className={P}>
        Grande parte dos riscos psicossociais nasce na liderança despreparada.
      </p>
      <p className={P}>
        Gestores precisam saber cobrar sem humilhar, corrigir sem perseguir, dar feedback sem expor, organizar demandas sem sobrecarregar e lidar com conflitos sem transformar o setor em ringue.
      </p>
      <Callout>Treinamento de liderança não é luxo. É blindagem trabalhista.</Callout>

      <h2 className={H2}>5. A empresa possui canal de denúncia e protocolo de apuração?</h2>
      <Callout>Canal de denúncia sem apuração séria é enfeite institucional.</Callout>
      <p className={P}>
        A empresa precisa ter um meio seguro para que empregados relatem situações de assédio, abuso, discriminação, violência psicológica ou outras condutas inadequadas. Mas também precisa ter um procedimento claro para apurar, registrar e solucionar essas queixas.
      </p>
      <p className={P}>
        O pior cenário é a empresa receber uma denúncia e não fazer nada. A omissão costuma falar alto — e fala contra a empresa.
      </p>

      <h2 className={H2}>6. Há acompanhamento dos afastamentos e sinais de adoecimento?</h2>
      <p className={P}>
        Afastamentos recorrentes, aumento de atestados, rotatividade elevada, conflitos frequentes e queda de produtividade podem indicar problemas no ambiente de trabalho.
      </p>
      <p className={P}>
        Esses dados devem ser observados com cuidado, sempre respeitando a privacidade do trabalhador, mas sem ignorar sinais evidentes de risco organizacional.
      </p>

      <h2 className={H2}>7. O jurídico participa da prevenção?</h2>
      <p className={P}>
        A adequação à NR-1 não deve ficar restrita ao RH ou à segurança do trabalho.
      </p>
      <p className={P}>
        O jurídico tem papel essencial na análise de risco, na construção de políticas internas, na orientação de gestores, na documentação das medidas preventivas e na redução de passivos trabalhistas.
      </p>
      <p className={P}>
        Prevenção boa é aquela que começa antes da notificação, da denúncia ou da inicial trabalhista.
      </p>

      <h2 className={H2}>Conclusão</h2>
      <p className={P}>
        A nova NR-1 exige uma mudança de postura. Empresas que tratam saúde mental apenas como tema abstrato ficarão expostas. Empresas que estruturam prevenção, documentação e gestão sairão mais protegidas.
      </p>
      <p className={P}>
        A pergunta não é se sua empresa terá que olhar para os riscos psicossociais. A pergunta é se ela fará isso agora, com estratégia, ou depois, com pressa e advogado correndo atrás do prejuízo.
      </p>
    </ArticleLayout>
  )
}
