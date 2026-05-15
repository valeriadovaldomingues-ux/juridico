/**
 * Skeleton loader para a área de mensagens.
 * Simula a estrutura de balões cliente/escritório enquanto carrega.
 */
export default function ChatSkeleton() {
  return (
    <div className="p-5 space-y-5" aria-hidden>

      {/* Balão escritório (esquerda) */}
      <div className="flex justify-start">
        <div className="space-y-2 max-w-[60%]">
          <div className="h-2.5 bg-[#EDE8DF] animate-pulse w-48 rounded-none" />
          <div className="h-2.5 bg-[#EDE8DF] animate-pulse w-36 rounded-none" />
          <div className="h-2.5 bg-[#EDE8DF] animate-pulse w-28 rounded-none" />
          <div className="h-2 bg-[#F0EBE4] animate-pulse w-16 rounded-none mt-1" />
        </div>
      </div>

      {/* Balão cliente (direita) */}
      <div className="flex justify-end">
        <div className="space-y-2 max-w-[50%] items-end flex flex-col">
          <div className="h-2.5 bg-[#D8D3CC] animate-pulse w-40 rounded-none" />
          <div className="h-2.5 bg-[#D8D3CC] animate-pulse w-32 rounded-none" />
          <div className="h-2 bg-[#DED9D2] animate-pulse w-16 rounded-none mt-1" />
        </div>
      </div>

      {/* Balão escritório */}
      <div className="flex justify-start">
        <div className="space-y-2 max-w-[70%]">
          <div className="h-2.5 bg-[#EDE8DF] animate-pulse w-56 rounded-none" />
          <div className="h-2.5 bg-[#EDE8DF] animate-pulse w-44 rounded-none" />
          <div className="h-2 bg-[#F0EBE4] animate-pulse w-16 rounded-none mt-1" />
        </div>
      </div>

      {/* Balão cliente */}
      <div className="flex justify-end">
        <div className="space-y-2 items-end flex flex-col">
          <div className="h-2.5 bg-[#D8D3CC] animate-pulse w-28 rounded-none" />
          <div className="h-2 bg-[#DED9D2] animate-pulse w-16 rounded-none mt-1" />
        </div>
      </div>

    </div>
  )
}
