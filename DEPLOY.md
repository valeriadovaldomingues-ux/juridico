# Deploy em Produção — Sistema Jurídico PEDV

## 0. Pré-requisitos

- Build limpo: `npm run build` (deve passar sem erros)
- TypeScript limpo: `npm run type-check` (deve passar sem erros)
- Todas as variáveis de ambiente configuradas (ver `.env.example`)

---

## 1. Configuração do Supabase (obrigatório ANTES do deploy)

### 1.1 Site URL e Redirect URLs

No Supabase Dashboard → Authentication → URL Configuration:

| Campo | Valor |
|-------|-------|
| **Site URL** | `https://app.seuescritorio.com.br` |
| **Redirect URLs** | `https://app.seuescritorio.com.br/**` |
| **Redirect URLs** | `https://app.seuescritorio.com.br/auth/callback` |

> Durante desenvolvimento, adicione também: `http://localhost:3000/**`

### 1.2 Migrations

Execute todas as migrations do diretório `supabase/` no Supabase Dashboard → SQL Editor:

```
supabase/kanban_import_logs.sql         ← CSV import logs
supabase/clientes_campos_relatorio.sql  ← campos de busca por cliente
```

Execute na ordem se ainda não tiver rodado.

### 1.3 Email Templates (opcional mas recomendado)

No Supabase → Authentication → Email Templates, personalize:
- **Confirm signup**: adicione o nome do escritório
- **Reset password**: altere o link para `{{ .SiteURL }}/reset-password`

### 1.4 Auth Providers

Se usar login por e-mail/senha apenas (padrão):
- Nenhuma configuração adicional necessária

Se quiser adicionar Google OAuth futuramente:
- Supabase → Authentication → Providers → Google

---

## 2. OPÇÃO A — Deploy na Vercel (RECOMENDADO)

### Por que Vercel?
- Deploy automático a cada push no GitHub
- SSL/HTTPS automático
- CDN global (melhor performance)
- Zero configuração de servidor
- Escala automaticamente
- Gratuito até certos limites

### Passo a passo

#### 2.1 Preparar o GitHub

```bash
# No projeto local:
git init
git add .
git commit -m "feat: sistema jurídico PEDV - versão produção"

# Criar repositório no GitHub (github.com → New repository)
git remote add origin https://github.com/SEU_USUARIO/juridico.git
git push -u origin main
```

> IMPORTANTE: certifique-se de que `.env.local` está no `.gitignore` (já está).

#### 2.2 Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com) → Login com GitHub
2. **"New Project"** → importar o repositório `juridico`
3. **Framework Preset**: Next.js (detectado automaticamente)
4. **Root Directory**: `.` (raiz do projeto)

#### 2.3 Variáveis de ambiente na Vercel

Em **Settings → Environment Variables**, adicione:

| Nome | Valor | Environments |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Production, Preview, Development |
| `OPENAI_API_KEY` | `sk-...` | Production, Preview |
| `OPENAI_MODEL` | `gpt-4o-mini` | Production, Preview |
| `CRON_SECRET` | `(gere com: openssl rand -hex 32)` | Production |
| `NEXT_PUBLIC_APP_URL` | `https://app.seuescritorio.com.br` | Production |

#### 2.4 Domínio personalizado

1. Vercel → Settings → Domains
2. Adicionar `app.seuescritorio.com.br`
3. Apontar no DNS do domínio:
   ```
   Tipo: CNAME
   Nome: app
   Valor: cname.vercel-dns.com
   ```
4. Aguardar propagação (até 24h) — SSL é automático

#### 2.5 Verificar o deploy

- Acesse `https://app.seuescritorio.com.br/login`
- Teste login com usuário existente
- Verifique cada módulo principal

---

## 3. OPÇÃO B — Deploy na Hostinger VPS

### Por que VPS?
- Controle total do servidor
- Pode rodar múltiplos sistemas no mesmo servidor
- Custo previsível (sem cobrança por request)
- Melhor para dados sensíveis (tudo dentro do seu servidor)

### Requisitos mínimos
- Ubuntu 22.04 LTS
- 2 vCPU, 4 GB RAM (plano Business da Hostinger)
- Domínio apontado para o IP do servidor

### Passo a passo

#### 3.1 Acesso ao servidor

```bash
# Conectar via SSH
ssh root@SEU_IP_VPS

# Criar usuário não-root (segurança)
adduser deploy
usermod -aG sudo deploy
su - deploy
```

#### 3.2 Instalar dependências

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 (gerenciador de processos)
sudo npm install -g pm2

# Nginx (proxy reverso)
sudo apt-get install -y nginx

# Certbot (SSL/HTTPS gratuito)
sudo apt-get install -y certbot python3-certbot-nginx

# Git
sudo apt-get install -y git
```

#### 3.3 Clonar e configurar o projeto

```bash
# Criar diretório
sudo mkdir -p /var/www/juridico
sudo chown deploy:deploy /var/www/juridico
cd /var/www/juridico

# Clonar do GitHub
git clone https://github.com/SEU_USUARIO/juridico.git .

# Instalar dependências
npm ci --production=false

# Criar variáveis de ambiente
nano .env.local
```

Conteúdo do `.env.local` no servidor:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
CRON_SECRET=SEU_SEGREDO_AQUI
NEXT_PUBLIC_APP_URL=https://app.seuescritorio.com.br
NODE_ENV=production
```

#### 3.4 Build e start

```bash
# Build de produção
npm run build

# Testar localmente (opcional)
npm run start &
curl http://localhost:3000/login
kill %1
```

#### 3.5 PM2 — persistência e reinício automático

```bash
# Iniciar com PM2
pm2 start npm --name "juridico" -- start

# Salvar configuração (reinicia após reboot)
pm2 save
pm2 startup

# Verificar status
pm2 status
pm2 logs juridico
```

#### 3.6 Nginx — proxy reverso

```bash
sudo nano /etc/nginx/sites-available/juridico
```

Conteúdo:
```nginx
server {
    listen 80;
    server_name app.seuescritorio.com.br;

    # Segurança
    server_tokens off;

    # Upload máximo (para importação de CSVs grandes)
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/juridico /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 3.7 SSL com Let's Encrypt (gratuito)

```bash
# Obter certificado (substitua pelo seu domínio e e-mail)
sudo certbot --nginx -d app.seuescritorio.com.br --email seu@email.com --agree-tos --no-eff-email

# Verificar renovação automática
sudo certbot renew --dry-run
```

#### 3.8 Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

#### 3.9 DNS — apontar domínio

No painel do seu registrador de domínio:
```
Tipo: A
Nome: app
Valor: SEU_IP_VPS
TTL: 3600
```

#### 3.10 Script de atualização (deploy contínuo)

Crie `/var/www/juridico/update.sh`:
```bash
#!/bin/bash
cd /var/www/juridico
git pull origin main
npm ci --production=false
npm run build
pm2 restart juridico
echo "Deploy concluído: $(date)"
```

```bash
chmod +x update.sh
# Para atualizar: ./update.sh
```

---

## 4. Cron Job (monitoramento automático de publicações)

Se quiser que o monitoramento rode automaticamente:

### Na Vercel
Use [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) em `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/monitoramento/buscar",
      "schedule": "0 8 * * 1-5"
    }
  ]
}
```

Configure o header via [Vercel Cron Secret](https://vercel.com/docs/cron-jobs/manage-cron-jobs):
- A Vercel envia automaticamente `Authorization: Bearer <CRON_SECRET>`

### No VPS
```bash
# Editar crontab
crontab -e

# Executar às 8h nos dias úteis
0 8 * * 1-5 curl -s -X POST \
  -H "Authorization: Bearer SEU_CRON_SECRET" \
  -H "Content-Type: application/json" \
  https://app.seuescritorio.com.br/api/monitoramento/buscar \
  >> /var/log/juridico-cron.log 2>&1
```

---

## 5. Checklist final antes de ir ao ar

### Supabase
- [ ] Site URL configurado com o domínio de produção
- [ ] Redirect URLs configurados
- [ ] Migrations executadas (`kanban_import_logs.sql`, `clientes_campos_relatorio.sql`)
- [ ] Service Role Key está apenas no backend (NUNCA prefixada com NEXT_PUBLIC_)

### Código
- [ ] `npm run build` passa sem erros
- [ ] `npm run type-check` passa sem erros
- [ ] Nenhum `NEXT_PUBLIC_CRON_SECRET` no código (removido ✓)
- [ ] `.env.local` NÃO está no Git
- [ ] `.env.example` está no Git como referência

### Variáveis de ambiente
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurada
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurada
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada (apenas backend)
- [ ] `OPENAI_API_KEY` configurada (se usar IA)
- [ ] `CRON_SECRET` configurada com valor aleatório longo
- [ ] `NEXT_PUBLIC_APP_URL` configurada com URL de produção

### Funcionalidades (teste após deploy)
- [ ] Login funciona
- [ ] Sessão persiste após fechar e reabrir o browser
- [ ] Reset de senha envia e-mail com link correto
- [ ] Upload/importação de CSV funciona
- [ ] Kanban carrega e drag-and-drop funciona
- [ ] Relatórios carregam
- [ ] IA Jurídica responde (se OPENAI_API_KEY configurada)
- [ ] Módulo financeiro visível apenas para sócio/gerente

### Segurança
- [ ] HTTPS ativo (cadeado verde no browser)
- [ ] Headers de segurança presentes (teste em: securityheaders.com)
- [ ] Rota `/financeiro` redireciona não-sócios para /dashboard

---

## 6. Recomendação

**Use a Vercel** se o objetivo é simplicidade e confiabilidade.  
**Use o VPS** se precisar de controle total, rodar outros sistemas, ou tiver requisitos de compliance de dados.

Para um escritório de advocacia em produção inicial, **Vercel é a escolha certa**: deploy automático, SSL, CDN global, zero manutenção de servidor.

---

## 7. Suporte

Em caso de problemas:
- Build falha: `npm run type-check` para identificar erros TypeScript
- Login quebrado: verificar Site URL no Supabase Authentication
- Sessão expira: verificar se `proxy.ts` está sendo usado (build mostra `ƒ Proxy (Middleware)`)
- API não autoriza: verificar `SUPABASE_SERVICE_ROLE_KEY` nas variáveis de ambiente
