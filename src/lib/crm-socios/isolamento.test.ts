/**
 * CRM Cris e Val — isolamento do CRM da Luciana (/comercial, leads, propostas_comerciais).
 *
 * 1. Estático (vale sempre): nada do módulo novo lê/escreve as tabelas dela nem importa código dela.
 * 2. Migração: só cria/mexe em objetos crm_socios_*; nenhum DROP/TRUNCATE/DELETE de coisa existente.
 * 3. git diff (só na branch deste PR, ver abaixo): nenhum arquivo do CRM da Luciana foi alterado.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = path.resolve(__dirname, '../../..')

function listar(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(nome => {
    const p = path.join(dir, nome)
    return statSync(p).isDirectory() ? listar(p) : [p]
  })
}

const DIRS_DO_MODULO = [
  'src/lib/crm-socios',
  'src/app/api/crm-socios',
  'src/app/(dashboard)/crm-socios',
].map(d => path.join(RAIZ, d))

const ARQUIVOS_DO_MODULO = [
  ...DIRS_DO_MODULO.flatMap(listar),
  path.join(RAIZ, 'src/types/crm-socios.ts'),
].filter(f => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f))

/** Remove comentários para não confundir menção em texto com uso em código. */
function semComentariosTs(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const TABELAS_DA_LUCIANA = ['leads', 'propostas_comerciais', 'atendimentos_comerciais']

describe('módulo novo não toca o CRM da Luciana', () => {
  it('encontrou os arquivos do módulo (sanidade do teste)', () => {
    expect(ARQUIVOS_DO_MODULO.length).toBeGreaterThan(15)
  })

  it('nenhum arquivo consulta as tabelas dela', () => {
    for (const arquivo of ARQUIVOS_DO_MODULO) {
      const src = semComentariosTs(readFileSync(arquivo, 'utf8'))
      for (const tabela of TABELAS_DA_LUCIANA) {
        const usa = new RegExp(`\\.from\\(\\s*['"\`]${tabela}['"\`]`).test(src) || new RegExp(`['"\`]${tabela}['"\`]`).test(src)
        expect(usa, `${path.relative(RAIZ, arquivo)} menciona a tabela ${tabela}`).toBe(false)
      }
    }
  })

  it('nenhum arquivo importa código/tipos/rotas do CRM dela', () => {
    for (const arquivo of ARQUIVOS_DO_MODULO) {
      const src = semComentariosTs(readFileSync(arquivo, 'utf8'))
      expect(src, path.relative(RAIZ, arquivo)).not.toMatch(/types\/comercial/)
      expect(src, path.relative(RAIZ, arquivo)).not.toMatch(/\(dashboard\)\/comercial/)
      expect(src, path.relative(RAIZ, arquivo)).not.toMatch(/from\s+['"]\.\.\/comercial/)
      expect(src, path.relative(RAIZ, arquivo)).not.toMatch(/\/api\/comercial/)
    }
  })

  it('todas as tabelas acessadas pelo módulo têm prefixo crm_socios_ (ou são profiles/clientes de apoio)', () => {
    const permitidas = new Set(['profiles', 'clientes'])
    for (const arquivo of ARQUIVOS_DO_MODULO) {
      const src = semComentariosTs(readFileSync(arquivo, 'utf8'))
      for (const m of src.matchAll(/\.from\(\s*['"`]([a-z_]+)['"`]/g)) {
        const tabela = m[1]
        expect(tabela.startsWith('crm_socios_') || permitidas.has(tabela), `${path.relative(RAIZ, arquivo)} → ${tabela}`).toBe(true)
      }
    }
  })
})

describe('supabase/crm_socios_migration.sql', () => {
  const bruto = readFileSync(path.join(RAIZ, 'supabase/crm_socios_migration.sql'), 'utf8')
  const sql = bruto.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')

  it('avisa no topo que só se aplica com autorização expressa', () => {
    expect(bruto.split('\n').slice(0, 12).join('\n')).toMatch(/AUTORIZA[ÇC][ÃA]O EXPRESSA/i)
  })

  it('cria exatamente as 3 tabelas do módulo, de forma idempotente', () => {
    const criadas = [...sql.matchAll(/CREATE TABLE\s+(IF NOT EXISTS\s+)?public\.(\w+)/gi)]
    expect(criadas.map(m => m[2]).sort()).toEqual(['crm_socios_interacoes', 'crm_socios_oportunidades', 'crm_socios_propostas'])
    expect(criadas.every(m => !!m[1])).toBe(true)
  })

  it('nenhum comando mexe em objeto que não seja do módulo', () => {
    const alvos = [
      ...sql.matchAll(/ALTER TABLE\s+(?:IF EXISTS\s+)?public\.(\w+)/gi),
      ...sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?\w+\s+ON\s+public\.(\w+)/gi),
      ...sql.matchAll(/CREATE POLICY\s+"[^"]+"\s+ON\s+public\.(\w+)/gi),
      ...sql.matchAll(/DROP POLICY IF EXISTS\s+"[^"]+"\s+ON\s+public\.(\w+)/gi),
      ...sql.matchAll(/(?:CREATE|DROP) TRIGGER\s+(?:IF EXISTS\s+)?\w+\s+(?:BEFORE|AFTER)?\s*(?:UPDATE\s+)?ON\s+public\.(\w+)/gi),
      ...sql.matchAll(/DROP TRIGGER IF EXISTS\s+\w+\s+ON\s+public\.(\w+)/gi),
      ...sql.matchAll(/(?:REVOKE ALL|GRANT [A-Z, ]+)\s+ON\s+public\.(\w+)/gi),
    ].map(m => m[1])
    expect(alvos.length).toBeGreaterThan(10)
    for (const alvo of alvos) expect(alvo, `alvo ${alvo}`).toMatch(/^crm_socios_/)
  })

  it('referências (FK) só para profiles, clientes e as próprias tabelas do módulo', () => {
    const refs = [...sql.matchAll(/REFERENCES\s+public\.(\w+)/gi)].map(m => m[1])
    expect(refs.length).toBeGreaterThanOrEqual(7)
    for (const ref of refs) expect(['profiles', 'clientes', 'crm_socios_oportunidades']).toContain(ref)
  })

  it('não destrói nada: sem DROP TABLE/FUNCTION/COLUMN, TRUNCATE, DELETE ou UPDATE de dados', () => {
    expect(sql).not.toMatch(/DROP\s+(TABLE|FUNCTION|COLUMN|SCHEMA|INDEX|VIEW)/i)
    expect(sql).not.toMatch(/TRUNCATE/i)
    expect(sql).not.toMatch(/DELETE\s+FROM/i)
    expect(sql).not.toMatch(/\bUPDATE\s+public\./i)
    expect(sql).not.toMatch(/INSERT\s+INTO/i)
  })

  it('não toca as tabelas do CRM da Luciana', () => {
    for (const tabela of TABELAS_DA_LUCIANA) expect(sql).not.toMatch(new RegExp(`\\b${tabela}\\b`))
  })

  it('RLS de verdade: ENABLE em todas + policy FOR ALL só para sócio, USING e WITH CHECK', () => {
    for (const t of ['crm_socios_oportunidades', 'crm_socios_interacoes', 'crm_socios_propostas']) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`, 'i'))
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON public\\.${t}\\s+FROM anon`, 'i'))
      const policy = new RegExp(`CREATE POLICY "[^"]+"\\s+ON public\\.${t}\\s+FOR ALL TO authenticated\\s+USING\\s+\\(public\\.current_user_role\\(\\) = 'socio'\\)\\s+WITH CHECK \\(public\\.current_user_role\\(\\) = 'socio'\\)`, 'i')
      expect(sql, `policy de ${t}`).toMatch(policy)
    }
  })

  it('nenhuma policy libera para outro papel nem para anon/public', () => {
    expect(sql).not.toMatch(/TO\s+(anon|public)\b/i)
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i)
    const papeis = [...sql.matchAll(/current_user_role\(\)\s*(?:=|IN)\s*([^)\n]+)/gi)].map(m => m[1].trim())
    for (const p of papeis) expect(p).toBe("'socio'")
  })

  it('tem CHECKs de etapa, status, tipo, interação e proposta', () => {
    expect(sql).toMatch(/crm_socios_oport_etapa_ck/)
    expect(sql).toMatch(/crm_socios_oport_status_ck/)
    expect(sql).toMatch(/crm_socios_oport_tipo_pessoa_ck/)
    expect(sql).toMatch(/crm_socios_inter_tipo_ck/)
    expect(sql).toMatch(/crm_socios_prop_tipo_ck/)
    expect(sql).toMatch(/crm_socios_prop_status_ck/)
  })

  it('o CHECK de etapa bate com as etapas do código', async () => {
    const { ETAPA_IDS, TIPOS_INTERACAO, TIPOS_HONORARIO, STATUS_PROPOSTA, TIPOS_PESSOA } = await import('./constants')
    const lista = (nome: string) => {
      const m = new RegExp(`${nome}\\s+CHECK\\s+\\(\\s*\\w+\\s+IN\\s+\\(([^)]*)\\)`, 'i').exec(sql)
      return (m?.[1] ?? '').split(',').map(s => s.replace(/['\s]/g, '')).filter(Boolean)
    }
    expect(lista('crm_socios_oport_etapa_ck')).toEqual([...ETAPA_IDS])
    expect(lista('crm_socios_inter_tipo_ck')).toEqual([...TIPOS_INTERACAO])
    expect(lista('crm_socios_prop_tipo_ck')).toEqual([...TIPOS_HONORARIO])
    expect(lista('crm_socios_prop_status_ck')).toEqual([...STATUS_PROPOSTA])
    expect(lista('crm_socios_oport_tipo_pessoa_ck')).toEqual([...TIPOS_PESSOA])
  })

  it('tem os índices pedidos (etapa, status, proxima_acao_data, oportunidade_id)', () => {
    expect(sql).toMatch(/ON public\.crm_socios_oportunidades \(etapa\)/)
    expect(sql).toMatch(/ON public\.crm_socios_oportunidades \(status\)/)
    expect(sql).toMatch(/ON public\.crm_socios_oportunidades \(proxima_acao_data\)/)
    expect(sql).toMatch(/ON public\.crm_socios_interacoes \(oportunidade_id/)
    expect(sql).toMatch(/ON public\.crm_socios_propostas \(oportunidade_id\)/)
  })

  it('FKs: cascade entre as tabelas do módulo; set null para profiles e clientes', () => {
    expect(sql.match(/REFERENCES public\.crm_socios_oportunidades\(id\) ON DELETE CASCADE/g)).toHaveLength(2)
    expect(sql).toMatch(/responsavel_id\s+UUID REFERENCES public\.profiles\(id\) ON DELETE SET NULL/)
    expect(sql).toMatch(/cliente_id\s+UUID REFERENCES public\.clientes\(id\) ON DELETE SET NULL/)
  })
})

// ─── git diff contra a main ───────────────────────────────────────────────────
// Só roda na branch deste PR (feat/crm-cris-val*) — depois que o PR entrar na main, outro PR
// poderá mexer no CRM da Luciana legitimamente e este guard não deve travá-lo. CRM_SOCIOS_CHECK_DIFF=1 força.
function git(...args: string[]): string | null {
  try {
    return execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
const base = git('merge-base', 'HEAD', 'origin/main') ?? git('merge-base', 'HEAD', 'main')
const rodarDiff = (process.env.CRM_SOCIOS_CHECK_DIFF === '1' || !!branch?.startsWith('feat/crm-cris-val')) && !!base

describe.skipIf(!rodarDiff)('git diff contra a main (branch do PR)', () => {
  const alterados = (git('diff', '--name-only', base!) ?? '').split('\n').filter(Boolean)

  it('há mudanças (sanidade do teste)', () => {
    expect(alterados.length).toBeGreaterThan(0)
  })

  it('nenhum arquivo do CRM da Luciana foi alterado', () => {
    const dela = alterados.filter(f =>
      f.startsWith('src/app/(dashboard)/comercial/') ||
      f.startsWith('src/app/api/comercial/') ||
      f === 'src/types/comercial.ts',
    )
    expect(dela).toEqual([])
  })

  it('a única migração mexida pelo PR é a do CRM Cris e Val', () => {
    const outras = alterados.filter(f => f.startsWith('supabase/') && f !== 'supabase/crm_socios_migration.sql')
    expect(outras).toEqual([])
  })

  it('o diff dos arquivos compartilhados não menciona as tabelas dela', () => {
    for (const f of ['src/lib/permissions.ts', 'src/proxy.ts', 'src/components/layout/Sidebar.tsx', 'src/components/layout/Header.tsx']) {
      const diff = git('diff', '-U0', base!, '--', f) ?? ''
      const linhasNovas = diff.split('\n').filter(l => /^[+-][^+-]/.test(l))
      for (const l of linhasNovas) {
        // /comercial só pode aparecer como contexto; nenhuma linha adicionada/removida pode referenciá-lo
        expect(l, `${f}: ${l}`).not.toMatch(/\/comercial|comercial:|'comercial'/)
      }
    }
  })
})
