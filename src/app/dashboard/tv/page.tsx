import TVDashboard from './TVDashboard'

// Server component minimo — apenas renderiza o client component.
// A autenticacao e feita no layout.tsx deste mesmo segmento.
export default function TVPage() {
  return <TVDashboard />
}
