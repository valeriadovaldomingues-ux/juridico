export type StatusTecnicoFonte =
  | 'ativo'
  | 'ativo_parcial'
  | 'preparado'
  | 'pendente'
  | 'requer_credencial'
  | 'erro'

export interface DiagnosticoFontePendente {
  id: string
  tribunal: string
  ramo: 'estadual' | 'federal' | 'trabalhista' | 'eproc' | 'datajud'
  fonteProvavel: string
  status: StatusTecnicoFonte
  endpoint?: string
  exigeCredencial: boolean
  validada: boolean
  capturaPublicacaoReal: boolean
  motivo: string
  proximaAcao: string
}

const DJEN_ENDPOINT = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'

export const MATRIZ_FONTES_MONITORAMENTO: DiagnosticoFontePendente[] = [
  {
    id: 'tjmg-dje',
    tribunal: 'TJMG',
    ramo: 'estadual',
    fonteProvavel: 'DJe TJMG',
    status: 'ativo',
    endpoint: 'https://www8.tjmg.jus.br/juridico/diario/',
    exigeCredencial: false,
    validada: true,
    capturaPublicacaoReal: true,
    motivo: 'Captura real já implementada por cadernos do TJMG DJe.',
    proximaAcao: 'Manter e monitorar estabilidade.',
  },
  {
    id: 'trt3',
    tribunal: 'TRT3',
    ramo: 'trabalhista',
    fonteProvavel: 'DEJT e DJEN/CNJ',
    status: 'ativo_parcial',
    endpoint: `${DJEN_ENDPOINT} e https://diario.jt.jus.br/cadernos/Diario_J_03.pdf`,
    exigeCredencial: false,
    validada: true,
    capturaPublicacaoReal: true,
    motivo: 'DEJT público e DJEN/CNJ já implementados; PJe-JT segue fora por exigir credencial/sessão em cenários de consulta processual.',
    proximaAcao: 'Avaliar paginação e limites operacionais para grandes volumes.',
  },
  ...Array.from({ length: 20 }, (_, i): DiagnosticoFontePendente => {
    const numero = i + 1
    return {
      id: `trt${numero}`,
      tribunal: `TRT${numero}`,
      ramo: 'trabalhista',
      fonteProvavel: 'DJEN/CNJ',
      status: numero === 3 ? 'ativo_parcial' : 'ativo',
      endpoint: DJEN_ENDPOINT,
      exigeCredencial: false,
      validada: true,
      capturaPublicacaoReal: true,
      motivo: 'API pública DJEN/CNJ respondeu HTTP 200 para consulta por siglaTribunal e data.',
      proximaAcao: 'Executar com termos monitorados reais e observar limites de requisição.',
    }
  }).filter(item => item.id !== 'trt3'),
  ...[21, 22, 23, 24].map((numero): DiagnosticoFontePendente => ({
    id: `trt${numero}`,
    tribunal: `TRT${numero}`,
    ramo: 'trabalhista',
    fonteProvavel: 'DJEN/CNJ',
    status: 'pendente',
    endpoint: DJEN_ENDPOINT,
    exigeCredencial: false,
    validada: false,
    capturaPublicacaoReal: false,
    motivo: 'Validação inicial retornou HTTP 429 Too Many Attempts. Não foi marcado como ativo sem revalidação estável.',
    proximaAcao: 'Revalidar com janela de rate limit limpa e limites por tribunal.',
  })),
  {
    id: 'datajud-cnj',
    tribunal: 'CNJ',
    ramo: 'datajud',
    fonteProvavel: 'DataJud CNJ',
    status: process.env.DATAJUD_API_KEY ? 'preparado' : 'requer_credencial',
    endpoint: 'https://api-publica.datajud.cnj.jus.br/',
    exigeCredencial: !process.env.DATAJUD_API_KEY,
    validada: Boolean(process.env.DATAJUD_API_KEY),
    capturaPublicacaoReal: false,
    motivo: 'DataJud é adequado para metadados/movimentações processuais, não substitui publicação integral de diário.',
    proximaAcao: 'Com chave/configuração, usar como enriquecimento e vínculo de processos, não como diário principal.',
  },
  {
    id: 'esaj-tjsp',
    tribunal: 'TJSP',
    ramo: 'estadual',
    fonteProvavel: 'e-SAJ / DJEN / diário próprio',
    status: 'pendente',
    exigeCredencial: false,
    validada: false,
    capturaPublicacaoReal: false,
    motivo: 'Requer validação específica de consulta pública estável sem captcha/sessão antes de ativar.',
    proximaAcao: 'Investigar TJSP e-SAJ com limites e bloqueios antes de implementar adapter.',
  },
  {
    id: 'eproc',
    tribunal: 'Múltiplos',
    ramo: 'eproc',
    fonteProvavel: 'eproc / DJEN / DataJud',
    status: 'pendente',
    exigeCredencial: true,
    validada: false,
    capturaPublicacaoReal: false,
    motivo: 'Consulta eproc pode exigir login, captcha, certificado ou sessão conforme tribunal.',
    proximaAcao: 'Priorizar DJEN/DataJud quando disponível; só usar eproc com fonte pública validada.',
  },
]
