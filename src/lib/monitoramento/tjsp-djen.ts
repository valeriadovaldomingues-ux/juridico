import { buscarPublicacoesTJDJEN } from './tjs-djen'

export async function buscarPublicacoesTJSPDJEN(opcoes: {
  nomes: string[]
  processos?: string[]
  oabs?: string[]
  data?: string
}) {
  return buscarPublicacoesTJDJEN({
    ...opcoes,
    tribunal: 'TJSP',
  })
}
