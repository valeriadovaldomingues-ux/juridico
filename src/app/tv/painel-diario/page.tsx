import PainelTVDiario from './PainelTVDiario'

export default async function PainelDiarioPage({
  searchParams,
}: {
  searchParams?: Promise<{ modo?: string | string[] }>
}) {
  const params = await searchParams
  const modo = Array.isArray(params?.modo) ? params?.modo[0] : params?.modo

  return <PainelTVDiario modoAutenticadores={modo === 'autenticadores'} />
}
