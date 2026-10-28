'use client'

import { useState } from 'react'
import { Check, Copy, KeyRound, Loader2 } from 'lucide-react'

const URL_MCP = 'https://juridico.pessoaedoval.com.br/api/mcp'

function Bloco({ titulo, texto }: { titulo: string; texto: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#eef0f2]">
        <p className="text-[12px] font-semibold text-[#374151]">{titulo}</p>
        <button onClick={async () => { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1500) }}
          className="flex items-center gap-1 text-[11px] text-[#1D5F60] hover:underline">{copiado ? <Check size={12} /> : <Copy size={12} />} {copiado ? 'Copiado' : 'Copiar'}</button>
      </div>
      <pre className="px-3 py-2.5 text-[11px] leading-relaxed text-[#374151] whitespace-pre-wrap break-all">{texto}</pre>
    </div>
  )
}

export default function ConectarClaude() {
  const [token, setToken] = useState('')
  const [expira, setExpira] = useState('')
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')

  async function gerar() {
    setGerando(true); setErro('')
    const res = await fetch('/api/mcp/token', { method: 'POST' })
    const j = await res.json().catch(() => ({}))
    setGerando(false)
    if (!res.ok) { setErro(j.error ?? 'Não foi possível gerar a chave.'); return }
    setToken(j.token); setExpira(new Date(j.expira_em).toLocaleDateString('pt-BR'))
  }

  const t = token || 'COLE_AQUI_A_SUA_CHAVE'
  const claudeCode = `claude mcp add --transport http pedv ${URL_MCP} --header "Authorization: Bearer ${t}"`
  // A chave vai numa variável de ambiente: evita o problema do espaço em "Authorization: Bearer ..." no Windows
  const desktop = JSON.stringify({ mcpServers: { pedv: {
    command: 'npx',
    args: ['-y', 'mcp-remote', URL_MCP, '--header', 'Authorization:${AUTH_HEADER}'],
    env: { AUTH_HEADER: `Bearer ${t}` },
  } } }, null, 2)

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
        Os dados de processo são sigilosos. A chave é pessoal: <strong>não a compartilhe</strong>. Ela vale por 90 dias e tudo o que for consultado ou gravado fica registrado.
      </div>

      <section className="space-y-2">
        <h2 className="text-[14px] font-semibold text-[#0f1923]">1. Gerar a sua chave</h2>
        <button onClick={gerar} disabled={gerando} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1D5F60] hover:bg-[#27777A] text-white text-[13px] font-semibold rounded-xl disabled:opacity-60">
          {gerando ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} {token ? 'Gerar outra chave' : 'Gerar chave'}
        </button>
        {erro && <p className="text-[12px] text-red-600">{erro}</p>}
        {token && <p className="text-[12px] text-[#6b7280]">Chave gerada (vale até {expira}). Ela só aparece agora: copie os comandos abaixo, que já a incluem.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-[14px] font-semibold text-[#0f1923]">2. Ligar no seu Claude</h2>
        <Bloco titulo="Claude Code (terminal) — uma linha" texto={claudeCode} />
        <Bloco titulo="Claude Desktop (Windows ou Mac) — acrescente isto em Configurações → Desenvolvedor → Editar configuração (precisa do Node.js instalado)" texto={desktop} />
        <p className="text-[12px] text-[#6b7280]">No Windows, o arquivo fica em <code>%APPDATA%\\Claude\\claude_desktop_config.json</code>. Se já houver outros conectores, acrescente só o bloco <code>&quot;pedv&quot;</code> dentro de <code>mcpServers</code>. Feche o Claude <strong>por completo</strong> (inclusive na bandeja ao lado do relógio) e abra de novo.</p>
        <p className="text-[12px] text-[#6b7280]">Depois, reinicie o Claude. Teste perguntando: <em>&ldquo;quais são os meus prazos desta semana?&rdquo;</em></p>
      </section>

      <section className="space-y-1">
        <h2 className="text-[14px] font-semibold text-[#0f1923]">O que ele consegue consultar</h2>
        <ul className="list-disc pl-5 text-[12px] text-[#374151] space-y-0.5">
          <li><strong>agenda</strong> e <strong>prazos</strong> — compromissos, prazos e audiências</li>
          <li><strong>buscar_processos</strong> e <strong>ver_processo</strong> — número, cliente, partes, andamentos</li>
          <li><strong>publicacoes</strong> — publicações recentes e prazos detectados</li>
          <li><strong>horas_lancadas</strong> — tempo já lançado na aba Horas (para não lançar duas vezes)</li>
        </ul>
      </section>

      <section className="space-y-1">
        <h2 className="text-[14px] font-semibold text-[#0f1923]">O que ele consegue preencher</h2>
        <ul className="list-disc pl-5 text-[12px] text-[#374151] space-y-0.5">
          <li><strong>criar_andamento</strong> — registra andamento no processo</li>
          <li><strong>lancar_horas</strong> — lança o tempo gasto na aba Horas (processo, data, responsável, descrição e tempo), avisando se já houver lançamento parecido</li>
          <li><strong>criar_compromisso</strong>, <strong>concluir_compromisso</strong> e <strong>excluir_compromisso</strong> — agenda (tarefa, prazo, audiência com até 2 responsáveis); só exclui o que o próprio conector criou por você</li>
          <li><strong>cadastrar_cliente</strong> e <strong>atualizar_cliente</strong></li>
          <li><strong>cadastrar_processo</strong>, <strong>atualizar_processo</strong> e <strong>definir_quem_cuida_do_caso</strong></li>
          <li><strong>adicionar_parte_processo</strong>, <strong>atualizar_parte_processo</strong> e <strong>remover_parte_processo</strong></li>
          <li><strong>atualizar_compromisso</strong> — corrige data, hora, responsável e vincula a um processo</li>
          <li><strong>enviar_ao_google</strong> — manda um prazo/audiência antigo ao Google Agenda pedvprazos (os novos vão sozinhos)</li>
          <li><strong>tratar_publicacao</strong> — marca como tratada ou descartada</li>
        </ul>
        <p className="text-[12px] text-[#6b7280]">Antes de gravar, o Claude mostra o resumo e espera o seu &ldquo;sim&rdquo;. O que for gravado leva a marca &ldquo;registrado via Claude&rdquo;. Fora o compromisso criado por ele mesmo, <strong>nada é apagado</strong> por este conector.</p>
      </section>
    </div>
  )
}
