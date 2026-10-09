// Liga o nome citado numa ata ("Tainã", "Valéria", "Breno") a uma pessoa da equipe
// ("Tainã Carlos", "Valéria do Val"). Todas as partes do nome citado precisam aparecer no
// nome do perfil (sem acento/caixa; ignora de/da/do/e; prefixo de 4+ letras também vale).
// Nome ambíguo (ex.: só "Pessoa", que existe em vários perfis) NÃO é resolvido.

const STOP = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])

function partes(nome: string): string[] {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(t => t && !STOP.has(t))
}

const casa = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)))

export interface PessoaEquipe { id: string; nome: string }

export function resolverPessoa(citado: string, equipe: PessoaEquipe[]): string | null {
  const alvo = partes(citado)
  if (alvo.length === 0) return null
  const candidatos = equipe.filter(p => {
    const doPerfil = partes(p.nome)
    return alvo.every(t => doPerfil.some(x => casa(t, x)))
  })
  return candidatos.length === 1 ? candidatos[0].id : null
}
