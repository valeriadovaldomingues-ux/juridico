export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-7xl animate-pulse">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-52 bg-[#E8F2F2] rounded-xl" />
          <div className="h-3.5 w-64 bg-[#F3F1EE] rounded-md" />
        </div>
        <div className="h-10 w-36 bg-[#E8F2F2] rounded-xl" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-5">
        {/* Featured */}
        <div className="rounded-lg bg-[#1B6E70]/30 h-36" />
        {/* Regular */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm p-6 space-y-5">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 bg-[#E8F2F2] rounded-xl" />
              <div className="w-4 h-4 bg-[#F3F1EE] rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-9 w-16 bg-[#E8F2F2] rounded-lg" />
              <div className="h-3 w-28 bg-[#F3F1EE] rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Atividades + Prazos */}
      <div className="grid grid-cols-3 gap-5">
        <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm h-64" />
        <div className="col-span-2 bg-white rounded-lg border border-[#E2DDD8] shadow-sm h-64" />
      </div>

      {/* Distribution row */}
      <div className="grid grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm h-52" />
        ))}
      </div>

      {/* Últimos registros */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm h-56" />
        <div className="bg-white rounded-lg border border-[#E2DDD8] shadow-sm h-56" />
      </div>
    </div>
  )
}
