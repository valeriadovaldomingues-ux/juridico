// Rascunhos de e-mail ao cliente (PEDV Cliente). Texto montado a partir dos dados do sistema —
// sem IA —, para o advogado só revisar, ajustar e enviar. Nunca sai sozinho.

const dataBR = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

export interface ObrigacaoEmail {
  titulo: string
  descricao?: string | null
  data?: string | null
  dataTexto?: string | null
  valor?: string | null
}

export interface DadosEmailPosAudiencia {
  clienteNome: string
  numeroProcesso: string | null
  dataAudiencia: string
  resumo: string | null
  obrigacoes: ObrigacaoEmail[]
  advogadoNome: string | null
  temAnexo: boolean
}

export interface RascunhoEmail { assunto: string; corpo: string }

function linhaObrigacao(o: ObrigacaoEmail, n: number): string {
  const partes = [o.titulo.replace(/\.$/, '')]
  if (o.valor) partes.push(`valor: ${o.valor}`)
  if (o.data) partes.push(`até ${dataBR(o.data)}`)
  else if (o.dataTexto) partes.push(o.dataTexto)
  const base = `${n}. ${partes.join(' — ')}.`
  return o.descricao ? `${base}\n   ${o.descricao}` : base
}

const ASSINATURA = (advogado: string | null) =>
  ['Atenciosamente,', advogado, 'Pessoa e do Val Advocacia'].filter(Boolean).join('\n')

export function montarEmailPosAudiencia(d: DadosEmailPosAudiencia): RascunhoEmail {
  const proc = d.numeroProcesso ? `processo nº ${d.numeroProcesso}` : 'seu processo'
  const blocos: string[] = [`Prezado(a) ${d.clienteNome},`]

  blocos.push(
    `Informamos que a audiência do ${proc} foi realizada em ${dataBR(d.dataAudiencia)}.` +
      (d.temAnexo ? ' Segue em anexo a ata da audiência.' : ''),
  )
  if (d.resumo) blocos.push(`Resumo do que aconteceu:\n${d.resumo}`)

  if (d.obrigacoes.length > 0) {
    blocos.push(`Para dar andamento, pedimos que você providencie o seguinte:\n${d.obrigacoes.map((o, i) => linhaObrigacao(o, i + 1)).join('\n')}`)
    blocos.push('Se alguma data ou valor não estiver claro, fale conosco antes do prazo.')
  } else {
    blocos.push('Neste momento não há nenhuma providência a ser tomada por você. Avisaremos assim que houver novidades.')
  }
  blocos.push('Qualquer dúvida, é só responder a este e-mail.')
  blocos.push(ASSINATURA(d.advogadoNome))

  return {
    assunto: `${d.numeroProcesso ? `Processo ${d.numeroProcesso} — ` : ''}Audiência de ${dataBR(d.dataAudiencia)}: resumo e próximos passos`,
    corpo: blocos.join('\n\n'),
  }
}

export interface DadosEmailAudienciaMarcada {
  clienteNome: string
  numeroProcesso: string | null
  data: string
  hora: string | null
  local: string | null
  advogadoNome: string | null
}

export function montarEmailAudienciaMarcada(d: DadosEmailAudienciaMarcada): RascunhoEmail {
  const proc = d.numeroProcesso ? `processo nº ${d.numeroProcesso}` : 'seu processo'
  const quando = `${dataBR(d.data)}${d.hora ? `, às ${d.hora.slice(0, 5)}` : ''}`
  const blocos = [
    `Prezado(a) ${d.clienteNome},`,
    `Informamos que foi marcada audiência no ${proc} para o dia ${quando}.` + (d.local ? `\nLocal/link: ${d.local}` : ''),
    'Pedimos que confirme o recebimento deste aviso e entre em contato conosco caso tenha algum impedimento nessa data. Antes da audiência, entraremos em contato para orientar sobre como será e o que levar.',
    'Qualquer dúvida, é só responder a este e-mail.',
    ASSINATURA(d.advogadoNome),
  ]
  return {
    assunto: `${d.numeroProcesso ? `Processo ${d.numeroProcesso} — ` : ''}Audiência marcada para ${dataBR(d.data)}`,
    corpo: blocos.join('\n\n'),
  }
}
