// Banco em memória para os testes do portal (só o suficiente do cliente do Supabase usado pelo portal).
// NÃO é código de produção: só os arquivos *.test.ts importam este módulo.

import { randomUUID } from 'node:crypto'
import type { Db } from '../db'

type Linha = Record<string, unknown>
type Filtro = (l: Linha) => boolean

export interface FakeDb {
  db: Db
  tabelas: Record<string, Linha[]>
  /** Faz toda operação nesta tabela falhar com o código de erro do Postgres/PostgREST dado (ex.: 42P01). */
  falharTabela(nome: string, code: string): void
  /** Log de todas as consultas (tabela + operação), para conferir que algo NÃO foi consultado. */
  consultas: { tabela: string; op: string }[]
}

const comparar = (a: unknown, b: unknown) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0)

export function criarFakeDb(seed: Record<string, Linha[]> = {}): FakeDb {
  const tabelas: Record<string, Linha[]> = {}
  for (const [k, v] of Object.entries(seed)) tabelas[k] = v.map(l => ({ ...l }))
  const falhas = new Map<string, string>()
  const consultas: { tabela: string; op: string }[] = []

  function from(nome: string) {
    tabelas[nome] ??= []
    const filtros: Filtro[] = []
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let patch: Linha = {}
    let novas: Linha[] = []
    let colunas = '*'
    let contar = false
    let head = false
    let devolve = false
    let ordem: { col: string; asc: boolean } | null = null
    let limite = Infinity
    let faixa: [number, number] | null = null

    function executar(): { data: unknown; error: unknown; count?: number | null } {
      consultas.push({ tabela: nome, op })
      const codigo = falhas.get(nome)
      if (codigo) return { data: null, error: { code: codigo, message: `falha simulada ${codigo}` } }
      const alvo = tabelas[nome]
      const projetar = (l: Linha): Linha => {
        if (colunas.trim() === '*') return { ...l }
        const r: Linha = {}
        for (const c of colunas.split(',').map(s => s.trim()).filter(Boolean)) r[c] = l[c]
        return r
      }
      if (op === 'insert') {
        const criadas = novas.map(n => ({ id: randomUUID(), criado_em: new Date().toISOString(), ...n }))
        alvo.push(...criadas)
        return { data: devolve ? criadas.map(projetar) : null, error: null }
      }
      if (op === 'update') {
        const atingidas = alvo.filter(l => filtros.every(f => f(l)))
        atingidas.forEach(l => Object.assign(l, patch))
        return { data: devolve ? atingidas.map(projetar) : null, error: null }
      }
      if (op === 'delete') {
        const manter = alvo.filter(l => !filtros.every(f => f(l)))
        tabelas[nome] = manter
        return { data: null, error: null }
      }
      let r = alvo.filter(l => filtros.every(f => f(l)))
      if (ordem) {
        const { col, asc } = ordem
        r = [...r].sort((a, b) => (asc ? 1 : -1) * comparar(a[col], b[col]))
      }
      if (contar && head) return { data: null, error: null, count: r.length }
      if (faixa) r = r.slice(faixa[0], faixa[1] + 1)
      if (Number.isFinite(limite)) r = r.slice(0, limite)
      return { data: r.map(projetar), error: null, count: contar ? r.length : null }
    }

    const b: Record<string, unknown> = {
      select(cols = '*', opts?: { count?: string; head?: boolean }) {
        if (op === 'select') { colunas = cols; contar = !!opts?.count; head = !!opts?.head } else { devolve = true; colunas = cols }
        return b
      },
      insert(v: Linha | Linha[]) { op = 'insert'; novas = Array.isArray(v) ? v : [v]; return b },
      update(p: Linha) { op = 'update'; patch = p; return b },
      delete() { op = 'delete'; return b },
      eq(c: string, v: unknown) { filtros.push(l => l[c] === v); return b },
      neq(c: string, v: unknown) { filtros.push(l => l[c] !== v); return b },
      is(c: string, v: unknown) { filtros.push(l => (v === null ? l[c] == null : l[c] === v)); return b },
      not(c: string, o: string, v: unknown) {
        if (o === 'is') filtros.push(l => !(v === null ? l[c] == null : l[c] === v))
        return b
      },
      in(c: string, vs: unknown[]) { filtros.push(l => vs.includes(l[c])); return b },
      gt(c: string, v: unknown) { filtros.push(l => l[c] != null && comparar(l[c], v) > 0); return b },
      gte(c: string, v: unknown) { filtros.push(l => l[c] != null && comparar(l[c], v) >= 0); return b },
      lt(c: string, v: unknown) { filtros.push(l => l[c] != null && comparar(l[c], v) < 0); return b },
      lte(c: string, v: unknown) { filtros.push(l => l[c] != null && comparar(l[c], v) <= 0); return b },
      ilike(c: string, padrao: string) {
        const re = new RegExp(`^${padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`, 'i')
        filtros.push(l => typeof l[c] === 'string' && re.test(l[c] as string))
        return b
      },
      order(c: string, o?: { ascending?: boolean }) { ordem = { col: c, asc: o?.ascending !== false }; return b },
      limit(n: number) { limite = n; return b },
      range(de: number, ate: number) { faixa = [de, ate]; return b },
      maybeSingle() {
        const r = executar()
        const lista = (r.data as Linha[] | null) ?? []
        return Promise.resolve({ data: lista[0] ?? null, error: r.error })
      },
      single() {
        const r = executar()
        const lista = (r.data as Linha[] | null) ?? []
        return Promise.resolve({ data: lista[0] ?? null, error: lista[0] ? r.error : r.error ?? { code: 'PGRST116', message: 'no rows' } })
      },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
        return Promise.resolve(executar()).then(res, rej)
      },
    }
    return b
  }

  return {
    db: { from } as unknown as Db,
    tabelas,
    falharTabela: (nome, code) => { falhas.set(nome, code) },
    consultas,
  }
}
