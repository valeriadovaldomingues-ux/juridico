import type { AuroraAgentId, AuroraAgentRegistryEntry } from './types'

export const AURORA_AGENT_REGISTRY = [
  {
    id: 'principal',
    nome: 'Aurora Principal',
    descricaoCurta: 'Orquestradora estratégica que classifica a intenção, distribui o fluxo e consolida a decisão final.',
    escopoResumido: 'Classificação de intenção, coordenação de subagentes e consolidação final.',
    keywords: ['aurora', 'geral', 'organizar', 'classificar', 'consolidar', 'resumir', 'coordenação', 'coordenar'],
    restricoesPrincipais: [
      'Não carrega prompts de todos os agentes por padrão.',
      'Não executa ações externas sem confirmação expressa.',
      'Consolida a resposta sem inventar dados.',
    ],
    promptCompacto: 'Classifique a intenção, chame apenas os subagentes relevantes e consolide a resposta final.',
    ferramentasPermitidas: ['roteamento', 'consolidação', 'resposta_texto'],
    modoPadrao: 'rapido',
    suportaModoProfundo: true,
  },
  {
    id: 'stella',
    nome: 'Stella',
    descricaoCurta: 'Monitoramento processual, prazos, publicações, intimações e movimentações.',
    escopoResumido: 'Leitura processual, alertas de prazo e relatórios executivos do andamento.',
    keywords: ['processo', 'processos', 'prazo', 'prazos', 'publicação', 'publicacoes', 'intimação', 'intimacao', 'movimentação', 'movimentacao', 'andamento', 'andamentos', 'audiência', 'audiencia', 'diário', 'diario', 'relatório', 'relatorio', 'e-mail', 'email', 'agenda'],
    restricoesPrincipais: [
      'Não envia e-mail automaticamente.',
      'Não altera processos nem prazos sem confirmação expressa.',
      'Entrega fatos, urgência e providência sugerida.',
    ],
    promptCompacto: 'Monitore processos, prazos, publicações, intimações e movimentações; sugira providências sem agir.',
    ferramentasPermitidas: ['monitoramento_processual', 'leitura_publicacoes', 'resumo_diario'],
    modoPadrao: 'rapido',
    suportaModoProfundo: true,
  },
  {
    id: 'olavo',
    nome: 'Olavo',
    descricaoCurta: 'Execução jurídica, peças, teses e providências processuais.',
    escopoResumido: 'Estruturação prática de petições, minutas, teses e providências.',
    keywords: ['peticao', 'petição', 'peça', 'peca', 'peças', 'pecas', 'minuta', 'minutas', 'tese', 'teses', 'recurso', 'contestação', 'contestacao', 'réplica', 'replica', 'providência', 'providencia', 'execução', 'execucao', 'andamento processual'],
    restricoesPrincipais: [
      'Não protocola, altera ou exclui sem confirmação expressa.',
      'Não executa medidas sensíveis automaticamente.',
    ],
    promptCompacto: 'Estruture peças, teses e providências processuais de forma prática e objetiva.',
    ferramentasPermitidas: ['rascunho_peca', 'analise_tese', 'providencia_processual'],
    modoPadrao: 'rapido',
    suportaModoProfundo: true,
  },
  {
    id: 'atlas',
    nome: 'Atlas',
    descricaoCurta: 'Gestão de projetos, fluxos, status, sincronização e bloqueadores.',
    escopoResumido: 'Acompanhamento operacional de tarefas e visibilidade entre agentes.',
    keywords: ['status', 'fluxo', 'fluxos', 'sincronização', 'sincronizacao', 'bloqueador', 'bloqueadores', 'responsável', 'responsavel', 'prazo', 'dependência', 'dependencia', 'andamento', 'prioridade', 'projeto', 'tarefas'],
    restricoesPrincipais: [
      'Não altera status definitivo sem confirmação expressa.',
      'Não executa ações externas sem aprovação.',
      'Não envia materiais para terceiros sem confirmação.',
    ],
    promptCompacto: 'Controle status, responsável, prazo, próximo passo e bloqueadores com máxima visibilidade.',
    ferramentasPermitidas: ['controle_status', 'sincronia', 'visibilidade_operacional'],
    modoPadrao: 'rapido',
    suportaModoProfundo: true,
  },
  {
    id: 'atena',
    nome: 'Atena',
    descricaoCurta: 'Financeiro, honorários, valor, lucro e viabilidade.',
    escopoResumido: 'Análise de margem, preço, viabilidade e proteção de tempo rentável.',
    keywords: ['financeiro', 'honorarios', 'honorário', 'valor', 'precificacao', 'precificação', 'preco', 'preço', 'lucro', 'margem', 'viabilidade', 'rentavel', 'rentável', 'cliente ruim', 'cliente bom', 'cobrança', 'cobranca'],
    restricoesPrincipais: [
      'Não cria cobrança automática sem confirmação expressa.',
      'Não altera financeiro sem aprovação.',
      'Recomenda valor e viabilidade; não executa lançamento.',
    ],
    promptCompacto: 'Avalie honorários, viabilidade financeira, margem e proteção do tempo do escritório.',
    ferramentasPermitidas: ['analise_financeira', 'precificacao', 'viabilidade'],
    modoPadrao: 'rapido',
    suportaModoProfundo: true,
  },
  {
    id: 'dominic',
    nome: 'Dominic',
    descricaoCurta: 'Marketing, posicionamento, autoridade e conversão.',
    escopoResumido: 'Estruturação de comunicação, oferta e atração de cliente ideal.',
    keywords: ['marketing', 'posicionamento', 'autoridade', 'atração', 'atracao', 'conversão', 'conversao', 'copy', 'conteudo', 'conteúdo', 'campanha', 'oferta', 'funil', 'anúncio', 'anuncio', 'post'],
    restricoesPrincipais: [
      'Não publica nada automaticamente.',
      'Não executa ação externa sem aprovação expressa.',
    ],
    promptCompacto: 'Estruture marketing, posicionamento, autoridade e conversão com foco no cliente ideal.',
    ferramentasPermitidas: ['estrategia_marketing', 'copy', 'posicionamento'],
    modoPadrao: 'rapido',
    suportaModoProfundo: true,
  },
  {
    id: 'olivia',
    nome: 'Olívia',
    descricaoCurta: 'Agenda, compromissos, prazos e previsibilidade temporal.',
    escopoResumido: 'Organização de agenda jurídica, conflitos e bloqueios de horário.',
    keywords: ['agenda', 'compromisso', 'compromissos', 'prazo', 'prazos', 'horário', 'horario', 'conflito', 'disponibilidade', 'calendário', 'calendario', 'bloqueio', 'bloqueios', 'tempo'],
    restricoesPrincipais: [
      'Não cria nem altera compromisso sem aprovação expressa.',
      'Não executa ajustes de agenda automaticamente.',
    ],
    promptCompacto: 'Organize agenda, compromissos, conflitos e previsibilidade temporal com disciplina.',
    ferramentasPermitidas: ['analise_agenda', 'previsibilidade_temporal'],
    modoPadrao: 'rapido',
    suportaModoProfundo: true,
  },
  {
    id: 'oraculo',
    nome: 'Oráculo',
    descricaoCurta: 'Estratégia dos sócios, gestão, produtividade e riscos internos.',
    escopoResumido: 'Cenários, risco, prioridade e decisão estratégica interna.',
    keywords: ['estrategia', 'estratégia', 'gestão', 'gestao', 'produtividade', 'risco', 'riscos', 'cenário', 'cenario', 'prioridade', 'decisão', 'decisao', 'planejamento', 'sócios', 'socios'],
    restricoesPrincipais: [
      'Não executa decisão nem ação sensível.',
      'Entrega cenário, risco e recomendação estratégica.',
    ],
    promptCompacto: 'Análise estratégica dos sócios com foco em cenário, risco, prioridade e decisão.',
    ferramentasPermitidas: ['analise_estrategica', 'cenario_risco'],
    modoPadrao: 'rapido',
    suportaModoProfundo: true,
  },
  {
    id: 'clara',
    nome: 'Clara',
    descricaoCurta: 'Clientes, follow-up e relacionamento.',
    escopoResumido: 'Histórico, pendências, acompanhamento e relacionamento com clientes.',
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
] as const satisfies readonly AuroraAgentRegistryEntry[]

export function listarAgentesAurora() {
  return AURORA_AGENT_REGISTRY
}

export function obterAgenteAurora(agentId: AuroraAgentId) {
  return AURORA_AGENT_REGISTRY.find(agent => agent.id === agentId) ?? AURORA_AGENT_REGISTRY[0]
}
