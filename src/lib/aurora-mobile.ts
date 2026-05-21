export const AURORA_MOBILE_QUICK_COMMANDS = [
  { label: 'Ver publicações de hoje', message: 'Aurora, verifique as publicações de hoje e destaque urgências, prazos e pendências de triagem.' },
  { label: 'Ver prazos de hoje', message: 'Aurora, liste os prazos de hoje e organize por prioridade, responsável e risco.' },
  { label: 'Ver Gmail', message: 'Aurora, prepare uma consulta segura dos e-mails recentes do Gmail, sem modificar nenhuma mensagem.' },
  { label: 'Buscar limpeza segura', message: 'Aurora, ajude a revisar candidatos de limpeza do Gmail com critério conservador, sem arquivar, excluir ou alterar e-mails.' },
  { label: 'Resumo do dia', message: 'Aurora, monte um resumo executivo do dia com publicações, prazos, compromissos e providências críticas.' },
] as const

export const AURORA_MOBILE_MODULE_LINKS = [
  { label: 'Abrir Publicações', href: '/publicacoes' },
  { label: 'Abrir Gmail', href: '/integracoes/gmail' },
  { label: 'Abrir Monitoramento', href: '/monitoramento' },
] as const

export type AuroraMobileQuickCommand = typeof AURORA_MOBILE_QUICK_COMMANDS[number]
