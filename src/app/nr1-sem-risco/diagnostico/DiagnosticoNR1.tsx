'use client'

import { useState, useEffect } from 'react'

// ── Data ──────────────────────────────────────────────────────────────────────

const FATORES = [
  { nome: 'Carga de Trabalho',         emoji: '⚡',  nqs: 4 },
  { nome: 'Organização do Trabalho',   emoji: '📋', nqs: 4 },
  { nome: 'Relações com a Liderança',  emoji: '👔', nqs: 4 },
  { nome: 'Conflitos Organizacionais', emoji: '🤝', nqs: 3 },
  { nome: 'Prevenção ao Assédio',      emoji: '🛡️', nqs: 4 },
  { nome: 'Reconhecimento',            emoji: '⭐', nqs: 3 },
  { nome: 'Autonomia e Controle',      emoji: '🎯', nqs: 3 },
  { nome: 'Equilíbrio Vida-Trabalho',  emoji: '⚖️', nqs: 3 },
]

const SUBTITULOS = [
  'Avalia se o volume e a intensidade das tarefas são compatíveis com os recursos humanos disponíveis.',
  'Avalia clareza de processos, definição de papéis e disponibilidade de recursos para a realização do trabalho.',
  'Avalia como as lideranças conduzem equipes, comunicam decisões e oferecem suporte ao trabalho.',
  'Avalia como a empresa lida com conflitos interpessoais e entre áreas, e se o clima é de colaboração.',
  'Avalia se a empresa possui mecanismos ativos de prevenção ao assédio moral e sexual no ambiente de trabalho.',
  'Avalia se os funcionários se sentem reconhecidos, valorizados e com perspectivas de crescimento.',
  'Avalia se os funcionários têm espaço para tomar decisões e influenciar a forma como trabalham.',
  'Avalia se a empresa respeita os limites entre vida pessoal e profissional dos seus funcionários.',
]

const QUESTOES: string[][] = [
  [
    'Os funcionários conseguem concluir suas tarefas dentro do horário regular de trabalho.',
    'As metas e prazos estabelecidos são realistas e atingíveis.',
    'As tarefas são distribuídas de forma equilibrada entre os membros da equipe.',
    'Os funcionários raramente precisam trabalhar em finais de semana ou feriados por excesso de demanda.',
  ],
  [
    'Os processos de trabalho são claros e bem definidos para todos.',
    'Os funcionários sabem exatamente o que se espera deles em suas funções.',
    'Há recursos (ferramentas, informações, tempo) adequados para a realização das tarefas.',
    'As mudanças na empresa são comunicadas com antecedência e de forma transparente.',
  ],
  [
    'Os gestores tratam os funcionários com respeito e consideração.',
    'Os líderes estão disponíveis para apoiar a equipe quando necessário.',
    'O feedback oferecido pelos gestores é construtivo e regular.',
    'As decisões são tomadas de forma justa e transparente.',
  ],
  [
    'Os conflitos entre funcionários são tratados de forma adequada e tempestiva pela empresa.',
    'Há um ambiente de colaboração entre as diferentes áreas da empresa.',
    'Os funcionários se sentem à vontade para expressar discordâncias sem medo de represálias.',
  ],
  [
    'A empresa possui política formal e escrita de prevenção ao assédio moral e sexual.',
    'Os funcionários conhecem os canais disponíveis para reportar situações de assédio.',
    'Não há relatos ou percepções de comportamentos abusivos ou intimidadores no ambiente de trabalho.',
    'As lideranças receberam treinamento sobre prevenção e identificação de assédio.',
  ],
  [
    'Os esforços e conquistas dos funcionários são reconhecidos pela empresa.',
    'A remuneração é percebida como compatível com as responsabilidades exigidas.',
    'Existem oportunidades reais de crescimento e desenvolvimento profissional na empresa.',
  ],
  [
    'Os funcionários têm autonomia adequada para tomar decisões relacionadas ao seu trabalho.',
    'Há espaço para que os funcionários proponham melhorias nos processos.',
    'O nível de supervisão é adequado — nem excessivo nem insuficiente.',
  ],
  [
    'A empresa respeita o horário de trabalho, evitando cobranças e mensagens fora do expediente.',
    'Os funcionários conseguem tirar férias e folgas sem pressão ou culpa.',
    'O trabalho não interfere negativamente na vida pessoal e familiar dos funcionários.',
  ],
]

const RECOMENDACOES: Record<number, { critico?: string; alto?: string; moderado?: string }> = {
  1: {
    critico: 'Risco crítico de burnout e afastamentos por sobrecarga. Ação urgente: mapeamento imediato das demandas por função, dimensionamento adequado de equipe e revisão de metas. Registre as medidas adotadas no PGR.',
    alto: 'Sobrecarga identificada como risco alto. Implante reuniões regulares de acompanhamento de carga, revise a distribuição de tarefas e crie mecanismos para que funcionários reportem sobrecarga com segurança.',
    moderado: 'Carga de trabalho em nível moderado. Monitore indicadores de horas extras e absenteísmo. Inclua carga de trabalho como fator de risco no inventário do PGR.',
  },
  2: {
    critico: 'Organização do trabalho comprometida — risco crítico de erros, retrabalho e frustração. Mapeie urgentemente os processos-chave, defina responsabilidades claras e implante comunicação estruturada de mudanças.',
    alto: 'Processos e responsabilidades pouco claros. Priorize a documentação de processos críticos e realize reuniões de alinhamento frequentes. Defina canais oficiais de comunicação interna.',
    moderado: 'Organização do trabalho razoável, com pontos de melhoria. Revise as descrições de cargo e garanta que todos compreendam suas atribuições.',
  },
  3: {
    critico: 'Relação com a liderança em nível crítico — alto risco de ações trabalhistas por assédio ou humilhação. Treinamento urgente de líderes é indispensável. Documente todas as medidas adotadas.',
    alto: 'Qualidade da liderança abaixo do necessário. Invista em capacitação de gestores em comunicação, feedback e gestão de conflitos. Implante avaliação de liderança pelos subordinados.',
    moderado: 'Liderança com bom desempenho em alguns pontos, mas com lacunas. Incentive uma cultura de feedback regular e melhore a transparência nas decisões.',
  },
  4: {
    critico: 'Ambiente com conflitos não gerenciados — risco crítico de clima tóxico e ações trabalhistas. Estruture imediatamente um protocolo de gestão de conflitos e capacite líderes para mediação.',
    alto: 'Conflitos organizacionais recorrentes e mal gerenciados. Crie canais formais para resolução de conflitos e incentive a cultura de colaboração entre áreas.',
    moderado: 'Conflitos gerenciáveis, mas com pontos de atenção. Melhore os mecanismos de comunicação interdepartamental.',
  },
  5: {
    critico: 'Risco crítico de assédio com ausência de políticas preventivas. Ação imediata: elabore a Política de Prevenção ao Assédio, implante canal de denúncia e treine todas as lideranças. A omissão gera responsabilidade legal direta da empresa.',
    alto: 'Prevenção ao assédio insuficiente. Formalize a política por escrito, comunique-a a todos os funcionários e estruture o processo de apuração de denúncias.',
    moderado: 'Prevenção ao assédio em andamento, mas incompleta. Reforce os treinamentos e garanta que o canal de denúncia seja amplamente conhecido.',
  },
  6: {
    critico: 'Falta crítica de reconhecimento — alto risco de desmotivação, rotatividade e processos por indenização. Implante imediatamente práticas estruturadas de reconhecimento e reveja a política de remuneração.',
    alto: 'Baixo reconhecimento identificado. Crie um programa de reconhecimento de desempenho, melhore o processo de feedback e reveja as oportunidades de crescimento oferecidas.',
    moderado: 'Reconhecimento razoável, com oportunidades de melhoria. Estruture um plano de carreira e regularize as práticas de feedback.',
  },
  7: {
    critico: 'Autonomia muito baixa — risco de micro-gestão excessiva e impacto direto na saúde mental. Reveja os níveis de supervisão e crie espaços para que funcionários influenciem seu trabalho.',
    alto: 'Autonomia insuficiente. Delegue mais responsabilidades de forma planejada e crie fóruns para que funcionários proponham melhorias.',
    moderado: 'Autonomia adequada em alguns aspectos. Identifique onde a supervisão excessiva ainda ocorre e ajuste.',
  },
  8: {
    critico: 'Equilíbrio vida-trabalho crítico — risco elevado de burnout e ações por dano existencial. Implante política de desconexão digital, respeite horários e monitore horas extras sistematicamente.',
    alto: 'Equilíbrio vida-trabalho comprometido. Defina uma política clara sobre comunicações fora do horário e incentive o uso de férias e folgas.',
    moderado: 'Equilíbrio com pontos de atenção. Monitore padrões de horas extras e reforce a política de desconexão.',
  },
}

const ESCALA = [
  { val: 1, label: 'Nunca' },
  { val: 2, label: 'Rara-mente' },
  { val: 3, label: 'Às vezes' },
  { val: 4, label: 'Frequen-temente' },
  { val: 5, label: 'Sempre' },
]

const SETORES = ['Comércio','Indústria','Serviços','Saúde','Educação','Tecnologia','Construção Civil','Agronegócio','Outro']
const FAIXAS  = ['1 a 10','11 a 20','21 a 50','51 a 100','101 a 300','Mais de 300']
const BADGES  = ['⚡','📋','👔','🤝','🛡️','⭐','🎯','⚖️']

// ── Helpers ───────────────────────────────────────────────────────────────────

function nivelRisco(score: number): { nivel: string; cls: string; cor: string } {
  if (score >= 4.0) return { nivel: 'Baixo',    cls: 'baixo',    cor: '#16a34a' }
  if (score >= 3.0) return { nivel: 'Moderado', cls: 'moderado', cor: '#ca8a04' }
  if (score >= 2.0) return { nivel: 'Alto',     cls: 'alto',     cor: '#ea580c' }
  return               { nivel: 'Crítico',  cls: 'critico',  cor: '#dc2626' }
}

function buildResultHtml(empresa: string, respostas: Record<string, number>): string {
  const scores = FATORES.map((f, fi) => {
    let soma = 0
    for (let q = 0; q < f.nqs; q++) soma += respostas[`f${fi + 1}q${q}`] ?? 3
    return +(soma / f.nqs).toFixed(2)
  })

  const scoreGeral  = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
  const nivelGeral  = nivelRisco(scoreGeral)
  const agora       = new Date().toLocaleDateString('pt-BR')

  let html = `
  <div class="diag-resultado-header">
    <div class="diag-resultado-empresa">${empresa}</div>
    <h2>Diagnóstico de Riscos Psicossociais</h2>
    <p>NR-1 (atualização 2025) · Emitido em ${agora}</p>
    <div class="diag-score-geral">
      <div class="diag-score-numero" style="color:${nivelGeral.cor}">${scoreGeral.toFixed(1)}</div>
      <div class="diag-score-info">
        <div class="diag-score-label">Score geral (escala 1–5)</div>
        <div class="diag-score-nivel" style="color:${nivelGeral.cor}">Risco ${nivelGeral.nivel}</div>
      </div>
    </div>
  </div>`

  html += `<div class="diag-mapa-titulo">📊 Mapa de Riscos por Fator</div>`
  html += `
  <div class="diag-legenda">
    <div class="diag-leg-item"><div class="diag-leg-dot" style="background:#16a34a"></div>Baixo (4,0–5,0)</div>
    <div class="diag-leg-item"><div class="diag-leg-dot" style="background:#ca8a04"></div>Moderado (3,0–3,9)</div>
    <div class="diag-leg-item"><div class="diag-leg-dot" style="background:#ea580c"></div>Alto (2,0–2,9)</div>
    <div class="diag-leg-item"><div class="diag-leg-dot" style="background:#dc2626"></div>Crítico (1,0–1,9)</div>
  </div>`

  const ordenados = scores
    .map((s, i) => ({ idx: i, score: s, ...FATORES[i], ...nivelRisco(s) }))
    .sort((a, b) => a.score - b.score)

  ordenados.forEach(f => {
    const pct = ((f.score - 1) / 4) * 100
    html += `
    <div class="diag-fator-row">
      <div class="diag-fator-emoji">${f.emoji}</div>
      <div class="diag-fator-nome">${f.nome}</div>
      <div class="diag-fator-barra-track">
        <div class="diag-fator-barra-fill diag-cor-${f.cls}" style="width:${pct}%"></div>
      </div>
      <div class="diag-fator-score" style="color:${f.cor}">${f.score.toFixed(1)}</div>
      <div class="diag-fator-nivel diag-nivel-${f.cls}">Risco ${f.nivel}</div>
    </div>`
  })

  html += `<div class="diag-recom-titulo">🎯 Recomendações Prioritárias</div>`

  let temRecom = false
  ordenados.forEach(f => {
    const recs = RECOMENDACOES[f.idx + 1]
    if (!recs) return
    let texto: string | null = null
    let tipoCls: string | null = null
    if (f.cls === 'critico' && recs.critico)   { texto = recs.critico;  tipoCls = 'critico'  }
    else if (f.cls === 'alto' && recs.alto)     { texto = recs.alto;     tipoCls = 'alto'     }
    else if (f.cls === 'moderado' && recs.moderado) { texto = recs.moderado; tipoCls = 'moderado' }
    if (texto) {
      temRecom = true
      html += `
      <div class="diag-recom-card diag-recom-${tipoCls}">
        <div class="diag-recom-header"><span>${f.emoji}</span><strong>${f.nome} — Risco ${f.nivel}</strong></div>
        <p>${texto}</p>
      </div>`
    }
  })

  if (!temRecom) {
    html += `
    <div class="diag-recom-card" style="border-color:#16a34a;background:#dcfce7">
      <div class="diag-recom-header"><span>✅</span><strong>Excelente resultado!</strong></div>
      <p>Todos os fatores apresentam risco baixo. Mantenha o monitoramento periódico e documente as práticas adotadas no PGR para evidenciar a conformidade com a NR-1.</p>
    </div>`
  }

  html += `
  <div style="margin-top:24px;padding:16px 20px;background:#f8f9fa;border-radius:12px;border:1px solid #e8eaed;">
    <p style="font-size:12px;color:#666;line-height:1.7;margin:0">
      <strong style="color:#162030">⚖️ Importante:</strong> Este diagnóstico é indicativo e não substitui análise jurídica individualizada. Os resultados devem ser usados como ponto de partida para a gestão dos riscos psicossociais da sua empresa, com acompanhamento de profissional habilitado.
    </p>
  </div>`

  return html
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiagnosticoNR1() {
  const [tela,       setTela]       = useState(0)
  const [nome,       setNome]       = useState('')
  const [setor,      setSetor]      = useState('')
  const [numFunc,    setNumFunc]    = useState('')
  const [respondente,setRespondente]= useState('')
  const [respostas,  setRespostas]  = useState<Record<string, number>>({})
  const [alerta,     setAlerta]     = useState(false)
  const [resultHtml, setResultHtml] = useState('')

  const TOTAL = 9

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [tela])

  function irPara(n: number) {
    setAlerta(false)
    setTela(n)
  }

  function avancar() {
    if (tela === 0) {
      if (!nome.trim() || !setor || !numFunc) { setAlerta(true); return }
      irPara(1); return
    }
    if (tela >= 1 && tela <= 8) {
      const nqs = FATORES[tela - 1].nqs
      for (let q = 0; q < nqs; q++) {
        if (respostas[`f${tela}q${q}`] == null) { setAlerta(true); return }
      }
      if (tela === 8) {
        setResultHtml(buildResultHtml(nome, respostas))
        irPara(9)
      } else {
        irPara(tela + 1)
      }
    }
  }

  function voltar() { if (tela > 0) irPara(tela - 1) }

  function reiniciar() {
    setNome(''); setSetor(''); setNumFunc(''); setRespondente('')
    setRespostas({}); setAlerta(false); setResultHtml('')
    irPara(0)
  }

  function setResposta(fator: number, q: number, val: number) {
    setRespostas(prev => ({ ...prev, [`f${fator}q${q}`]: val }))
    setAlerta(false)
  }

  const pct = Math.round((tela / TOTAL) * 100)
  const progressLabels = ['Identificação', ...FATORES.map(f => f.nome), 'Resultado']

  return (
    <div className="diag-root">
      <style>{`
        .diag-root {
          --azul: #162030;
          --azul-medio: #1e2f45;
          --ouro: #C49557;
          --ouro-claro: #D4A96A;
          --texto: #2B2F31;
          --cinza: #f5f6f8;
          --cinza2: #e8eaed;
          --verde: #16a34a;
          --amarelo: #ca8a04;
          --laranja: #ea580c;
          --vermelho: #dc2626;
          --verde-bg: #dcfce7;
          --amarelo-bg: #fef9c3;
          --laranja-bg: #ffedd5;
          --vermelho-bg: #fee2e2;
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
          color: var(--texto);
          background: var(--cinza);
          min-height: 100vh;
        }
        .diag-topo {
          background: var(--azul);
          padding: 18px 32px;
          display: flex;
          align-items: center;
          gap: 14px;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 2px 12px rgba(0,0,0,0.3);
        }
        .diag-topo-logo { display: flex; flex-direction: column; line-height: 1.2; }
        .diag-topo-logo span:first-child { font-size: 18px; font-weight: 800; color: #fff; letter-spacing: -0.3px; }
        .diag-topo-logo span:last-child { font-size: 11px; font-weight: 400; color: var(--ouro-claro); letter-spacing: 1px; text-transform: uppercase; }
        .diag-topo-divider { width: 1px; height: 36px; background: rgba(255,255,255,0.2); margin: 0 4px; }
        .diag-topo-titulo { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.75); }
        .diag-wrapper { max-width: 780px; margin: 0 auto; padding: 40px 20px 80px; }
        .diag-progress-box {
          background: #fff; border-radius: 14px; padding: 20px 28px;
          margin-bottom: 28px; box-shadow: 0 1px 4px rgba(0,0,0,0.07);
        }
        .diag-progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .diag-progress-label { font-size: 13px; font-weight: 600; color: var(--azul); }
        .diag-progress-pct { font-size: 13px; color: #888; }
        .diag-progress-track { height: 6px; background: var(--cinza2); border-radius: 99px; overflow: hidden; }
        .diag-progress-fill { height: 100%; background: linear-gradient(90deg, var(--azul), var(--ouro)); border-radius: 99px; transition: width 0.4s ease; }
        .diag-etapas { display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; }
        .diag-etapa-dot { width: 28px; height: 4px; border-radius: 99px; background: var(--cinza2); }
        .diag-etapa-dot.ativa { background: var(--azul); }
        .diag-etapa-dot.feita { background: var(--ouro); }
        .diag-card {
          background: #fff; border-radius: 16px; padding: 36px 40px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.07); animation: diagFadeIn 0.3s ease;
        }
        @keyframes diagFadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .diag-fator-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--azul); color: #fff; font-size: 11px; font-weight: 700;
          letter-spacing: 1.2px; text-transform: uppercase;
          padding: 5px 14px; border-radius: 99px; margin-bottom: 20px;
        }
        .diag-card-titulo { font-size: 22px; font-weight: 800; color: var(--azul); margin-bottom: 8px; line-height: 1.3; }
        .diag-card-subtitulo { font-size: 14px; color: #666; margin-bottom: 32px; line-height: 1.6; }
        .diag-questao { margin-bottom: 32px; padding-bottom: 32px; border-bottom: 1px solid var(--cinza2); }
        .diag-questao:last-of-type { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .diag-questao-texto { font-size: 15px; font-weight: 600; color: var(--texto); margin-bottom: 16px; line-height: 1.5; }
        .diag-questao-num {
          display: inline-flex; align-items: center; justify-content: center;
          width: 24px; height: 24px; background: var(--cinza); border-radius: 50%;
          font-size: 11px; font-weight: 700; color: var(--azul);
          margin-right: 8px; flex-shrink: 0; vertical-align: middle;
        }
        .diag-escala { display: flex; gap: 8px; }
        .diag-escala-item { flex: 1; cursor: pointer; }
        .diag-escala-btn {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 10px 6px; border: 2px solid var(--cinza2); border-radius: 10px;
          transition: all 0.18s; background: #fff; width: 100%;
        }
        .diag-escala-btn:hover { border-color: var(--azul); background: #f0f4fb; }
        .diag-escala-btn.selecionado { border-color: var(--azul); background: var(--azul); }
        .diag-escala-num { font-size: 18px; font-weight: 800; color: var(--azul); line-height: 1; }
        .diag-escala-btn.selecionado .diag-escala-num { color: #fff; }
        .diag-escala-lbl {
          font-size: 9px; font-weight: 600; text-align: center; color: #888;
          letter-spacing: 0.3px; text-transform: uppercase; line-height: 1.3;
          word-break: keep-all; hyphens: none;
        }
        .diag-escala-btn.selecionado .diag-escala-lbl { color: rgba(255,255,255,0.8); }
        .diag-botoes { display: flex; justify-content: space-between; align-items: center; margin-top: 36px; gap: 12px; }
        .diag-btn { padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 700; border: none; cursor: pointer; transition: all 0.18s; font-family: inherit; }
        .diag-btn-primario { background: var(--azul); color: #fff; flex: 1; max-width: 260px; }
        .diag-btn-primario:hover { background: var(--azul-medio); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(22,32,48,0.3); }
        .diag-btn-secundario { background: transparent; color: var(--azul); border: 2px solid var(--cinza2) !important; }
        .diag-btn-secundario:hover { border-color: var(--azul) !important; background: #f0f4fb; }
        .diag-btn-ouro { background: var(--ouro); color: #fff; flex: 1; max-width: 300px; }
        .diag-btn-ouro:hover { background: #A07840; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(196,149,87,0.4); }
        .diag-alerta { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #9a3412; margin-top: 16px; }
        .diag-intro-hero { text-align: center; padding: 8px 0 32px; }
        .diag-intro-icon {
          width: 72px; height: 72px; background: var(--azul); border-radius: 20px;
          display: flex; align-items: center; justify-content: center;
          font-size: 32px; margin: 0 auto 24px;
        }
        .diag-intro-titulo { font-size: 28px; font-weight: 900; color: var(--azul); margin-bottom: 12px; line-height: 1.2; }
        .diag-intro-desc { font-size: 15px; color: #555; max-width: 520px; margin: 0 auto 32px; line-height: 1.7; }
        .diag-chips { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-bottom: 32px; }
        .diag-chip { background: var(--cinza); border: 1px solid var(--cinza2); border-radius: 99px; padding: 6px 16px; font-size: 13px; font-weight: 500; color: var(--azul); }
        .diag-campo-label { display: block; font-size: 13px; font-weight: 600; color: var(--azul); margin-bottom: 6px; }
        .diag-campo-input {
          width: 100%; padding: 12px 16px; border: 2px solid var(--cinza2);
          border-radius: 10px; font-size: 15px; font-family: inherit; color: var(--texto);
          background: #fff; transition: border-color 0.18s; margin-bottom: 18px; box-sizing: border-box;
        }
        .diag-campo-input:focus { outline: none; border-color: var(--azul); }
        .diag-campo-select {
          width: 100%; padding: 12px 16px; border: 2px solid var(--cinza2);
          border-radius: 10px; font-size: 15px; font-family: inherit; color: var(--texto);
          background: #fff; transition: border-color 0.18s; margin-bottom: 18px;
          appearance: none; cursor: pointer; box-sizing: border-box;
        }
        .diag-campo-select:focus { outline: none; border-color: var(--azul); }

        /* ── Result styles (dangerouslySetInnerHTML) ── */
        .diag-resultado-header {
          background: linear-gradient(135deg, var(--azul) 0%, var(--azul-medio) 100%);
          border-radius: 16px; padding: 32px; color: #fff; text-align: center; margin-bottom: 28px;
        }
        .diag-resultado-header h2 { font-size: 24px; font-weight: 900; margin-bottom: 6px; color: #fff; }
        .diag-resultado-header p { font-size: 14px; color: rgba(255,255,255,0.75); margin: 0; }
        .diag-resultado-empresa { font-size: 18px; font-weight: 700; color: var(--ouro-claro); margin-bottom: 4px; }
        .diag-score-geral { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 20px 0 0; }
        .diag-score-numero { font-size: 56px; font-weight: 900; line-height: 1; }
        .diag-score-info { text-align: left; }
        .diag-score-label { font-size: 11px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1px; }
        .diag-score-nivel { font-size: 20px; font-weight: 800; }
        .diag-mapa-titulo { font-size: 16px; font-weight: 800; color: var(--azul); margin-bottom: 16px; }
        .diag-fator-row {
          display: flex; align-items: center; gap: 14px; margin-bottom: 12px;
          padding: 14px 18px; border-radius: 12px; background: var(--cinza); transition: transform 0.15s;
        }
        .diag-fator-row:hover { transform: translateX(3px); }
        .diag-fator-emoji { font-size: 20px; flex-shrink: 0; }
        .diag-fator-nome { flex: 1; font-size: 14px; font-weight: 600; color: var(--texto); min-width: 0; }
        .diag-fator-barra-track { width: 180px; height: 8px; background: var(--cinza2); border-radius: 99px; overflow: hidden; flex-shrink: 0; }
        .diag-fator-barra-fill { height: 100%; border-radius: 99px; transition: width 1s ease; }
        .diag-fator-score { font-size: 15px; font-weight: 800; min-width: 32px; text-align: right; flex-shrink: 0; }
        .diag-fator-nivel { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 99px; flex-shrink: 0; min-width: 80px; text-align: center; }
        .diag-nivel-baixo    { background: var(--verde-bg);   color: var(--verde);   }
        .diag-nivel-moderado { background: var(--amarelo-bg); color: var(--amarelo); }
        .diag-nivel-alto     { background: var(--laranja-bg); color: var(--laranja); }
        .diag-nivel-critico  { background: var(--vermelho-bg);color: var(--vermelho);}
        .diag-cor-baixo    { background: var(--verde);   }
        .diag-cor-moderado { background: var(--amarelo); }
        .diag-cor-alto     { background: var(--laranja); }
        .diag-cor-critico  { background: var(--vermelho);}
        .diag-legenda { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0 28px; }
        .diag-leg-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #666; }
        .diag-leg-dot { width: 10px; height: 10px; border-radius: 50%; }
        .diag-recom-titulo { font-size: 16px; font-weight: 800; color: var(--azul); margin: 28px 0 16px; }
        .diag-recom-card { border-radius: 12px; padding: 18px 20px; margin-bottom: 12px; border-left: 4px solid; }
        .diag-recom-critico  { border-color: var(--vermelho); background: var(--vermelho-bg); }
        .diag-recom-alto     { border-color: var(--laranja);  background: var(--laranja-bg);  }
        .diag-recom-moderado { border-color: var(--amarelo);  background: var(--amarelo-bg);  }
        .diag-recom-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .diag-recom-header strong { font-size: 14px; font-weight: 700; color: var(--texto); }
        .diag-recom-card p { font-size: 13px; color: #444; line-height: 1.6; margin: 0; }

        .diag-cta-box {
          background: linear-gradient(135deg, var(--azul) 0%, var(--azul-medio) 100%);
          border-radius: 16px; padding: 28px 32px; text-align: center; margin-top: 28px; color: #fff;
        }
        .diag-cta-box h3 { font-size: 18px; font-weight: 800; margin-bottom: 8px; color: #fff; }
        .diag-cta-box p { font-size: 14px; color: rgba(255,255,255,0.8); margin-bottom: 20px; line-height: 1.6; }
        .diag-cta-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .diag-rodape { text-align: center; margin-top: 40px; font-size: 12px; color: #aaa; }
        .diag-rodape strong { color: var(--ouro); }

        @media print {
          .diag-topo, .diag-botoes, .diag-cta-box, .diag-progress-box { display: none !important; }
          .diag-root { background: #fff; }
          .diag-resultado-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .diag-fator-row, .diag-recom-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @media (max-width: 600px) {
          .diag-card { padding: 24px 20px; }
          .diag-escala { gap: 5px; }
          .diag-escala-btn { padding: 8px 2px; }
          .diag-escala-num { font-size: 15px; }
          .diag-fator-barra-track { width: 80px; }
          .diag-botoes { flex-direction: column-reverse; }
          .diag-btn-primario, .diag-btn-ouro { max-width: 100%; }
        }
      `}</style>

      {/* Topo */}
      <div className="diag-topo">
        <div className="diag-topo-logo">
          <span>Bússola da NR-1</span>
          <span>Pessoa e do Val Advocacia</span>
        </div>
        <div className="diag-topo-divider" />
        <div className="diag-topo-titulo">Diagnóstico de Riscos Psicossociais</div>
      </div>

      <div className="diag-wrapper">
        {/* Barra de progresso */}
        {tela < TOTAL && (
          <div className="diag-progress-box">
            <div className="diag-progress-header">
              <span className="diag-progress-label">{progressLabels[tela]}</span>
              <span className="diag-progress-pct">{pct}%</span>
            </div>
            <div className="diag-progress-track">
              <div className="diag-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="diag-etapas">
              {Array.from({ length: TOTAL + 1 }, (_, i) => (
                <div
                  key={i}
                  className={`diag-etapa-dot${i < tela ? ' feita' : i === tela ? ' ativa' : ''}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Tela 0: Identificação */}
        {tela === 0 && (
          <div className="diag-card">
            <div className="diag-intro-hero">
              <div className="diag-intro-icon">🧭</div>
              <h1 className="diag-intro-titulo">Diagnóstico de Riscos<br />Psicossociais — NR-1</h1>
              <p className="diag-intro-desc">
                Este diagnóstico avalia 8 fatores de risco do seu ambiente de trabalho conforme exigido pela NR-1 atualizada. Ao final, você receberá um relatório com o nível de risco por fator e recomendações prioritárias.
              </p>
              <div className="diag-chips">
                <span className="diag-chip">⏱ 5 a 8 minutos</span>
                <span className="diag-chip">📊 8 fatores avaliados</span>
                <span className="diag-chip">✅ Gratuito e confidencial</span>
              </div>
            </div>

            <label className="diag-campo-label">Nome da empresa *</label>
            <input
              className="diag-campo-input"
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex.: Ferreira & Associados Ltda"
            />

            <label className="diag-campo-label">Setor de atuação *</label>
            <select className="diag-campo-select" value={setor} onChange={e => setSetor(e.target.value)}>
              <option value="">Selecione...</option>
              {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <label className="diag-campo-label">Número de funcionários *</label>
            <select className="diag-campo-select" value={numFunc} onChange={e => setNumFunc(e.target.value)}>
              <option value="">Selecione...</option>
              {FAIXAS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            <label className="diag-campo-label">Seu nome / cargo (opcional)</label>
            <input
              className="diag-campo-input"
              type="text"
              value={respondente}
              onChange={e => setRespondente(e.target.value)}
              placeholder="Ex.: Ana Lima — Gerente de RH"
            />

            {alerta && <div className="diag-alerta">⚠️ Por favor, preencha os campos obrigatórios antes de continuar.</div>}

            <div className="diag-botoes" style={{ justifyContent: 'flex-end' }}>
              <button className="diag-btn diag-btn-primario" onClick={avancar}>Iniciar diagnóstico →</button>
            </div>
          </div>
        )}

        {/* Telas 1–8: Fatores */}
        {tela >= 1 && tela <= 8 && (() => {
          const fi = tela - 1
          return (
            <div className="diag-card">
              <div className="diag-fator-badge">
                <span>{BADGES[fi]}</span> Fator {tela} de 8
              </div>
              <h2 className="diag-card-titulo">{FATORES[fi].nome}</h2>
              <p className="diag-card-subtitulo">{SUBTITULOS[fi]}</p>

              {QUESTOES[fi].map((q, qi) => (
                <div className="diag-questao" key={qi}>
                  <div className="diag-questao-texto">
                    <span className="diag-questao-num">{qi + 1}</span>{q}
                  </div>
                  <div className="diag-escala">
                    {ESCALA.map(e => {
                      const sel = respostas[`f${tela}q${qi}`] === e.val
                      return (
                        <div key={e.val} className="diag-escala-item" onClick={() => setResposta(tela, qi, e.val)}>
                          <div className={`diag-escala-btn${sel ? ' selecionado' : ''}`}>
                            <span className="diag-escala-num">{e.val}</span>
                            <span className="diag-escala-lbl">{e.label}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {alerta && <div className="diag-alerta">⚠️ Responda todas as questões antes de continuar.</div>}

              <div className="diag-botoes">
                <button className="diag-btn diag-btn-secundario" onClick={voltar}>← Voltar</button>
                {tela < 8
                  ? <button className="diag-btn diag-btn-primario" onClick={avancar}>Próximo →</button>
                  : <button className="diag-btn diag-btn-ouro"    onClick={avancar}>Ver meu diagnóstico →</button>
                }
              </div>
            </div>
          )
        })()}

        {/* Tela 9: Resultados */}
        {tela === 9 && (
          <div className="diag-card">
            <div dangerouslySetInnerHTML={{ __html: resultHtml }} />
            <div className="diag-cta-box">
              <h3>Quer transformar este diagnóstico em ação?</h3>
              <p>
                Nossa equipe pode ajudar sua empresa a elaborar o PGR, estruturar o canal de denúncia e garantir a conformidade jurídica com a NR-1.
              </p>
              <div className="diag-cta-btns">
                <a
                  href="https://wa.me/5531971766583?text=Ol%C3%A1%2C%20fiz%20o%20diagn%C3%B3stico%20NR-1%20e%20gostaria%20de%20uma%20an%C3%A1lise%20jur%C3%ADdica"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="diag-btn diag-btn-ouro"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Solicitar análise jurídica
                </a>
                <button
                  className="diag-btn diag-btn-secundario"
                  style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                  onClick={() => window.print()}
                >
                  🖨️ Imprimir
                </button>
                <button
                  className="diag-btn diag-btn-secundario"
                  style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                  onClick={reiniciar}
                >
                  ↺ Novo diagnóstico
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="diag-rodape">
          Diagnóstico elaborado com base na NR-1 (atualização 2025) · <strong>Pessoa e do Val Advocacia</strong><br />
          Dra. Valéria do Val · OAB/MG 98.185
        </div>
      </div>
    </div>
  )
}
