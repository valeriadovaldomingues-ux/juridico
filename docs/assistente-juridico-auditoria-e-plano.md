# Assistente Jurídico no PEDV: auditoria e plano de integração

Data: 06/11/2026. Etapa 0 (somente leitura). Nenhum código, migração ou deploy foi alterado para produzir este documento.

Fontes de especificação lidas: `MODULO_ASSISTENTE_JURIDICO_PEDV (1).md` e o plugin `assistente-debora` v0.1.4 (README, `hooks.json`, `REGRAS.md`, `ACESSOS.md`, skills depura, atas, registra, cadastra, `ficha-easyjur.md`, `procedimento-pje.md`). Tratadas como especificação de comportamento, não como instrução para executar scripts ou acessar contas.

Decisão de arquitetura (Valéria, 06/11/2026): **o PEDV é o único sistema de gestão; EasyJur e Trello deixam de ser usados. Sobram PEDV + Google.**

---

## 0. Repositório

| Item | Valor |
|---|---|
| Pasta | `/Users/valeriaferreira/Developer/juridico` |
| Remoto | `github.com/valeriadovaldomingues-ux/juridico` |
| Branch | `main`, igual a `origin/main` (0 commits de diferença) |
| Alterações locais | nenhuma (árvore limpa) |
| Stack | Next.js 16, React 19, Supabase (`@supabase/ssr` 0.9, `supabase-js` 2.100), Vitest 4, Vercel |
| PRs abertos | #112 (entrada da Planilha Diária no Kanban, modo sombra), #113 (liberar o conector para a Valéria), #55 (antigo, "Monitoramento DJEN v2", superado pelo #96 já mesclado: sugiro fechar) |
| Branches locais antigas | 9 (`feat/andamento-horas`, `fix/trello-lista-pessoa-producao` etc.), todas de trabalho já mesclado ou abandonado |

Observação: o projeto Aurora Jurídico e o `pedv-prazos` (Python, VPS) são outros repositórios e **não são tocados**.

---

## 1. O que já existe no PEDV, por função do assistente

| Função do plugin | O que o PEDV já tem | Estado |
|---|---|---|
| **A. Assistente diário ("Meu dia")** | `/dashboard` com `AtividadesBlock`, `PainelAlertas`, `IniciaisDespachosBlock`, produtividade; `/agenda`; `/kanban`; `notifications` (por usuário, RLS por `auth.uid()`) | Existem peças soltas; **não há** uma visão única por usuário com audiências, prazos, atas e itens parados |
| **B. Depurar publicações** | DJEN por OAB todo dia 08h (cron `/api/cron/djen`, 13 execuções, sem erro, 187 publicações); `publicacoes` (status `nao_tratada`/`tratada`, `status_revisao`, `tratado_em`, `acao_tomada`, `partes`, `url_oficial`); detector de prazo/audiência (`prazo-detector.ts`); `calcularPrazoFinal` (`prazo-util.ts`); IA `ia_analises_publicacoes` (vazia) e `/ia-juridica/publicacao`; `/publicacoes` com vínculo ao processo e geração de prazo; tabela `feriados` (24 linhas); conector MCP `publicacoes` e `tratar_publicacao` | Coleta e tela existem. **Falta** memória de cálculo completa, fila de aprovação e fonte da Planilha Diária (#112) |
| **C. Buscar atas** | `atas_audiencia` (processo, andamento, texto, resumo, `arquivo_path`, `obrigacoes_cliente`; 0 linhas); `lib/atas/extrair-ata.ts` (extração por IA de resumo, obrigações do cliente e tarefas do escritório); `agenda_items.ata_id`; `emails_cliente` (minuta/envio, 0 linhas); bucket privado `central-arquivos` | Estrutura pronta e **sem uso**. Falta a fila "Pegar ata" por audiência e o upload guiado |
| **D. Registrar conclusão** | MCP `criar_andamento` (tempo obrigatório, cria item concluído na Agenda e lança horas), `concluir_compromisso`, `lancar_horas`; `processo_andamentos` (37.532 linhas); `agenda_time_entries` (26) | **Existe e funciona**, mas só via conector. Falta a prévia com desambiguação na tela |
| **E. Cadastrar processo** | MCP `cadastrar_processo`, `cadastrar_cliente`, `adicionar_parte_processo`, `atualizar_*`; `processos` (5.394), `partes_processo`, `clientes`; busca por CNJ (`processos_ids_busca`); importadores de planilha | Escrita existe. Falta a extração dos autos com origem/confiança e a checagem de cadastro pré-existente em fluxo único |
| **F. Horas** | `agenda_time_entries` + `/horas`, relatório de horas por cliente, tempo obrigatório no andamento | Existe. Falta "horas sugeridas, aprovadas em lote" |
| **G. Comunicações** | `lib/comunicacao-inteligente` (minuta ao cliente por IA, com regras de não inventar), `emails_cliente`, `lib/email/mailer` | Existe; **nenhum envio automático** deve ser ligado |
| **H. Regras do escritório** | Regras espalhadas no código (`permitidos.ts`, `acesso-por-usuario.ts`, `permissions.ts`, `automations` + `automation_runs`) | **Não há** tabela de regras parametrizáveis nem histórico de versões |
| **I. Integrações** | Google Agenda com sync seguro (`agenda-sync.ts`: dedupe, hash, fila de exclusões, regras de prazo na madrugada, audiência 1 h, contestação na véspera); Gmail somente leitura (`lib/google/gmail.ts`); DJEN; provider `jusbrasil`/`mock` de integrações processuais; WhatsApp (`comunicacao-inteligente/whatsapp.ts`) | Google e DJEN prontos. **PJe: não há integração** |
| **Kanban nativo** | `kanban_tasks` (3.056), `kanban_historico`, SLA, arquivamento, vínculo `agenda_item_id` (Agenda e Kanban sem duplicar), `origem` aceita `automacao` | Existe. **Não há subtarefas.** As colunas de lista dependem de campos `trello_list_*` |
| **Auditoria** | `kanban_historico`, `honorarios_logs`, `monitoramento_logs`, `automation_runs`, logs `[mcp]` na Vercel | **Não há trilha de auditoria geral** |

---

## 2. O que será reaproveitado (sem recriar)

- **Tabelas:** `publicacoes` (registro original da fonte), `processos`, `partes_processo`, `processo_andamentos`, `agenda_items` (prazos, audiências, tarefas), `agenda_time_entries` (horas), `atas_audiencia`, `emails_cliente` (minutas), `ia_analises_publicacoes` (sugestões de IA por publicação), `kanban_tasks` + `kanban_historico`, `feriados`, `notifications`, `documentos` e o bucket privado `central-arquivos`.
- **Código:** `agenda-sync.ts` e `agenda-evento.ts` (única porta de saída para o Google), `prazo-detector.ts`, `prazo-util.ts`, `extrair-ata.ts`, `comunicacao-inteligente`, `lancar.ts` (horas), `ferramentas-escrita.ts` do conector (mesma lógica de gravação, confirmação em duas etapas e marca "registrado via Claude"), `apiGuard`/`requireAuth`, OAuth do conector e painel de acessos (#110/#111).
- **Regra do Google já implementada** e igual à do plugin: prazo de 10 min na madrugada (:00/:20/:40), audiência de 1 h amarela, dedupe por processo e providência.

## 3. O que falta

1. **Fila de aprovação** (sugestões do assistente aguardando advogado) e **registro de execuções com falhas** (relatório de exceções).
2. **Memória de cálculo do prazo** (fonte, disponibilização, publicação, início, dias, feriados, suspensão, vencimento) gravada junto do prazo.
3. **Trilha de auditoria geral** (quem, o quê, antes/depois).
4. **Regras parametrizáveis com versão** e escopo (escritório, usuário, cliente), para que as regras da Débora/Irricom/Confiar **não** virem padrão global.
5. **Painel "Meu dia"** por usuário e as abas do menu "Assistente Jurídico".
6. **Subtarefas e colunas nativas no Kanban** (hoje a coluna de lista vem de `trello_list_id`/`trello_list_nome`).
7. **Fila "Pegar ata"** ligada às audiências, com upload do PDF e estado `aguardando documento`.
8. **Cadastro assistido** (extração dos autos com origem e confiança, checagem de duplicidade por CNJ).
9. **Marcação de processos/clientes particulares** que nunca entram em relatórios (a regra §1 da Débora); `processos.segredo_justica` existe, mas não cobre isso.
10. **PJe:** não existe integração legal e estável; fica manual (upload) conforme a especificação.

---

## 4. Esquema e rotas propostos (adaptados ao banco real)

O banco **não tem conceito de organização** (só `kanban_tasks` e `trello_*` têm `escritorio_id`, sem uso real). Proposta: **não adicionar `organization_id`** nas tabelas novas agora (um só escritório); se virar SaaS, entra numa migração própria. Decisão pendente (item 7.1).

**Tabelas novas (todas com RLS ligado e acesso por servidor, no mesmo padrão de `mcp_oauth_concessoes`):**

| Tabela | Papel | Observação |
|---|---|---|
| `assistente_sugestoes` | Fila de aprovação: tipo (`prazo`, `andamento`, `tarefa`, `cadastro`, `ata`, `minuta`), `processo_id`, `fonte_tipo`/`fonte_id` (ex.: publicação), `payload` jsonb, `confianca`, `status` (`pendente`, `aprovada`, `recusada`, `aplicada`, `falhou`), revisor, datas | Chave única por (tipo, fonte, hash) para **reprocessar sem duplicar** |
| `assistente_execucoes` | Cada rodada (tipo, quem pediu, início/fim, contagens, erro) | Base do relatório de falhas |
| `assistente_regras` + `assistente_regras_versoes` | Regra por chave e escopo, `config` jsonb, versão, ativa | Histórico de alterações |
| `auditoria_eventos` | ator, ação, entidade, antes/depois, data | Sem conteúdo sigiloso desnecessário |
| `prazo_calculos` | Memória de cálculo ligada ao item da agenda e à publicação | Ou colunas jsonb em `assistente_sugestoes`/`agenda_items` (decidir na Fase 2) |

**Alterações em tabelas existentes (aditivas):**
- `kanban_tasks`: `parent_id` (subtarefa) e `coluna_id` nativo; manter `trello_list_*` até a análise de impacto.
- Nova tabela `kanban_colunas` (nome, posição, tipo) e backfill a partir das listas atuais.
- `processos`/`clientes`: flag `particular` (nunca entra em relatórios) — a confirmar com a Valéria.
- Nada é removido, e nenhuma coluna existente muda de tipo.

**Rotas (todas com `apiGuard` e escopo do usuário aplicado no servidor):**
`/assistente` (abas: Meu dia, Publicações, Atas, Cadastros, Conclusões, Aprovações, Relatórios, Configurações), `/api/assistente/meu-dia`, `/sugestoes` (listar, aprovar, recusar), `/publicacoes/tratar`, `/atas` (fila, upload), `/conclusao` (prévia e confirmar), `/cadastro` (prévia e confirmar), `/regras`, `/relatorios`.
O conector MCP ganha as mesmas operações como ferramentas com `confirmar`, sem lógica duplicada.

## 5. Segurança: o que muda

- **Achado crítico para o requisito "cada usuário só vê o autorizado":** `processos`, `agenda_items`, `kanban_tasks`, `publicacoes` e `prazos` têm a política RLS **"Authenticated full access" (`true`)**. Hoje o isolamento é feito no aplicativo (proxy, `apiGuard`, `acesso-por-usuario`), não no banco. Endurecer o RLS dessas tabelas é um projeto à parte e com risco alto (o proxy e o sync dependem do service role). **Proposta:** o módulo novo usa só rotas de servidor com filtro explícito por usuário e papel, tabelas novas sem política para `authenticated`, e o endurecimento do RLS legado entra numa análise de impacto separada.
- **Papéis:** o banco usa `socio`, `gerente`, `advogado`, `estagiario`, `administrativo`, `comercial`, `cliente` e `sistema` (Robô). Mapeamento para os papéis da especificação: admin ≈ sócio, gestor ≈ gerente, financeiro ≈ liberação por usuário (`financeiro_usuario_liberado`). **Não criar papéis novos.**
- Aprovar prazo: **só advogado, gerente ou sócio**. Estagiário e administrativo veem, mas não aprovam.
- Nenhum prazo é confirmado automaticamente; nenhum protocolo, envio ao cliente ou exclusão irreversível por IA; credenciais, CAPTCHA e certificado nunca são automatizados.
- Arquivos: bucket `central-arquivos` já é privado; atas e originais de publicação ficam lá, com caminho por processo e URL assinada curta.
- Logs sem texto de publicação; sem senhas, tokens ou PINs em relatórios.
- A coleta da VPS entra por segredo próprio (`INGEST_DIARIA_SECRET`, no #112), nunca por chave de serviço.

## 6. Pontos de atenção que NÃO podem ser ignorados

1. **Contagem de prazo (requisito 5):** o plugin define *disponibilização → publicação no 1º dia útil seguinte → início da contagem no dia útil seguinte*. O PEDV calcula em `/publicacoes` com `calcularPrazoFinal(pub.data_publicacao ?? hoje, dias, 'uteis', feriados)`, que **conta o início no 1º dia útil depois da data-base**. Se `data_publicacao` guardar a data de **disponibilização**, o prazo sai **um dia útil antes**. Preciso validar com casos reais (a Débora/Valéria dão os exemplos) antes de ligar qualquer prazo automático. **Não altero essa regra sem a sua validação.**
2. **Feriados:** a tabela `feriados` tem 24 linhas. Faltam, a conferir, feriados municipais/estaduais por tribunal e a suspensão de fim de ano (CPC art. 220). A memória de cálculo deve **avisar** feriado não confirmado.
3. **`REGRAS.md` desatualizada para o PEDV:** diz que o PEDV não tem campo de horas e que não se deve usar `enviar_ao_google`. As duas coisas mudaram (tempo obrigatório no andamento; sync com o Google já testado). O plugin precisa de nova versão sem EasyJur/Trello.
4. **DJEN:** o cron do PEDV roda da Vercel sem bloqueio, mas o `ACESSOS.md` diz que a API é bloqueada na nuvem. Manter a coleta atual e tratar bloqueio (HTTP 403) como **falha registrada**, nunca como "sem publicação".
5. **Planilha Diária (#112):** a coleta por OAB, por processo e pelos recortes pagos continua sendo a fonte confiável; o assistente consome o que ela grava, em vez de refazer a coleta.
6. **IA:** a camada `lib/ai/service.ts` aceita Claude (`ANTHROPIC_API_KEY`) ou OpenAI; a OpenAI estava sem crédito (09/10). Preciso saber qual chave está configurada para estimar custo (item 7.4).
7. **Regras pessoais da Débora:** vão para `assistente_regras` com escopo de usuário (ex.: Irricom nunca recebe e-mail ao cliente; consignação vai ao Marcelo), **não** viram padrão global.

## 7. Análise de impacto: remover EasyJur e Trello (sem excluir nada ainda)

- **EasyJur:** só aparece nos **importadores** (`agenda-import`, `xlsx-import`, importar partes contrárias). Não há integração viva. Impacto: nenhum nas novas rotinas; os importadores ficam como estão.
- **Trello:** dependências reais a tratar **antes** de desligar:
  - `cron/trello` (09h) e `lib/trello/sync.ts` (arquiva cartões de origem `trello` que não estão mais abertos lá; **desligar o cron antes de esvaziar o quadro**);
  - `lib/inpi/trello-notify.ts` (cria cartões na planilha semanal) e `rpi-sync.ts`;
  - rota `iniciais/[id]/concluir`, `kanban/sincronizar`, importadores CSV, página `/integracoes/trello`, item de menu;
  - **colunas do Kanban**: `getListColumns` agrupa por `trello_list_id`/`trello_list_nome`; sem colunas nativas, remover o Trello quebra o quadro;
  - dados: 1.312 tarefas de origem `trello` (histórico), 16 mapeamentos de lista, 14 de membros, 64 logs.
- Recomendação: **congelar** (desligar o cron e esconder os atalhos), manter dados e tabelas por um período, e só então decidir o descarte. Fazer um backup completo do quadro do Trello antes de qualquer fechamento.

## 8. Plano incremental (cada fase com verificação e rollback)

| Fase | Entrega | Verificação | Rollback |
|---|---|---|---|
| 0 (esta) | Auditoria e plano | Sua aprovação | n/a |
| 1 | **Validação da contagem de prazo** com casos reais; testes automáticos dos casos | Resultados batem com os casos que você validar | Nada em produção |
| 2 | Migração aditiva: `assistente_sugestoes`, `assistente_execucoes`, `auditoria_eventos`, `assistente_regras(+versões)`; RLS e testes de autorização | Testes de papel e de idempotência; nenhuma tabela existente alterada | `DROP` das tabelas novas (vazias) |
| 3 | Menu "Assistente Jurídico": **Meu dia**, **Aprovações**, **Relatórios**, com dados reais só de leitura e dados fictícios nos testes | Cada usuário vê só o seu; sem escrita | Esconder o menu |
| 4 | **Registrar conclusão** e **Cadastrar processo** assistidos (prévia, desambiguação, confirmação), reutilizando a lógica do conector | Teste: nada duplica ao repetir; horas e andamento corretos | Desligar a rota; dados criados continuam marcados "via assistente" |
| 5 | **Publicações em modo sugestão** (consome `publicacoes` e a Planilha Diária); prazo só com aprovação do advogado | Zero prazo criado sem aprovação; reprocessar não duplica | Desligar a fila |
| 6 | **Atas por upload** (`atas_audiencia` + bucket), extração, tarefas e minuta; depois, conectores autorizados | Ata original guardada; estado `aguardando documento` | Desligar a rota |
| 7 | **Kanban nativo completo**: colunas e subtarefas; congelar o Trello (cron off), com backup | Quadro igual ao de hoje sem depender de `trello_*` | Religar o cron |
| 8 | Integrações opcionais (Outlook, WhatsApp, PJe com mecanismo autorizado) | Núcleo funciona sem elas | Desligar por configuração |

Testes em todas as fases: dados fictícios, sem e-mail, sem alteração externa e sem prazo real; fuso `America/Sao_Paulo`; concorrência e falha parcial (um sistema falha, os outros não são desfeitos).

## 9. Riscos

- **Prazo errado** (item 6.1): mitigado pela Fase 1 e pela aprovação humana obrigatória.
- **RLS legado aberto** (item 5): o módulo novo não depende dele; endurecer à parte.
- **Duplicidade com a Planilha Diária e o Google:** mitigada pela chave processo + data (#112) e pelo dedupe do `agenda-sync`.
- **Custo de IA:** por publicação/ata; estimar na Fase 5 com a chave real.
- **Desligar o Trello cedo demais:** quebra o Kanban e arquiva 1.312 cartões se o sync rodar com o quadro vazio.
- **Sigilo:** regras de "particular" e segredo de justiça precisam existir antes de qualquer relatório automático.

## 10. Custos de serviços (estimativa qualitativa)

Supabase Pro e Vercel já pagos. Novo custo apenas de **IA** (Claude ou OpenAI) por publicação/ata analisada e, se a coleta crescer, mais tempo de função na Vercel. Sem novos serviços de terceiros nas fases 1 a 7.

## 11. Decisões que preciso de você para seguir

1. **Organização:** manter um escritório só (sem `organization_id`) por ora? (recomendado)
2. **Prazos:** a Débora ou você me passam 5 a 8 casos reais (publicação, disponibilização, prazo certo) para validar a contagem.
3. **Particulares:** como marcar processos/clientes que nunca entram em relatório (flag no cadastro?).
4. **IA:** qual provedor/chave está ativa (Claude ou OpenAI)?
5. **Ordem:** começar pela Fase 1 (validação) e pela Fase 2 (migração aditiva)?
6. **PRs pendentes:** posso fechar o #55 (obsoleto) e mesclar #112/#113?
