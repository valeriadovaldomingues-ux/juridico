import ClienteForm from '../ClienteForm'

export default function NovoClientePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#1a1d23]">Novo Cliente</h1>
        <p className="text-sm text-[#6b7280] mt-0.5">Preencha os dados do cliente</p>
      </div>
      <ClienteForm />
    </div>
  )
}
