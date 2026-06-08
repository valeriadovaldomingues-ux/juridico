const WA =
  'https://wa.me/5531971766583?text=Olá,%20gostaria%20de%20saber%20mais%20sobre%20o%20Diagnóstico%20NR-1'

interface Props {
  categoria: string
  titulo: string
  subtitulo: string
  dataPublicacao: string
  autor?: string
  children: React.ReactNode
}

export default function ArticleLayout({ categoria, titulo, subtitulo, dataPublicacao, autor, children }: Props) {
  return (
    <div className="min-h-screen bg-[#F3F1EE] text-[#111827]">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0D2235] border-b border-[#B8784A]/20 shadow-[0_8px_30px_rgba(17,24,39,0.12)]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/nr1-sem-risco" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-pedv-tv.jpeg"
              alt="Pessoa e do Val Advocacia"
              className="h-11 w-11 rounded object-cover"
            />
            <div className="hidden sm:block leading-none">
              <p className="[font-family:var(--font-serif)] text-white text-[19px] font-semibold tracking-tight">
                Pessoa e do Val
              </p>
              <p className="text-[#B8784A] text-[9px] mt-0.5 tracking-[0.2em] uppercase">Advocacia</p>
            </div>
          </a>
          <nav className="flex items-center gap-6">
            <a
              href="/nr1-sem-risco"
              className="hidden md:block text-white/50 hover:text-[#B8784A] text-sm transition-colors"
            >
              ← NR-1 sem Risco
            </a>
            <a
              href={WA}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#B8784A] hover:bg-[#9E6438] text-[#111827] text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              WhatsApp
            </a>
          </nav>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-[#B8784A]/40 to-transparent" />
      </header>

      {/* Hero do artigo */}
      <section className="bg-[#0D2235] pt-20 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <a href="/nr1-sem-risco" className="text-white/40 hover:text-[#B8784A] text-sm transition-colors">
              NR-1 sem Risco
            </a>
            <span className="text-white/20 text-sm">/</span>
            <span className="text-[#B8784A] text-[11px] font-semibold tracking-widest uppercase">
              {categoria}
            </span>
          </div>
          <h1 className="[font-family:var(--font-serif)] text-white font-bold text-3xl sm:text-4xl md:text-5xl leading-tight mb-6">
            {titulo}
          </h1>
          <p className="text-white/55 text-lg leading-relaxed mb-5 max-w-2xl">{subtitulo}</p>
          {autor && (
            <p className="text-white/40 text-sm mb-8">
              Por <span className="text-[#B8784A] font-semibold">{autor}</span>
            </p>
          )}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="inline-block border border-[#B8784A]/30 text-[#B8784A] text-[11px] font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full">
              {categoria}
            </span>
            <span className="text-white/30 text-sm">{dataPublicacao}</span>
          </div>
        </div>
      </section>

      {/* Conteúdo do artigo */}
      <article className="max-w-3xl mx-auto px-6 py-16">
        {children}
      </article>

      {/* CTA final */}
      <section className="bg-[#0D2235] py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block text-[#B8784A] text-[11px] font-semibold tracking-widest uppercase mb-5">
            Diagnóstico gratuito
          </span>
          <h2 className="[font-family:var(--font-serif)] text-white font-bold text-3xl sm:text-4xl mb-5 leading-tight">
            Avalie agora o nível de risco da sua empresa
          </h2>
          <p className="text-white/50 text-lg leading-relaxed max-w-xl mx-auto mb-10">
            Em 5 a 8 minutos, nosso diagnóstico avalia 8 fatores de risco psicossocial e entrega
            recomendações prioritárias específicas para a sua empresa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/nr1-sem-risco/diagnostico"
              className="bg-[#B8784A] hover:bg-[#9E6438] text-[#111827] font-semibold px-10 py-4 rounded-xl text-base transition-colors"
            >
              Fazer diagnóstico gratuito agora
            </a>
            <a
              href={WA}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/15 hover:border-[#B8784A]/60 text-white/70 hover:text-[#B8784A] font-semibold px-10 py-4 rounded-xl text-base transition-colors"
            >
              Solicitar análise jurídica
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#081520] border-t border-[#B8784A]/15 py-12 px-6">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-white/35 text-sm">Pessoa e do Val Advocacia</p>
            <p className="text-white/20 text-xs mt-1">
              Rua Gonçalves Dias, 874 — 8º andar, Savassi — Belo Horizonte/MG
            </p>
          </div>
          <p className="text-white/20 text-xs">© 2026 Pessoa e do Val Advocacia.</p>
        </div>
      </footer>

      {/* WhatsApp FAB */}
      <a
        href={WA}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20BA5A] flex items-center justify-center shadow-2xl transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      </a>
    </div>
  )
}
