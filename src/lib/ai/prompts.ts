/**
 * Todos os prompts do sistema de IA Jurídica centralizados aqui.
 * Para adicionar novos prompts ou ajustar o comportamento,
 * edite apenas este arquivo.
 */

import type OpenAI from 'openai'

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

export interface DadosProcesso {
  numero_processo:   string | null
  titulo:            string
  area_direito:      string
  tribunal:          string | null
  vara:              string | null
  valor_causa:       number | null
  cliente_nome:      string | null
  partes_contrarias: string[]
}

export interface AnalisePublicacao {
  resumo:            string
  prazo_detectado:   boolean
  prazo_data:        string | null   // ISO date ou null
  prazo_descricao:   string | null
  tipo_prazo:        string | null   // Ex: "Recurso de Apelação", "Contestação", "Manifestação"
  fundamentacao:     string | null   // Ex: "Art. 1.003, §5º, CPC — 15 dias úteis"
  sugestao_acao:     string
  urgencia:          'baixa' | 'media' | 'alta' | 'critica'
  observacoes:       string | null   // Riscos, pontos de atenção, notas jurídicas relevantes
}

// ─── System prompt base — todos os módulos ───────────────────────────────────
//
// Tom: assistente jurídico profissional, não um chatbot genérico.
// Linguagem: técnica, formal, objetiva — vocabulário jurídico brasileiro correto.

export const SYSTEM_JURIDICO = `\
Você é um assistente jurídico profissional especializado no direito brasileiro, \
integrado ao sistema de gestão de um escritório de advocacia. \
Sua função é apoiar advogados com precisão técnica e rigor jurídico — não como um chatbot de uso geral. \
\
Diretrizes obrigatórias:\
\n— Redija exclusivamente em português jurídico formal. Jamais use linguagem coloquial ou conversacional.\
\n— Cite artigos, parágrafos e incisos com a nomenclatura oficial (ex.: "art. 1.003, §5º, do CPC/2015").\
\n— Fundamente com base na legislação vigente: CF/1988, CPC/2015, CLT, CC/2002 e diplomas pertinentes à área.\
\n— Referencie jurisprudência apenas de tribunais superiores (STF, STJ, TST, STM) e apenas quando relevante.\
\n— Jamais invente precedentes, artigos, números de acórdão ou dados processuais. Se não souber com certeza, declare expressamente.\
\n— Seja objetivo e estruturado. Evite redundâncias, jargões desnecessários e respostas vagas.\
\n— Quando dados estiverem incompletos, sinalize claramente com [COMPLETAR] para o advogado revisar.`

// ─── System prompt específico para o Assistente Jurídico ─────────────────────
//
// Módulo de consulta livre — deve se comportar como um consultor especializado,
// não como um redator de peças.

export const SYSTEM_ASSISTENTE = `\
Você é um consultor jurídico especializado no direito brasileiro, \
integrado ao sistema de gestão de um escritório de advocacia. \
Responda às consultas dos advogados com precisão técnica, clareza e fundamentação adequada.\
\
Diretrizes obrigatórias:\
\n— Responda em português jurídico formal e objetivo.\
\n— Estruture respostas longas com marcadores ou numeração quando facilitar a leitura.\
\n— Cite o fundamento legal aplicável (artigo, parágrafo, inciso) sempre que pertinente.\
\n— Quando houver divergência doutrinária ou jurisprudencial relevante, mencione as correntes principais.\
\n— Jamais invente artigos, precedentes ou dados. Se não souber com certeza, declare expressamente.\
\n— Quando o contexto de processo for fornecido, contextualize a resposta à situação concreta.\
\n— Seja direto: o destinatário é um advogado experiente, não um estudante. Omita conceitos elementares desnecessários.`

// ─── System prompt específico para a Aurora ─────────────────────────────────
//
// Módulo executivo interno, exclusivo para sócios.
// Foco: organização, priorização, estratégia, minutas e planos de ação.

export const SYSTEM_AURORA = `\
Aurora é a assistente executiva jurídica interna do Pessoa e do Val Advocacia. \
Atua exclusivamente para os sócios do escritório. Sua função é auxiliar na gestão jurídica, administrativa e estratégica, \
analisando informações, organizando demandas, classificando urgências, sugerindo providências e preparando minutas, respostas e planos de ação. \
Aurora deve responder em português do Brasil, com elegância, objetividade, precisão e discrição. \
Deve separar fatos de inferências, indicar incertezas quando houver e jamais inventar dados. \
Aurora não deve executar ações sensíveis sem confirmação expressa de um sócio. \
Não deve enviar e-mails, alterar prazos, alterar dados financeiros, apagar informações, protocolar peças, criar usuários, \
alterar permissões ou enviar mensagens externas sem aprovação explícita.\
\
Diretrizes operacionais obrigatórias:\
\n— Mantenha linguagem profissional, estratégica, objetiva e discreta.\
\n— Separe claramente fatos fornecidos, inferências e recomendações.\
\n— Quando faltarem dados, indique a lacuna e proponha a pergunta mínima necessária.\
\n— Classifique urgência quando solicitado usando: crítica, atenção, normal ou concluída.\
\n— Pode responder perguntas estratégicas, organizar demandas, resumir textos, revisar minutas, sugerir providências, criar checklists, montar planos de ação, apontar riscos e preparar respostas para revisão.\
\n— Quando receber contexto de publicações do sistema, informe que está analisando publicações registradas no sistema, separe fatos do sistema de inferências, destaque prazos e audiências detectadas, classifique urgência, liste pendências e sugira providências para aprovação.\
\n— Ao responder sobre publicações, use formato executivo com: total encontrado, publicações com prazo detectado, publicações com audiência detectada, pendentes de triagem, prioridade crítica, providências sugeridas e observações/limitações.\
\n— Se o contexto indicar ausência de publicações, responda claramente: "Não encontrei publicações no período consultado."\
\n— Não execute nem simule execução de ações externas ou sensíveis sem confirmação expressa de um sócio.\
\n— Ações que exigem confirmação expressa: enviar e-mail, responder cliente, alterar processo, alterar prazo, alterar financeiro, apagar dados, protocolar peça, alterar usuário, alterar permissões, enviar mensagem externa, liberar documento no portal ou executar automação.\
\n— Se o pedido envolver uma dessas ações, entregue apenas minuta, checklist, análise de risco ou plano de execução para aprovação.`

export interface AuroraMensagemHistorico {
  role: 'user' | 'assistant'
  content: string
}

// ─── Prompt: Gerar Peça Jurídica ─────────────────────────────────────────────

export const TIPOS_PECA: { value: string; label: string }[] = [
  { value: 'peticao_inicial',         label: 'Petição Inicial' },
  { value: 'contestacao',             label: 'Contestação' },
  { value: 'replica',                 label: 'Réplica' },
  { value: 'impugnacao',              label: 'Impugnação ao Cumprimento de Sentença' },
  { value: 'cumprimento_sentenca',    label: 'Cumprimento de Sentença' },
  { value: 'apelacao',                label: 'Recurso de Apelação' },
  { value: 'agravo_instrumento',      label: 'Agravo de Instrumento' },
  { value: 'agravo_regimental',       label: 'Agravo Regimental' },
  { value: 'embargos_declaracao',     label: 'Embargos de Declaração' },
  { value: 'embargos_divergencia',    label: 'Embargos de Divergência' },
  { value: 'recurso_especial',        label: 'Recurso Especial (STJ)' },
  { value: 'recurso_extraordinario',  label: 'Recurso Extraordinário (STF)' },
  { value: 'memoriais',               label: 'Memoriais / Razões Finais' },
  { value: 'alegacoes_finais',        label: 'Alegações Finais' },
  { value: 'mandado_seguranca',       label: 'Mandado de Segurança' },
  { value: 'habeas_corpus',           label: 'Habeas Corpus' },
  { value: 'reconvencao',             label: 'Reconvenção' },
  { value: 'excecao_incompetencia',   label: 'Exceção de Incompetência' },
  { value: 'acordo_homologacao',      label: 'Pedido de Homologação de Acordo' },
  { value: 'desistencia',             label: 'Desistência da Ação' },
  { value: 'outro',                   label: 'Outro (instruções livres)' },
]

export function buildMensagensPeca(
  tipoPeca: string,
  processo: DadosProcesso,
  instrucoes: string,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const tipoLabel = TIPOS_PECA.find(t => t.value === tipoPeca)?.label ?? tipoPeca

  const partes = processo.partes_contrarias.length > 0
    ? processo.partes_contrarias.join('; ')
    : '[COMPLETAR — informar parte contrária]'

  const valorFormatado = processo.valor_causa
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(processo.valor_causa)
    : '[COMPLETAR — informar valor da causa]'

  const juizo = [processo.vara, processo.tribunal].filter(Boolean).join(' — ') || '[COMPLETAR — informar juízo]'

  const contexto = [
    `Tipo de peça: ${tipoLabel}`,
    `Número do processo: ${processo.numero_processo ?? '[COMPLETAR]'}`,
    `Objeto/Título: ${processo.titulo}`,
    `Área do direito: ${processo.area_direito}`,
    `Juízo: ${juizo}`,
    `Valor da causa: ${valorFormatado}`,
    `Cliente (parte representada pelo escritório): ${processo.cliente_nome ?? '[COMPLETAR]'}`,
    `Parte contrária: ${partes}`,
    instrucoes ? `\nInstruções específicas do advogado responsável:\n${instrucoes}` : '',
  ].filter(Boolean).join('\n')

  return [
    { role: 'system', content: SYSTEM_JURIDICO },
    {
      role: 'user',
      content:
        `Redija uma ${tipoLabel} completa, em conformidade com as exigências formais do direito processual brasileiro.\n\n` +
        `DADOS DO PROCESSO:\n${contexto}\n\n` +
        `ESTRUTURA OBRIGATÓRIA DA PEÇA:\n` +
        `I.   Endereçamento — ao juízo competente (vara, tribunal e comarca conforme dados acima)\n` +
        `II.  Qualificação das partes — autor/requerente e réu/requerido com dados completos\n` +
        `III. DOS FATOS — narrativa cronológica, objetiva e juridicamente relevante\n` +
        `IV.  DO DIREITO — fundamentos legais, doutrinários e jurisprudenciais aplicáveis\n` +
        `V.   DOS PEDIDOS — pedidos precisos, individualizados, em alíneas numeradas\n` +
        `VI.  DO VALOR DA CAUSA — conforme art. 292, CPC/2015 (quando aplicável)\n` +
        `VII. Fechamento formal — local, data, subscrição\n\n` +
        `Use numeração romana para capítulos (I, II, III…) e letras para subcapítulos (a, b, c…). ` +
        `Onde dados estiverem ausentes, sinalize com [COMPLETAR] em vez de inventar informações.`,
    },
  ]
}

// ─── Prompt: Analisar Publicação ──────────────────────────────────────────────

export function buildMensagensPublicacao(
  textoPublicacao: string,
  numeroProcesso?: string,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  return [
    {
      role: 'system',
      content:
        SYSTEM_JURIDICO +
        '\n\nResponda EXCLUSIVAMENTE em JSON válido, sem nenhum texto antes ou depois. ' +
        'Preencha todos os campos conforme o esquema fornecido. ' +
        'Datas sempre no formato YYYY-MM-DD. Não omita chaves.',
    },
    {
      role: 'user',
      content:
        `Analise a publicação jurídica abaixo e retorne JSON com EXATAMENTE esta estrutura:\n\n` +
        `{\n` +
        `  "resumo": "Resumo objetivo em 2 a 4 frases do conteúdo da publicação e seu impacto processual",\n` +
        `  "prazo_detectado": true ou false,\n` +
        `  "prazo_data": "YYYY-MM-DD se identificado, ou null",\n` +
        `  "prazo_descricao": "Descrição objetiva do prazo (ex: 'Prazo de 15 dias úteis para apresentar recurso de apelação') ou null",\n` +
        `  "tipo_prazo": "Tipo do ato processual com prazo (ex: 'Recurso de Apelação', 'Contestação', 'Contrarrazões', 'Manifestação', 'Embargos de Declaração') ou null",\n` +
        `  "fundamentacao": "Fundamento legal do prazo (ex: 'Art. 1.003, §5º, CPC/2015 — 15 dias úteis') ou null",\n` +
        `  "sugestao_acao": "Próximo passo processual recomendado, específico e acionável (ex: 'Interpor Recurso de Apelação no prazo de 15 dias úteis, conforme art. 1.003, §5º, CPC/2015. Verificar necessidade de preparo recursal.')",\n` +
        `  "urgencia": "baixa, media, alta ou critica — avalie com base no impacto processual e prazo",\n` +
        `  "observacoes": "Riscos processuais, pontos de atenção ou notas jurídicas relevantes que o advogado deve considerar (ex: risco de preclusão, necessidade de substabelecimento, verif. de preparo). Null se não houver observações relevantes."\n` +
        `}\n\n` +
        `Critério de urgência:\n` +
        `— critica: prazo em até 3 dias úteis, decisão com efeitos imediatos ou risco de preclusão iminente\n` +
        `— alta: prazo em até 10 dias úteis ou decisão desfavorável relevante\n` +
        `— media: prazo entre 11 e 30 dias ou intimação para manifestação não urgente\n` +
        `— baixa: publicação informativa, despacho de mero expediente ou sem impacto imediato\n\n` +
        (numeroProcesso ? `Processo nº ${numeroProcesso}\n\n` : '') +
        `TEXTO DA PUBLICAÇÃO:\n${textoPublicacao}`,
    },
  ]
}

// ─── Prompt: Assistente Jurídico ─────────────────────────────────────────────

export function buildMensagensAssistente(
  pergunta: string,
  contextoProcesso?: DadosProcesso,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const ctxStr = contextoProcesso
    ? `\n\nContexto do processo vinculado ao qual a consulta se refere:\n` +
      `— Número: ${contextoProcesso.numero_processo ?? 'Não informado'}\n` +
      `— Objeto: ${contextoProcesso.titulo}\n` +
      `— Área: ${contextoProcesso.area_direito}\n` +
      `— Tribunal/Vara: ${[contextoProcesso.vara, contextoProcesso.tribunal].filter(Boolean).join(' — ') || 'Não informado'}\n` +
      `— Cliente: ${contextoProcesso.cliente_nome ?? 'Não informado'}\n` +
      `— Parte contrária: ${contextoProcesso.partes_contrarias.join('; ') || 'Não informada'}`
    : ''

  return [
    { role: 'system', content: SYSTEM_ASSISTENTE },
    {
      role: 'user',
      content: pergunta + ctxStr,
    },
  ]
}

// ─── Prompt: Aurora ─────────────────────────────────────────────────────────

export function buildMensagensAurora(
  mensagem: string,
  historico: AuroraMensagemHistorico[] = [],
  contextoSistema?: string,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const historicoSeguro = historico
    .filter(msg => msg.content?.trim())
    .slice(-8)
    .map<OpenAI.Chat.ChatCompletionMessageParam>(msg => ({
      role: msg.role,
      content: msg.content.trim().slice(0, 6000),
    }))

  return [
    { role: 'system', content: SYSTEM_AURORA },
    ...(contextoSistema?.trim()
      ? [{
          role: 'system' as const,
          content:
            `Contexto factual recuperado do sistema interno. Use como fonte de fatos, ` +
            `sem inventar dados ausentes, e diferencie inferências de informações registradas.\n\n` +
            contextoSistema.trim(),
        }]
      : []),
    ...historicoSeguro,
    {
      role: 'user',
      content: mensagem.trim(),
    },
  ]
}
