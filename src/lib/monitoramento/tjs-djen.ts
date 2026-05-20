import { buscarPublicacoesTRTDJEN } from './trt3-djen'

export async function buscarPublicacoesTJDJEN(opcoes: {
  tribunal: string
  nomes: string[]
  processos?: string[]
  oabs?: string[]
  data?: string
}) {
  return buscarPublicacoesTRTDJEN({
    ...opcoes,
    tribunal: opcoes.tribunal.toUpperCase(),
  })
}
