// Constantes de envio de documentos SEM dependência de servidor (usadas também pela tela do navegador).

export const TAMANHO_MAXIMO_BYTES = 25 * 1024 * 1024
export const MAX_DESCRICAO = 300

/** Extensões aceitas → tipo MIME que o servidor passa ao Storage (o tipo que o navegador declara não é usado). */
export const TIPOS_ACEITOS: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  csv: 'text/csv',
}
export const EXTENSOES_ACEITAS = Object.keys(TIPOS_ACEITOS)

export function extensaoDe(nome: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(nome.trim())
  return m ? m[1].toLowerCase() : ''
}


/** Quem da equipe vê e baixa os documentos que o cliente enviou pelo portal (o "comercial" não). */
export const PAPEIS_ENVIOS: string[] = ['estagiario', 'administrativo', 'advogado', 'gerente', 'socio']
