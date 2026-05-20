import { buscarPublicacoesTRTDJEN } from './trt3-djen'

export async function buscarPublicacoesTJSPDJEN(opcoes: {
  nomes: string[]
  processos?: string[]
  oabs?: string[]
  data?: string
}) {
  return buscarPublicacoesTRTDJEN({
    ...opcoes,
    tribunal: 'TJSP',
  })
}
