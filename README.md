# Sistema Jurídico PEDV

Sistema completo de gestão para escritórios de advocacia, desenvolvido com Next.js, TypeScript e Supabase.

## Funcionalidades

### Módulos Principais
- **Dashboard** - Visão geral com KPIs e métricas
- **Kanban Jurídico** - Gestão de tarefas com drag & drop
- **Agenda** - Calendário de compromissos e prazos
- **CRM de Clientes** - Gestão completa de clientes
- **Processos** - Acompanhamento de processos judiciais
- **Publicações** - Monitoramento de publicações oficiais
- **Documentos** - Geração automática de documentos
- **Financeiro** - Controle financeiro (restrito a sócios/gerentes)
- **IA Jurídica** - Assistente com OpenAI para análises jurídicas
- **Relatórios** - Relatórios personalizados por cliente
- **Comercial** - Gestão de leads e propostas
- **Automações** - Tarefas automatizadas
- **Integrações** - Importação do Trello e outras ferramentas

### Recursos Avançados
- Sistema de permissões por função (role-based access)
- Importação de CSV do Trello
- Interface profissional e responsiva
- Autenticação segura com Supabase
- API REST completa
- Modo TV para apresentações

## Tecnologias

- **Framework:** Next.js (App Router + React 19)
- **Linguagem:** TypeScript
- **Banco de Dados:** Supabase (PostgreSQL)
- **Autenticação:** Supabase Auth
- **Estilização:** Tailwind CSS
- **Drag & Drop:** DnD Kit
- **IA:** OpenAI API
- **Ícones:** Lucide React

## Instalação

### Pré-requisitos
- Node.js 20 ou superior
- npm ou yarn
- Conta no Supabase
- (Opcional) Conta OpenAI para IA Jurídica

### Passo a Passo

1. **Clone o repositório**
```bash
git clone https://github.com/valeriadovaldomingues-ux/juridico.git
cd juridico
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**

Crie o arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENAI_API_KEY=sk-sua-chave-openai (opcional)
OPENAI_MODEL=gpt-4o-mini
CRON_SECRET=seu-segredo-aleatorio
```

4. **Configure o banco de dados**

No Supabase Dashboard → SQL Editor, execute os arquivos da pasta `/supabase/`:
- Comece por `schema.sql`
- Depois `auth_setup.sql`
- Execute os demais conforme necessário

5. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

6. **Acesse o sistema**
```
http://localhost:3000
```

## Configuração do Supabase

### Site URL e Redirect URLs

No Supabase → Authentication → URL Configuration:

| Campo | Valor |
|-------|-------|
| Site URL | `http://localhost:3000` (dev) ou `https://seu-dominio.com.br` (prod) |
| Redirect URLs | `http://localhost:3000/**` |
| Redirect URLs | `http://localhost:3000/auth/callback` |

### Migrations

Execute todos os arquivos `.sql` da pasta `supabase/` no SQL Editor do Supabase.

## Deploy

Veja instruções detalhadas em [`DEPLOY.md`](./DEPLOY.md)

**Opções de deploy:**
- Vercel (recomendado - mais simples)
- VPS próprio (mais controle)

## Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Iniciar produção
npm start

# Verificar TypeScript
npm run type-check

# Lint
npm run lint

# Verificar erros de tipos e lint
npm run check
```

## Permissões e Funções

O sistema possui 4 níveis de acesso:

- **Sócio** - Acesso total, incluindo financeiro
- **Gerente** - Acesso total, incluindo financeiro
- **Advogado** - Acesso completo exceto financeiro
- **Estagiário** - Acesso básico de leitura

## Resolução de Problemas

### Build falha
```bash
npm run type-check
```

### Login não funciona
- Verifique se o Site URL está correto no Supabase
- Confirme se as variáveis SUPABASE estão corretas no .env.local

### Sessão expira rapidamente
- Verifique se o `proxy.ts` está sendo usado (deve aparecer no build)

### API não autoriza
- Verifique se SUPABASE_SERVICE_ROLE_KEY está correta
- Confirme que não tem prefixo NEXT_PUBLIC_ nessa variável

## Licença

Propriedade de Pessoal do Val - Todos os direitos reservados.

## Suporte

Para dúvidas ou problemas, entre em contato com a equipe de desenvolvimento.
