# QA - Cobrancas Inter

Checklist manual para validar o modulo `Financeiro > Cobrancas` do PEDV em ambiente local e staging, com foco na primeira versao baseada em sincronizacao ativa.

## Premissas

- [ ] A migration do modulo foi aplicada no ambiente de teste.
- [ ] `INTER_WEBHOOK_ENABLED=false` enquanto o webhook estiver desativado nesta versao.
- [ ] As variaveis `INTER_CLIENT_ID`, `INTER_CLIENT_SECRET`, `INTER_BASE_URL`, `INTER_CERT_BASE64`, `INTER_KEY_BASE64`, `INTER_WEBHOOK_CA_BASE64` e `CRON_SECRET` estao configuradas no ambiente de teste.
- [ ] `INTER_WEBHOOK_SECRET` esta ausente ou configurada apenas como preparacao para o futuro proxy/gateway mTLS.
- [ ] Em staging, `INTER_BASE_URL` aponta para homologacao do Inter, nunca para producao.
- [ ] O ambiente usa mocks ou sandbox do Inter, sem credenciais reais.
- [ ] Existe pelo menos 1 cliente ativo.
- [ ] Existe pelo menos 1 processo ativo para testar vinculo cliente/processo.
- [ ] Nenhum dado de producao foi usado ou alterado.

## Local

### Cobranca unica

- [ ] Criar cobranca unica com cliente, valor, vencimento e descricao validos.
- [ ] Confirmar que a cobranca aparece com status inicial correto.
- [ ] Emitir boleto/Pix no Inter e verificar que o status local passa para `processando`.
- [ ] Confirmar que a cobranca so deixa de ser tratada como emitida depois da consulta ativa confirmar a geracao.
- [ ] Validar preenchimento de linha digitavel, codigo de barras, QR Code Pix, Pix copia e cola e PDF/link quando retornados.
- [ ] Tentar salvar sem cliente, sem valor ou sem vencimento e validar bloqueio.
- [ ] Tentar vincular processo de outro cliente e validar rejeicao.

### Cobranca recorrente

- [ ] Gerar cobrancas recorrentes com cliente, valor, vencimento inicial, quantidade de parcelas, dia de vencimento e descricao.
- [ ] Conferir se a quantidade de parcelas geradas confere com o solicitado.
- [ ] Validar se os vencimentos foram distribuidos mes a mes corretamente.
- [ ] Reexecutar a mesma geracao e confirmar bloqueio por duplicidade.

### Emissao e sincronizacao ativa

- [ ] Usar `Gerar boleto/Pix no Inter` em uma cobranca aberta.
- [ ] Confirmar que o sistema salva imediatamente `codigoSolicitacao`/identificador do Inter e marca a cobranca como `processando`.
- [ ] Confirmar que poucas tentativas de consulta nao bloqueiam a interface por tempo excessivo.
- [ ] Forcar resposta de "ainda processando" no mock e validar que a cobranca continua em `processando`.
- [ ] Reexecutar `Atualizar status no Inter` e confirmar que a consulta manual atualiza os campos do boleto/Pix quando o Inter confirmar a geracao.
- [ ] Validar que uma cobranca paga nao sofre rebaixamento de status durante a sincronizacao.

### Vencimento

- [ ] Criar cobranca com vencimento no passado.
- [ ] Confirmar que o sistema marca a cobranca como vencida quando apropriado.
- [ ] Confirmar que a cobranca vencida continua listada e auditavel.

### Cancelamento

- [ ] Cancelar uma cobranca ainda nao paga.
- [ ] Conferir que o status mudou para `cancelada`.
- [ ] Tentar cancelar uma cobranca paga e validar bloqueio.

### Exclusao fisica

- [ ] Confirmar que apenas `socio` ve o botao `Excluir cobrança` nos detalhes da cobranca.
- [ ] Excluir uma cobranca `rascunho`, `pendente`/em aberto ou `erro_emissao` sem identificadores do Inter.
- [ ] Confirmar que o modal exibe cliente, descricao, valor, vencimento e aviso de irreversibilidade.
- [ ] Confirmar que a exclusao exige digitar `EXCLUIR`.
- [ ] Informar um motivo opcional e confirmar que ele aparece em `cobranca_logs`.
- [ ] Conferir que a cobranca sai da lista imediatamente e que os indicadores sao recalculados.
- [ ] Tentar excluir cobrancas `processando`, `emitida`, `paga`, `vencida` e `cancelada`; todas devem ser bloqueadas.
- [ ] Tentar excluir cobranca com `inter_cobranca_id`, `nosso_numero`, linha digitavel, codigo de barras, Pix ou payload de emissao; o sistema deve orientar cancelamento em vez de exclusao.
- [ ] Conferir que `cobranca_logs.payload` preserva dados essenciais da cobranca antes do `ON DELETE SET NULL`.
- [ ] Repetir a mesma exclusao e validar resposta 404 ou comportamento idempotente adequado.

### Permissoes por perfil

- [ ] `administrativo` consegue ver, criar, emitir, sincronizar e cancelar cobrancas permitidas.
- [ ] `gerente` consegue ver, criar, emitir e sincronizar cobrancas permitidas.
- [ ] `socio` consegue ver, criar, emitir, sincronizar e excluir fisicamente somente cobrancas permitidas.
- [ ] `advogado` nao acessa o menu nem os endpoints do modulo.
- [ ] Usuario deslogado e conta inativa nao acessam o modulo.

### Webhook

- [ ] Confirmar que o endpoint de webhook responde desativado quando `INTER_WEBHOOK_ENABLED=false`.
- [ ] Confirmar que o endpoint nao exige `INTER_WEBHOOK_SECRET` enquanto estiver desativado.
- [ ] Validar rejeicao de payload acima de 256 KB apenas no fluxo de webhook futuramente habilitado.
- [ ] Registrar este bloco como pendente para a futura integracao por proxy/gateway com validacao mTLS.

## Staging

- [ ] Repetir os fluxos de cobranca unica e recorrente com homologacao do Inter.
- [ ] Validar emissao com sincronizacao ativa e confirmacao posterior dos campos boleto/Pix.
- [ ] Validar a acao manual `Atualizar status no Inter`.
- [ ] Validar o endpoint interno de lote com `Authorization: Bearer <CRON_SECRET>`.
- [ ] Confirmar que chamadas sem `CRON_SECRET` sao rejeitadas.
- [ ] Confirmar que execucoes concorrentes do lote sao bloqueadas.
- [ ] Confirmar que o lote respeita limite de quantidade por execucao.
- [ ] Revalidar cancelamento, exclusao, vencimento e permissao por perfil.
- [ ] Confirmar que nenhum dado de producao foi consultado ou alterado.

## Observacoes para a futura integracao por webhook

- [ ] O webhook permanece desativado nesta versao.
- [ ] A futura ativacao deve passar por proxy/gateway dedicado com terminacao mTLS.
- [ ] O PEDV deve receber apenas requisicoes ja validadas por esse proxy.
- [ ] A autenticacao interna entre proxy e PEDV deve usar assinatura HMAC ou mecanismo equivalente.
