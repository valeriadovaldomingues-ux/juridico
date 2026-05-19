import { apiGuard } from '@/lib/auth/api-guard'
import { completarJSON } from '@/lib/ai/service'
import {
  DADOS_DOCUMENTO_VAZIO,
  extensaoArquivoPermitida,
  normalizarDadosDocumento,
  tipoDocumentoValido,
  type TipoDocumentoGerador,
} from '@/lib/documentos/schema'

const ALLOWED_ROLES = ['administrativo', 'advogado', 'gerente', 'socio'] as const

function systemPrompt() {
  return `Você extrai dados para documentos internos do Pessoa e do Val Advocacia.
Responda exclusivamente em JSON.
Não invente dados ausentes. Se CPF, CNPJ, processo, endereço, valor ou vencimento não estiverem expressos, deixe o campo vazio e inclua em camposAusentes.
Separe fatos fornecidos de inferências. Use alertas para incertezas, documentos escaneados sem OCR, informações contraditórias ou campos sensíveis.
A IA serve apenas para extrair e organizar dados. A redação jurídica final será montada por modelos oficiais.
Campos esperados: tipoDocumento, clienteTipo, nomeRazaoSocial, cpfCnpj, endereco, representanteLegal, cnpjBoletos, processo, parteContraria, objeto, honorarios, vencimento, primeiraParcela, vigenciaInicio, vigenciaFim, todasAreas, areasExcluidas, percentualExito, parcelaAdicionalDezembro, poderesProcuracao, finalidadeHipossuficiencia, tipoPeticao, fatosResumidos, direito, pedidos, foro, vara, comarca, uf, valorCausa, urgencia, gratuidadeJustica, localData, nomeRevisor, camposAusentes, alertas, confianca. Não preencha nomeRevisor; esse campo deve ser informado manualmente na revisão.`
}

export async function POST(request: Request) {
  const auth = await apiGuard([...ALLOWED_ROLES])
  if (auth instanceof Response) return auth

  const form = await request.formData()
  const tipoRaw = String(form.get('tipoDocumento') ?? '')
  const tipoDocumento: TipoDocumentoGerador = tipoDocumentoValido(tipoRaw) ? tipoRaw : 'contrato_partido'
  const relato = String(form.get('relato') ?? '').trim()
  const files = form.getAll('arquivos').filter((item): item is File => item instanceof File)

  if (files.length > 8) {
    return Response.json({ error: 'Envie no máximo 8 arquivos.' }, { status: 400 })
  }

  const invalid = files.find(file => !extensaoArquivoPermitida(file.name, file.type))
  if (invalid) {
    return Response.json({ error: `Arquivo não permitido: ${invalid.name}` }, { status: 400 })
  }

  const anexos = files.map(file => ({
    nome: file.name,
    tipo: file.type,
    tamanho: file.size,
    aviso: file.type === 'application/pdf'
      ? 'PDF recebido. Nesta fase, a extração automática usa o relato livre; PDF selecionável fica preparado para fase posterior.'
      : 'Imagem recebida. OCR ainda não está ativo nesta fase.',
  }))

  if (!relato && anexos.length === 0) {
    return Response.json({ error: 'Informe um relato ou envie anexos.' }, { status: 400 })
  }

  try {
    const content = await completarJSON([
      { role: 'system', content: systemPrompt() },
      {
        role: 'user',
        content: JSON.stringify({
          tipoDocumento,
          relato,
          anexos,
          orientacao: 'Extraia apenas dados expressamente informados. Não crie CPF/CNPJ, valores, datas ou processo se não constarem do relato.',
        }),
      },
    ], { temperature: 0.1 })

    const parsed = JSON.parse(content)
    const dados = normalizarDadosDocumento(parsed, tipoDocumento)
    const alertas = [
      ...dados.alertas,
      ...anexos.map(a => a.aviso),
    ]
    const final = {
      dados: { ...dados, alertas },
      camposAusentes: dados.camposAusentes,
      alertas,
      confianca: dados.confianca,
    }

    return Response.json(final)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao extrair dados'
    return Response.json({
      dados: {
        ...DADOS_DOCUMENTO_VAZIO,
        tipoDocumento,
        camposAusentes: ['Dados não extraídos automaticamente'],
        alertas: [`Falha na extração por IA: ${message}`],
      },
      camposAusentes: ['Dados não extraídos automaticamente'],
      alertas: [`Falha na extração por IA: ${message}`],
      confianca: 0,
    }, { status: 500 })
  }
}
