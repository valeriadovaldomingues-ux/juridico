import type { AuroraAgentId, AuroraAgentRegistryEntry } from './types'

export const AURORA_AGENT_REGISTRY = [
  {
    id: 'principal',
    nome: 'Aurora Principal',
    descricaoCurta: 'Orquestradora leve que classifica a intenção e consolida a resposta final.',
    escopoResumido: 'Classificação de intenção, roteamento e consolidação final.',
    keywords: ['aurora', 'geral', 'organizar', 'classificar', 'consolidar', 'resumir'],
    restricoesPrincipais: [
      'Não carrega prompts de todos os agentes.',
      'Não faz debate entre agentes por padrão.',
      'Escolhe apenas um agente no modo rápido.',
    ],
    promptCompacto: 'Classifique a intenção, escolha um único subagente e consolide a resposta final.',
    ferramentasPermitidas: ['roteamento', 'consolidação', 'resposta_texto'],
    modoPadrao: 'rapido',
    suportaModoProfundo: true,
  },
  {
    id: 'olavo',
    nome: 'Olavo',
    descricaoCurta: 'Processos, prazos, publicações e andamentos.',
    escopoResumido: 'Leitura e triagem processual com foco em urgência e providências.',
    keywords: ['processo', 'processos', 'prazo', 'prazos', 'publicação', 'publicacoes', 'andamento', 'andamentos', 'audiencia', 'audiência', 'intimacao', 'intimação', 'dje', 'diario', 'diário'],
    restricoesPrincipais: [
      'Não protocola, altera ou exclui sem confirmação expressa.',
      'Não executa medidas sensíveis automaticamente.',
    ],
    promptCompacto: 'Foque em processos, prazos, publicações e andamentos, sem ações automáticas sensíveis.',
    ferramentasPermitidas: ['leitura_processual', 'leitura_publicacoes', 'resumo_andamentos'],
    modoPadrao: 'rapido',
    suportaModoProfundo: true,
  },
  {
    id: 'stella',
    nome: 'Stella',
    descricaoCurta: 'E-mails: triagem, resumo, sugestão de resposta e rascunhos.',
    escopoResumido: 'Leitura e preparação de respostas de e-mail sem envio automático.',
    keywords: ['email', 'e-mail', 'inbox', 'caixa de entrada', 'rascunho', 'resposta', 'triagem', 'mensagem', 'mensagens'],
    restricoesPrincipais: [
      'Nunca envia e-mail automaticamente.',
      'Toda resposta exige validação humana antes do envio.',
    ],
    promptCompacto: 'Triagem de e-mails, resumo, sugestão de resposta e rascunho, sem envio automático.',
    ferramentasPermitidas: ['leitura_email', 'resumo_email', 'rascunho_email'],
    modoPadrao: 'rapido',
    suportaModoProfundo: true,
  },
  {
    id: 'oraculo',
    nome: 'Oráculo',
    descricaoCurta: 'Estratégia jurídica e empresarial.',
    escopoResumido: 'Análise de risco, cenários, prioridade e próximos passos.',
    keywords: ['estrategia', 'estratégia', 'estrategico', 'estratégico', 'risco', 'riscos', 'acordo', 'tese', 'prioridade', 'prioridades', 'cenario', 'cenário', 'plano'],
    restricoesPrincipais: [
      'Não executa ações sensíveis.',
      'Entrega análise e recomendações, não execução.',
    ],
    promptCompacto: 'Produza análise estratégica, riscos, prioridades e cenários de forma objetiva.',
    ferramentasPermitidas: ['analise_estrategica', 'resumo_risco'],
    modoPadrao: 'rapido',
    suportaModoProfundo: true,
  },
  {
    id: 'atlas',
    nome: 'Atlas',
    descricaoCurta: 'Documentos, petições, contratos e notificações.',
    escopoResumido: 'Rascunho e revisão documental com foco jurídico.',
    keywords: ['peticao', 'petição', 'peticoes', 'petições', 'contrato', 'contratos', 'notificacao', 'notificação', 'documento', 'documentos', 'procuracao', 'procuração', 'minuta', 'modelo'],
    restricoesPrincipais: [
      'Não envia documentos a cliente ou terceiro sem confirmação.',
      'Não automatiza a liberação de documentos.',
    ],
    promptCompacto: 'Rascunhe e revise documentos jurídicos, sem envio automático.',
    ferramentasPermitidas: ['rascunho_documental', 'revisao_documental'],
    modoPadrao: 'rapido',
    suportaModoProfundo: true,
  },
  {
    id: 'clara',
    nome: 'Clara',
    descricaoCurta: 'Clientes, follow-up e relacionamento.',
    escopoResumido: 'Histórico, pendências e acompanhamento de clientes.',
    keywords: ['cliente', 'clientes', 'follow-up', 'follow up', 'atendimento', 'pendencia', 'pendência', 'relacionamento', 'contato', 'retorno'],
    restricoesPrincipais: [
      'Não envia mensagens automaticamente.',
      'Não executa follow-up externo sem confirmação.',
    ],
    promptCompacto: 'Organize relacionamento com clientes, pendências e follow-up sem enviar mensagens automaticamente.',
    ferramentasPermitidas: ['historico_cliente', 'follow_up'],
    modoPadrao: 'rapido',
    suportaModoProfundo: true,
  },
  {
    id: 'dominic',
    nome: 'Dominic',
    descricaoCurta: 'Financeiro interno, horas, cobrança e produtividade.',
    escopoResumido: 'Horas trabalhadas, cobrança, produtividade e operação interna.',
    keywords: ['financeiro', 'cobranca', 'cobrança', 'hora', 'horas', 'faturamento', 'produtividade', 'tempo', 'valor hora', 'lançamento de horas'],
    restricoesPrincipais: [
      'Não cria cobrança automática sem confirmação.',
      'Não altera financeiro sensível sem aprovação expressa.',
    ],
    promptCompacto: 'Cuide de horas, cobrança, produtividade e operação interna com prudência.',
    ferramentasPermitidas: ['horas_trabalhadas', 'cobranca', 'operacao_interna'],
    modoPadrao: 'rapido',
    suportaModoProfundo: true,
  },
] as const satisfies readonly AuroraAgentRegistryEntry[]

export function listarAgentesAurora() {
  return AURORA_AGENT_REGISTRY
}

export function obterAgenteAurora(agentId: AuroraAgentId) {
  return AURORA_AGENT_REGISTRY.find(agent => agent.id === agentId) ?? AURORA_AGENT_REGISTRY[0]
}
