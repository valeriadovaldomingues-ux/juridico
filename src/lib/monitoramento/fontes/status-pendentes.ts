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
const TJS_DJEN_ATIVOS = [
  'TJAC', 'TJAL', 'TJAM', 'TJAP', 'TJBA', 'TJCE', 'TJDFT', 'TJES', 'TJGO',
  'TJMA', 'TJMS', 'TJMT', 'TJPA', 'TJPB', 'TJPE', 'TJPI', 'TJPR', 'TJRJ',
  'TJRN', 'TJRO', 'TJRR', 'TJRS', 'TJSC', 'TJSE', 'TJSP', 'TJTO',
]
const TJS_DJEN_PENDENTES_RATE_LIMIT: string[] = []

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
  ...Array.from({ length: 24 }, (_, i): DiagnosticoFontePendente => {
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
      motivo: numero >= 21
        ? 'Revalidação controlada com intervalo entre requisições retornou HTTP 200 e JSON válido para consulta por siglaTribunal e data.'
        : 'API pública DJEN/CNJ respondeu HTTP 200 para consulta por siglaTribunal e data.',
      proximaAcao: 'Executar com termos monitorados reais e observar limites de requisição.',
    }
  }).filter(item => item.id !== 'trt3'),
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
  ...TJS_DJEN_ATIVOS.map((tribunal): DiagnosticoFontePendente => ({
    id: tribunal.toLowerCase(),
    tribunal,
    ramo: 'estadual',
    fonteProvavel: 'DJEN/CNJ',
    status: tribunal === 'TJSP' ? 'ativo_parcial' : 'ativo',
    endpoint: DJEN_ENDPOINT,
    exigeCredencial: false,
    validada: true,
    capturaPublicacaoReal: true,
    motivo: tribunal === 'TJSP'
      ? 'API pública DJEN/CNJ já havia sido validada com HTTP 200 e JSON válido para TJSP por siglaTribunal e data. e-SAJ direto permanece pendente.'
      : 'API pública DJEN/CNJ respondeu HTTP 200 e JSON válido para consulta por siglaTribunal e data; TJs remanescentes foram revalidados com intervalo conservador.',
    proximaAcao: tribunal === 'TJSP'
      ? 'Executar monitoramento TJSP por DJEN/CNJ e investigar e-SAJ apenas se houver fluxo sem sessão/captcha.'
      : 'Executar com termos monitorados reais e observar limites de requisição.',
  })),
  ...TJS_DJEN_PENDENTES_RATE_LIMIT.map((tribunal): DiagnosticoFontePendente => ({
    id: tribunal.toLowerCase(),
    tribunal,
    ramo: 'estadual',
    fonteProvavel: 'DJEN/CNJ',
    status: 'pendente',
    endpoint: DJEN_ENDPOINT,
    exigeCredencial: false,
    validada: true,
    capturaPublicacaoReal: false,
    motivo: 'Validação pública retornou HTTP 429 Too Many Attempts; fonte mantida pendente para revalidação conservadora.',
    proximaAcao: 'Revalidar posteriormente com intervalo maior antes de ativar.',
  })),
  {
    id: 'esaj-tjsp',
    tribunal: 'TJSP',
    ramo: 'estadual',
    fonteProvavel: 'e-SAJ / DJEN / diário próprio',
    status: 'pendente',
    exigeCredencial: false,
    validada: true,
    capturaPublicacaoReal: false,
    motivo: 'e-SAJ/TJSP respondeu HTML público, mas com estado de sessão/conversationId; não foi ativado para evitar automação frágil ou dependente de sessão.',
    proximaAcao: 'Manter e-SAJ pendente e usar DJEN/CNJ como fonte pública principal de comunicações do TJSP.',
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
