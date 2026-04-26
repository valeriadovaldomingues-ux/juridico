/**
 * Prompts premium de IA Jurídica.
 * Tom: sócio sênior de escritório de alta performance — não assistente genérico.
 */

import type OpenAI from 'openai'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface DadosProcesso {
  numero_processo:     string | null
  titulo:              string
  area_direito:        string
  tribunal:            string | null
  vara:                string | null
  valor_causa:         number | null
  cliente_nome:        string | null
  partes_contrarias:   string[]
  // Contexto operacional
  ultimo_andamento?:   string | null
  prazos_proximos?:    Array<{ titulo: string; data: string; tipo: string }>
  publicacoes?:        string[]
  observacoes?:        string | null
}

export interface AnaliseEstrategica {
  diagnostico:            string
  nivel_risco:            'baixo' | 'medio' | 'alto' | 'critico'
  urgencia:               'normal' | 'atencao' | 'urgente' | 'critica'
  prazo_fatal:            string | null
  prazo_descricao:        string | null
  proxima_acao:           string
  estrategia_recomendada: string
  pontos_fortes:          string[]
  pontos_fracos:          string[]
  teses_juridicas:        string[]
}

export interface AnalisePublicacao {
  resumo:          string
  prazo_detectado: boolean
  prazo_data:      string | null
  prazo_descricao: string | null
  tipo_prazo:      string | null
  fundamentacao:   string | null
  sugestao_acao:   string
  urgencia:        'baixa' | 'media' | 'alta' | 'critica'
  observacoes:     string | null
}

// ── System prompts ────────────────────────────────────────────────────────────

export const SYSTEM_PECA = `\
Você é um advogado sênior com 25 anos de experiência em escritórios de alta performance, \
especializado em direito processual civil e material brasileiro. \
Você redigiu milhares de peças acolhidas por juízes, desembargadores e ministros. \
Sua escrita é técnica, precisa, persuasiva e elegante — nunca genérica ou formulada.

DIRETRIZES ABSOLUTAS:
— Redija exclusivamente em português jurídico forense. Zero linguagem coloquial.
— Argumente em camadas: factual → normativa → doutrinária → jurisprudencial → lógico-jurídica.
— Cite artigos com nomenclatura oficial: "art. 1.003, §5º, do CPC/2015", "art. 5º, LIV, da CF/1988".
— JAMAIS invente artigos, precedentes, números de acórdão ou fatos. Use [COMPLETAR] quando necessário.
— Seja objetivo. Corte redundâncias. Cada parágrafo deve agregar argumento, não decoração.
— Fundamente com legislação vigente pertinente à área do processo.

VISUAL LAW — FORMATAÇÃO OBRIGATÓRIA:
— Endereçamento: bloco separado, sem recuo, linha em branco antes e depois.
— Seções em MAIÚSCULAS numeradas em romano: "I — DOS FATOS", "II — DO DIREITO".
— Subseções: "A — DA RESPONSABILIDADE CONTRATUAL" (maiúsculas, letra).
— Pedidos SEMPRE em alíneas: "a)", "b)", "c)" — um pedido por linha.
— Parágrafos curtos (máx. 6 linhas). Separados por linha em branco.
— Fechamento: [Cidade], [data]. / [ADVOGADO] / OAB/[UF] [número]

QUALIDADE: cada peça deve ser pronta para protocolo.`

export const SYSTEM_ESTRATEGIA = `\
Você é um consultor estratégico jurídico sênior, especializado em avaliação de risco processual \
e estratégia de litígio no direito brasileiro. \
Analise o processo fornecido e retorne avaliação técnica, objetiva e acionável. \
Responda EXCLUSIVAMENTE em JSON válido conforme o schema. \
Jamais invente fatos ou precedentes.`

export const SYSTEM_JURIDICO = `\
Você é um consultor jurídico sênior especializado em direito brasileiro, \
integrado ao sistema de um escritório de alta performance. \
O destinatário é um advogado experiente — vá direto ao ponto.

DIRETRIZES:
— Português jurídico formal. Zero linguagem coloquial.
— Estruture com numeração ou marcadores quando facilitar a leitura.
— Cite fundamento legal aplicável sempre que pertinente.
— Jamais invente artigos ou precedentes. Declare incerteza quando houver.`

export const SYSTEM_ASSISTENTE = SYSTEM_JURIDICO

// ── Tipos de peça disponíveis ─────────────────────────────────────────────────

export const TIPOS_PECA: { value: string; label: string }[] = [
  { value: 'peticao_inicial',         label: 'Petição Inicial' },
  { value: 'contestacao',             label: 'Contestação' },
  { value: 'replica',                 label: 'Réplica' },
  { value: 'reconvencao',             label: 'Reconvenção' },
  { value: 'tutela_urgencia',         label: 'Pedido de Tutela de Urgência/Evidência' },
  { value: 'apelacao',                label: 'Recurso de Apelação' },
  { value: 'contrarrazoes_apelacao',  label: 'Contrarrazões de Apelação' },
  { value: 'agravo_instrumento',      label: 'Agravo de Instrumento' },
  { value: 'agravo_regimental',       label: 'Agravo Regimental/Interno' },
  { value: 'embargos_declaracao',     label: 'Embargos de Declaração' },
  { value: 'embargos_divergencia',    label: 'Embargos de Divergência' },
  { value: 'recurso_especial',        label: 'Recurso Especial (STJ)' },
  { value: 'recurso_extraordinario',  label: 'Recurso Extraordinário (STF)' },
  { value: 'recurso_ordinario',       label: 'Recurso Ordinário Trabalhista' },
  { value: 'cumprimento_sentenca',    label: 'Cumprimento de Sentença' },
  { value: 'impugnacao',              label: 'Impugnação ao Cumprimento de Sentença' },
  { value: 'embargos_execucao',       label: 'Embargos à Execução' },
  { value: 'memoriais',               label: 'Memoriais / Razões Finais' },
  { value: 'alegacoes_finais',        label: 'Alegações Finais' },
  { value: 'mandado_seguranca',       label: 'Mandado de Segurança' },
  { value: 'habeas_corpus',           label: 'Habeas Corpus' },
  { value: 'acordo_homologacao',      label: 'Pedido de Homologação de Acordo' },
  { value: 'excecao_incompetencia',   label: 'Exceção de Incompetência' },
  { value: 'desistencia',             label: 'Desistência da Ação' },
  { value: 'outro',                   label: 'Outro (instruções livres)' },
]

// ── Builder de prompt para peça jurídica ─────────────────────────────────────

export function buildMensagensPeca(
  tipoPeca: string,
  processo: DadosProcesso,
  instrucoes: string,
  analise?: AnaliseEstrategica | null,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const tipoLabel = TIPOS_PECA.find(t => t.value === tipoPeca)?.label ?? tipoPeca
  const partes = processo.partes_contrarias.length > 0
    ? processo.partes_contrarias.join('; ')
    : '[COMPLETAR — informar parte contrária]'
  const valorFmt = processo.valor_causa
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(processo.valor_causa)
    : '[COMPLETAR]'
  const juizo = [processo.vara, processo.tribunal].filter(Boolean).join(' — ') || '[COMPLETAR]'

  const ctxOperacional: string[] = []
  if (processo.ultimo_andamento) ctxOperacional.push(`Último andamento: ${processo.ultimo_andamento}`)
  if (processo.prazos_proximos?.length) {
    ctxOperacional.push('Prazos pendentes:\n' +
      processo.prazos_proximos.map(p => `  • ${p.data} — ${p.titulo} (${p.tipo})`).join('\n'))
  }
  if (processo.publicacoes?.length) {
    ctxOperacional.push('Publicações recentes:\n' + processo.publicacoes.map(p => `  • ${p}`).join('\n'))
  }
  if (processo.observacoes) ctxOperacional.push(`Observações: ${processo.observacoes}`)

  const ctxEstrategia = analise ? [
    `ANÁLISE ESTRATÉGICA:`,
    `Diagnóstico: ${analise.diagnostico}`,
    `Risco: ${analise.nivel_risco.toUpperCase()} | Urgência: ${analise.urgencia.toUpperCase()}`,
    analise.prazo_fatal ? `Prazo fatal: ${analise.prazo_fatal} — ${analise.prazo_descricao}` : '',
    `Estratégia: ${analise.estrategia_recomendada}`,
    analise.teses_juridicas.length ? `Teses aplicáveis: ${analise.teses_juridicas.join('; ')}` : '',
  ].filter(Boolean).join('\n') : ''

  const contexto = [
    `IDENTIFICAÇÃO:`,
    `Número: ${processo.numero_processo ?? '[COMPLETAR]'}`,
    `Objeto: ${processo.titulo}`,
    `Área: ${processo.area_direito}`,
    `Juízo: ${juizo}`,
    `Valor da causa: ${valorFmt}`,
    ``,
    `PARTES:`,
    `Representado: ${processo.cliente_nome ?? '[COMPLETAR]'}`,
    `Parte contrária: ${partes}`,
    ``,
    ...(ctxOperacional.length ? [`SITUAÇÃO ATUAL:`, ...ctxOperacional, ``] : []),
    ...(ctxEstrategia ? [ctxEstrategia, ``] : []),
    ...(instrucoes ? [`INSTRUÇÕES DO ADVOGADO:`, instrucoes] : []),
  ].join('\n')

  const estrutura = tipoPeca === 'outro'
    ? instrucoes || 'Redija conforme as instruções.'
    : `Estrutura obrigatória:\n` +
      `I   — ENDEREÇAMENTO (ao juízo competente)\n` +
      `II  — QUALIFICAÇÃO DAS PARTES (completa)\n` +
      `III — DOS FATOS (cronológico, objetivo, juridicamente relevante)\n` +
      `IV  — DO DIREITO (legal + doutrinário + jurisprudencial)\n` +
      `V   — DOS PEDIDOS (alíneas individualizadas)\n` +
      `VI  — DO VALOR DA CAUSA (art. 292, CPC/2015 quando aplicável)\n` +
      `VII — Fechamento formal\n\n` +
      `Use as teses disponíveis na análise estratégica. Seja persuasivo.`

  return [
    { role: 'system', content: SYSTEM_PECA },
    {
      role: 'user',
      content:
        `TIPO: ${tipoLabel}\n\n` +
        `${contexto}\n\n` +
        `${estrutura}`,
    },
  ]
}

// ── Builder de análise estratégica ───────────────────────────────────────────

export function buildMensagensAnaliseEstrategica(
  processo: DadosProcesso,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const juizo = [processo.vara, processo.tribunal].filter(Boolean).join(' — ') || 'N/I'
  const ctxOp: string[] = []
  if (processo.ultimo_andamento) ctxOp.push(`Último andamento: ${processo.ultimo_andamento}`)
  if (processo.prazos_proximos?.length) {
    ctxOp.push('Prazos: ' + processo.prazos_proximos.map(p => `${p.data} — ${p.titulo}`).join('; '))
  }
  if (processo.publicacoes?.length) ctxOp.push('Publicações recentes: ' + processo.publicacoes.join('; '))
  if (processo.observacoes) ctxOp.push(`Obs: ${processo.observacoes}`)

  return [
    {
      role: 'system',
      content: SYSTEM_ESTRATEGIA +
        '\n\nResponda EXCLUSIVAMENTE em JSON válido. Datas em YYYY-MM-DD. ' +
        'Arrays nunca vazios — use ["Não identificado"] se sem dados.',
    },
    {
      role: 'user',
      content:
        `Analise e retorne JSON:\n\n` +
        `{"diagnostico":"string","nivel_risco":"baixo|medio|alto|critico","urgencia":"normal|atencao|urgente|critica",` +
        `"prazo_fatal":"YYYY-MM-DD ou null","prazo_descricao":"string ou null","proxima_acao":"string",` +
        `"estrategia_recomendada":"string","pontos_fortes":["..."],"pontos_fracos":["..."],"teses_juridicas":["..."]}\n\n` +
        `PROCESSO:\n` +
        `Número: ${processo.numero_processo ?? 'N/I'}\n` +
        `Objeto: ${processo.titulo}\n` +
        `Área: ${processo.area_direito}\n` +
        `Juízo: ${juizo}\n` +
        `Cliente: ${processo.cliente_nome ?? 'N/I'}\n` +
        `Parte contrária: ${processo.partes_contrarias.join('; ') || 'N/I'}\n` +
        (processo.valor_causa ? `Valor: R$ ${processo.valor_causa.toLocaleString('pt-BR')}\n` : '') +
        (ctxOp.length ? `\nSITUAÇÃO:\n${ctxOp.join('\n')}` : '') +
        `\n\nRisco: critico=perda total/prazo fatal, alto=fundamentos fracos/prazo próximo, medio=equilibrado, baixo=sólido/sem urgência`,
    },
  ]
}

// ── Builder de publicação ─────────────────────────────────────────────────────

export function buildMensagensPublicacao(
  textoPublicacao: string,
  numeroProcesso?: string,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  return [
    {
      role: 'system',
      content: SYSTEM_JURIDICO + '\n\nResponda EXCLUSIVAMENTE em JSON válido. Datas em YYYY-MM-DD.',
    },
    {
      role: 'user',
      content:
        `Analise a publicação e retorne JSON:\n\n` +
        `{"resumo":"string","prazo_detectado":bool,"prazo_data":"YYYY-MM-DD ou null","prazo_descricao":"string ou null",` +
        `"tipo_prazo":"string ou null","fundamentacao":"string ou null","sugestao_acao":"string",` +
        `"urgencia":"baixa|media|alta|critica","observacoes":"string ou null"}\n\n` +
        `Urgência: critica=≤3 dias úteis, alta=≤10 dias, media=11-30 dias, baixa=informativa\n\n` +
        (numeroProcesso ? `Processo nº ${numeroProcesso}\n\n` : '') +
        `PUBLICAÇÃO:\n${textoPublicacao}`,
    },
  ]
}

// ── Builder do assistente ─────────────────────────────────────────────────────

export function buildMensagensAssistente(
  pergunta: string,
  contextoProcesso?: DadosProcesso,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const ctxStr = contextoProcesso
    ? `\n\nContexto: Processo ${contextoProcesso.numero_processo ?? 'S/N'} — ${contextoProcesso.titulo}\n` +
      `Área: ${contextoProcesso.area_direito} | Juízo: ${[contextoProcesso.vara, contextoProcesso.tribunal].filter(Boolean).join(' — ') || 'N/I'}\n` +
      `Cliente: ${contextoProcesso.cliente_nome ?? 'N/I'} | Parte contrária: ${contextoProcesso.partes_contrarias.join('; ') || 'N/I'}` +
      (contextoProcesso.ultimo_andamento ? `\nÚltimo andamento: ${contextoProcesso.ultimo_andamento}` : '')
    : ''

  return [
    { role: 'system', content: SYSTEM_ASSISTENTE },
    { role: 'user', content: pergunta + ctxStr },
  ]
}
