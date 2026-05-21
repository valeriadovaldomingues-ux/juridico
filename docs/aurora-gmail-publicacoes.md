# Plano tecnico: Aurora + Gmail + Publicacoes

## 1. Objetivo

Permitir que a Aurora leia e-mails do Gmail, identifique publicacoes, intimacoes e comunicacoes processuais, e envie os itens selecionados para o modulo Publicacoes do sistema interno do Pessoa e do Val Advocacia.

A integracao deve operar sempre com revisao humana. A Aurora pode analisar, classificar, resumir e sugerir providencias, mas nao deve tratar publicacoes, criar prazos definitivos, enviar e-mails, arquivar mensagens ou executar qualquer acao sensivel sem confirmacao expressa de um socio.

## 2. Escopo da fase 1

- Implementar conexao OAuth Google.
- Usar escopo inicial `gmail.readonly`.
- Executar consultas Gmail exclusivamente no servidor.
- Permitir busca por:
  - remetente;
  - assunto;
  - palavra-chave;
  - periodo/data;
  - existencia de anexos.
- Exibir previa dos e-mails encontrados antes de qualquer importacao.
- Classificar e-mails como:
  - publicacao;
  - intimacao;
  - comunicacao processual;
  - movimentacao;
  - e-mail comum.
- Extrair dados principais de e-mails candidatos.
- Permitir importacao selecionada para `publicacoes`.
- Nao enviar e-mails.
- Nao criar rascunhos.
- Nao arquivar, excluir, marcar como lido ou alterar mensagens no Gmail.

## 3. Escopo futuro

- Solicitar escopo adicional `gmail.compose`.
- Permitir que a Aurora crie rascunhos no Gmail.
- Envio apenas com aprovacao humana expressa de um socio.
- Manter rastreabilidade de quem revisou, quem autorizou e quando.
- Nunca permitir envio automatico ou resposta externa autonoma.

## 4. Seguranca

- Acesso exclusivo para `role = "socio"`.
- Todas as rotas da integracao devem usar `apiGuard(['socio'])`.
- Qualquer tela futura deve usar `requireRole(['socio'])`.
- Usar OAuth 2.0; nunca salvar senha do Gmail.
- Criptografar `access_token` e `refresh_token` antes de gravar no banco.
- Nunca registrar `refresh_token` em logs.
- Nunca enviar ou expor `access_token` ao cliente.
- Gmail API deve ser chamada apenas em codigo server-side.
- Logs devem conter apenas metadados minimos:
  - usuario;
  - horario;
  - filtros resumidos/redigidos;
  - quantidade retornada;
  - quantidade importada;
  - status da operacao.
- Logs nao devem conter:
  - corpo integral do e-mail;
  - tokens;
  - anexos;
  - documentos pessoais;
  - informacoes sigilosas.
- Limitar resultados por consulta, inicialmente 10 a 20 e-mails.
- Truncar corpo textual antes de enviar ao contexto da IA.
- Baixar ou analisar anexos apenas por solicitacao expressa, com limite de tamanho, tipo e quantidade.
- Revalidar periodicamente conexoes inativas, revogadas ou com refresh falho.

## 5. Tabelas e migrations necessarias

Criar migration apenas apos validacao final do desenho. Tabelas provaveis:

### `google_connections`

Guarda a conexao OAuth por socio.

Campos sugeridos:

- `id`
- `user_id` referencia `profiles(id)`
- `provider` com valor `google`
- `google_email`
- `scopes`
- `access_token_encrypted`
- `refresh_token_encrypted`
- `token_expires_at`
- `status`
- `created_at`
- `updated_at`
- `revoked_at`

Regras:

- Uma conexao ativa por usuario e provedor, salvo decisao futura em contrario.
- Tokens sempre criptografados.
- RLS restritiva: apenas o proprio socio e operacoes server-side autorizadas.
- Service role pode ser necessario para renovacao server-side controlada.

### `google_gmail_query_logs`

Registra auditoria de consultas.

Campos sugeridos:

- `id`
- `user_id`
- `connection_id`
- `query_type`
- `query_redacted`
- `result_count`
- `selected_count`
- `imported_count`
- `has_attachments`
- `status`
- `error_code`
- `created_at`

Regras:

- Sem corpo de e-mail.
- Sem tokens.
- Sem conteudo de anexos.

### `gmail_import_candidates`

Opcional. Faz sentido se a revisao humana exigir fila persistente antes de gravar em `publicacoes`.

Campos sugeridos:

- `id`
- `user_id`
- `connection_id`
- `gmail_message_id`
- `gmail_thread_id`
- `subject`
- `from_email`
- `received_at`
- `snippet`
- `classification`
- `extracted_payload`
- `hash`
- `status`
- `created_at`
- `reviewed_by`
- `reviewed_at`

Uso recomendado:

- Criar candidatos apos consulta.
- Permitir revisao e selecao.
- Importar para `publicacoes` apenas itens aprovados.

Se a interface de revisao for imediata e simples, esta tabela pode ser adiada. Ainda assim, ela melhora auditoria e evita perda de contexto entre busca e importacao.

## 6. Rotas provaveis

### OAuth

- `GET /api/integracoes/google/oauth/start`
  - Inicia fluxo OAuth.
  - Exige `apiGuard(['socio'])`.
  - Gera `state` seguro.
  - Solicita escopo `gmail.readonly`.

- `GET /api/integracoes/google/oauth/callback`
  - Recebe `code` e `state`.
  - Valida `state`.
  - Troca `code` por tokens.
  - Criptografa tokens.
  - Grava em `google_connections`.

- `DELETE /api/integracoes/google/oauth/disconnect`
  - Revoga/desativa conexao.
  - Nao apaga logs.

### Aurora/Gmail

- `POST /api/ia/aurora/gmail/search`
  - Busca e-mails no Gmail.
  - Exige `apiGuard(['socio'])`.
  - Retorna previa sanitizada.
  - Nao importa automaticamente.

### Publicacoes

- `POST /api/publicacoes/importar-gmail`
  - Importa itens selecionados para `publicacoes`.
  - Exige `apiGuard(['socio'])`.
  - Recebe candidatos revisados/aprovados.
  - Aplica deduplicacao por hash.

Alternativa: integrar a busca diretamente em `POST /api/ia/aurora`, mas a separacao por rota facilita auditoria, testes e controle de superficie de seguranca.

## 7. Servicos provaveis

- `src/lib/google/oauth.ts`
  - Montagem de URL OAuth.
  - Validacao de `state`.
  - Troca de `code` por tokens.
  - Renovacao de access token.
  - Revogacao/desconexao.

- `src/lib/google/gmail.ts`
  - Cliente Gmail server-side.
  - `users.messages.list`.
  - `users.messages.get`.
  - Leitura segura de headers, snippet e corpo textual.
  - Leitura de metadados de anexos.

- `src/lib/ai/aurora-gmail-context.ts`
  - Detectar intencao de consultar Gmail.
  - Montar query Gmail.
  - Sanitizar e truncar e-mails.
  - Classificar candidatos.
  - Montar contexto para Aurora.

- `src/lib/publicacoes/importar-gmail.ts`
  - Converter candidato Gmail em payload de `publicacoes`.
  - Gerar hash.
  - Evitar duplicidade.
  - Rodar detectores de prazo/audiencia ja existentes.

## 8. Fluxo operacional

1. Socio acessa a area da Aurora.
2. Socio conecta Gmail por OAuth Google.
3. Sistema grava conexao com tokens criptografados.
4. Socio pergunta a Aurora sobre e-mails, publicacoes, intimacoes, prazos, anexos ou demandas.
5. Aurora detecta intencao de consultar e-mail.
6. API busca a conexao Google do socio autenticado.
7. API renova `access_token` se necessario.
8. API executa `users.messages.list` com query Gmail.
9. API busca detalhes minimos com `users.messages.get`.
10. Sistema monta contexto sanitizado.
11. Aurora classifica e-mails e mostra previa.
12. Usuario seleciona quais itens importar.
13. Sistema grava os itens aprovados em `publicacoes`.
14. Sistema usa hash para evitar duplicidade.
15. Publicacoes entram com `status = "nao_tratada"`.
16. Revisao humana segue no modulo Publicacoes.

## 9. Query Gmail

Mapeamento inicial:

- Remetente: `from:email@dominio.com`
- Assunto: `subject:(termo)`
- Palavra-chave: `termo`
- Data inicial: `after:YYYY/MM/DD`
- Data final: `before:YYYY/MM/DD`
- Anexos: `has:attachment`

Exemplo:

```txt
from:tribunal@exemplo.jus.br subject:(intimacao) after:2026/05/01 before:2026/05/22 has:attachment
```

## 10. Dados extraidos para `publicacoes`

Campos a preencher quando encontrados:

- `numero_processo`
- `tribunal`
- `orgao`
- `diario`
- `data_publicacao`
- `data_disponibilizacao`
- `nome_pesquisado`
- `texto_publicacao`
- `resumo`
- `tipo_publicacao`
- `prazo_detectado`
- `prazo_dias`
- `prazo_data`
- `prazo_descricao`
- `audiencia_detectada`
- `audiencia_data`
- `audiencia_descricao`
- `termo_encontrado`
- `origem = "gmail"`
- `hash`
- `status = "nao_tratada"`

Observacao: se o schema atual de `publicacoes` nao tiver algum campo listado, a implementation deve mapear apenas campos existentes ou propor migration especifica antes de alterar schema.

## 11. Regras de revisao

- Nao marcar publicacao como tratada automaticamente.
- Nao criar prazo fatal definitivo sem revisao humana.
- Nao enviar resposta automatica.
- Nao excluir e-mail.
- Nao arquivar e-mail na fase 1.
- Nao marcar e-mail como lido.
- Nao baixar anexo sem confirmacao expressa e limites definidos.
- Nao importar e-mails classificados como e-mail comum, salvo selecao manual expressa.
- Qualquer prazo/audiencia detectado deve ser apresentado como sugestao pendente de revisao.

## 12. Permissoes

- `socio` pode conectar Gmail.
- `socio` pode consultar Gmail pela Aurora.
- `socio` pode selecionar e importar candidatos para `publicacoes`.
- Demais perfis nao podem conectar Gmail da Aurora.
- Demais perfis nao podem consultar Gmail pela Aurora.
- Logs de auditoria devem ser vinculados ao `user_id`.
- A importacao deve registrar usuario que solicitou e, se houver fila de candidatos, usuario que revisou.

## 13. Testes futuros

Testes minimos:

- Socio inicia OAuth.
- Nao socio e bloqueado no OAuth.
- Callback rejeita `state` invalido.
- Tokens nao aparecem em logs.
- Refresh token e criptografado antes de gravar.
- Access token nunca retorna para o cliente.
- Query Gmail e montada corretamente.
- Busca por remetente monta `from:`.
- Busca por assunto monta `subject:`.
- Busca por data monta `after:` e `before:`.
- Busca por anexo monta `has:attachment`.
- E-mail de publicacao vira candidato.
- E-mail comum nao vira publicacao automaticamente.
- Corpo do e-mail e truncado.
- Anexos nao sao baixados sem confirmacao.
- Duplicidade por hash e evitada.
- Importacao grava `origem = "gmail"`.
- Importacao grava `status = "nao_tratada"`.
- API de importacao bloqueia nao socio.
- Build passa.
- Testes passam.

## 14. Riscos

- Escopos Gmail sao sensiveis e podem exigir verificacao do app Google.
- Refresh token pode expirar, ser revogado ou nao ser retornado em reconexoes sem `prompt=consent`.
- E-mails podem conter dados sensiveis, segredos profissionais, documentos pessoais e informacoes de terceiros.
- Anexos podem ser grandes, escaneados, protegidos por senha ou conter malware.
- Classificacao por IA pode errar; por isso revisao humana e obrigatoria.
- Importacao duplicada pode ocorrer se hash for mal definido.
- Logs podem vazar conteudo se nao forem rigidamente redigidos.
- Multi-conta Gmail por socio pode aumentar complexidade; fase 1 deve limitar a uma conexao ativa por socio.

## 15. Plano de implementacao em fases

### Fase 0: desenho e migracao

1. Confirmar campos existentes de `publicacoes`.
2. Criar migration para `google_connections`.
3. Criar migration para `google_gmail_query_logs`.
4. Decidir se `gmail_import_candidates` entra na fase 1 ou fica para fase 1.1.

### Fase 1: OAuth readonly

1. Criar `src/lib/google/oauth.ts`.
2. Criar rotas OAuth start/callback/disconnect.
3. Proteger todas as rotas com `apiGuard(['socio'])`.
4. Criptografar tokens.
5. Testar conexao e renovacao.

### Fase 2: consulta Gmail

1. Criar `src/lib/google/gmail.ts`.
2. Implementar `users.messages.list`.
3. Implementar `users.messages.get`.
4. Retornar previa sanitizada.
5. Registrar logs sem conteudo sensivel.

### Fase 3: Aurora + contexto Gmail

1. Criar `src/lib/ai/aurora-gmail-context.ts`.
2. Detectar intencao de e-mail.
3. Montar contexto sanitizado.
4. Ajustar prompt da Aurora para separar fatos do Gmail de inferencias.
5. Garantir que buscas genericas da Aurora nao consultem Gmail sem intencao clara.

### Fase 4: importacao para Publicacoes

1. Criar `src/lib/publicacoes/importar-gmail.ts`.
2. Criar `POST /api/publicacoes/importar-gmail`.
3. Exigir selecao/revisao humana.
4. Gerar hash.
5. Gravar em `publicacoes` com `origem = "gmail"` e `status = "nao_tratada"`.

### Fase 5: compose futuro

1. Solicitar `gmail.compose`.
2. Permitir criar rascunhos.
3. Exigir confirmacao expressa antes de criar rascunho.
4. Nunca enviar automaticamente.

## 16. Diagnostico final

A integracao e tecnicamente viavel e deve ser implementada como extensao server-side da Aurora, mantendo acesso exclusivo para socios. O ponto critico e seguranca de tokens e auditoria. Antes de qualquer codigo funcional, e necessario criar schema proprio para conexoes Google e logs, com criptografia e RLS restritiva.

O caminho mais seguro e iniciar com `gmail.readonly`, sem anexos completos e sem envio. A importacao para `publicacoes` deve ser sempre selecionada e revisada pelo socio, com deduplicacao por hash e status inicial `nao_tratada`.

## 17. Arquitetura proposta

- OAuth Google isolado em rotas de integracao.
- Tokens armazenados criptografados em `google_connections`.
- Consultas Gmail server-side via `src/lib/google/gmail.ts`.
- Contexto da Aurora montado por helper especifico, sem expor tokens ou corpo integral.
- Importacao para `publicacoes` por servico dedicado, com hash e revisao humana.
- Logs de auditoria sem conteudo sensivel.

## 18. Migrations necessarias

Necessarias:

- `google_connections`
- `google_gmail_query_logs`

Possivelmente necessaria:

- `gmail_import_candidates`

Possivel ajuste futuro:

- garantir que `publicacoes.origem` aceite `gmail`, caso exista constraint restritiva.

## 19. Criterio de pronto da fase 1

- Socio conecta Gmail com OAuth.
- Socio consulta e-mails pela Aurora.
- Nao socio e bloqueado.
- Tokens ficam criptografados.
- Logs nao vazam conteudo sensivel.
- Aurora mostra previa e classificacao.
- Importacao selecionada grava em `publicacoes`.
- Nenhum e-mail e enviado, arquivado, excluido ou marcado como lido.
- Build e testes passam.
