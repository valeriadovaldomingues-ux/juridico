export interface ClienteQualificacao {
  nome:           string
  tipo_pessoa:    'pf' | 'pj' | string | null
  cpf_cnpj:       string | null
  rg:             string | null
  nacionalidade:  string | null
  estado_civil:   string | null
  profissao:      string | null
  socio_representante: string | null
  endereco:       string | null
  numero:         string | null
  complemento:    string | null
  bairro:         string | null
  cidade:         string | null
  uf:             string | null
  cep:            string | null
}

export function enderecoCompleto(c: ClienteQualificacao): string {
  const partes = [
    [c.endereco, c.numero].filter(Boolean).join(', '),
    c.complemento,
    c.bairro ? `bairro ${c.bairro}` : null,
    [c.cidade, c.uf].filter(Boolean).join('/'),
    c.cep ? `CEP: ${c.cep}` : null,
  ].filter(Boolean)
  return partes.join(', ') || '[endereço não cadastrado]'
}

/** Campos que faltam pra qualificação ficar completa (mostrar aviso antes de gerar). */
export function camposFaltantesPF(c: ClienteQualificacao): string[] {
  const faltando: string[] = []
  if (!c.nacionalidade) faltando.push('nacionalidade')
  if (!c.estado_civil)  faltando.push('estado civil')
  if (!c.cpf_cnpj)      faltando.push('CPF')
  if (!c.rg)            faltando.push('RG')
  if (!c.endereco)      faltando.push('endereço')
  return faltando
}

/**
 * Qualificação de pessoa física, no padrão usado nos documentos reais do escritório:
 * "NOME, nacionalidade, estado civil[, profissão], portador(a) do CPF/MF nº X e RG nº Y,
 *  residente e domiciliado(a) na ENDEREÇO"
 */
export function qualificacaoPF(c: ClienteQualificacao): string {
  const partes = [
    c.nacionalidade ?? '[nacionalidade]',
    c.estado_civil ?? '[estado civil]',
    c.profissao ?? null,
  ].filter(Boolean)

  const documentos = [
    c.cpf_cnpj ? `portador(a) do CPF/MF nº ${c.cpf_cnpj}` : 'portador(a) do CPF/MF nº [informar]',
    c.rg ? `RG nº ${c.rg}` : null,
  ].filter(Boolean).join(' e ')

  return `${c.nome}, ${partes.join(', ')}, ${documentos}, residente e domiciliado(a) na ${enderecoCompleto(c)}`
}

/**
 * Qualificação de pessoa jurídica: razão social + CNPJ + sede + representante legal
 * (o representante entra só pelo nome cadastrado — sem qualificação pessoal completa,
 * que hoje não é um dado guardado no cadastro do cliente).
 */
export function qualificacaoPJ(c: ClienteQualificacao): string {
  const representante = c.socio_representante
    ? `, neste ato representada por seu representante legal ${c.socio_representante}`
    : ', neste ato representada por seu representante legal [informar representante legal]'

  return `${c.nome}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${c.cpf_cnpj ?? '[informar CNPJ]'}, `
    + `com sede na ${enderecoCompleto(c)}${representante}`
}

export function qualificacaoCliente(c: ClienteQualificacao): string {
  return c.tipo_pessoa === 'pj' ? qualificacaoPJ(c) : qualificacaoPF(c)
}
