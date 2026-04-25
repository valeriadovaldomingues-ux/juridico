-- =============================================
-- PEDV — Schema do banco de dados
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- Profiles (extensão do auth.users do Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'advogado' CHECK (role IN ('admin', 'advogado', 'secretaria')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para criar profile automaticamente ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_pessoa TEXT NOT NULL DEFAULT 'fisica' CHECK (tipo_pessoa IN ('fisica', 'juridica')),
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  email TEXT,
  telefone TEXT,
  celular TEXT,
  cep TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Processos
CREATE TABLE IF NOT EXISTS public.processos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_processo TEXT,
  titulo TEXT NOT NULL,
  area_direito TEXT NOT NULL CHECK (area_direito IN ('civil','trabalhista','criminal','tributario','previdenciario','administrativo','familia','empresarial','outro')),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','suspenso','arquivado','encerrado')),
  fase TEXT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  advogado_responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tribunal TEXT,
  vara TEXT,
  valor_causa NUMERIC(15, 2),
  data_distribuicao DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partes do processo
CREATE TABLE IF NOT EXISTS public.partes_processo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  pessoa_nome TEXT NOT NULL,
  tipo_parte TEXT NOT NULL CHECK (tipo_parte IN ('autor','reu','terceiro','outro')),
  documento TEXT,
  observacoes TEXT
);

-- Prazos / Agenda
CREATE TABLE IF NOT EXISTS public.prazos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'outro' CHECK (tipo IN ('audiencia','prazo_processual','reuniao','diligencia','outro')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_inicio DATE,
  data_final DATE NOT NULL,
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta','urgente')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluido','cancelado')),
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Financeiro
CREATE TABLE IF NOT EXISTS public.financeiro_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  categoria TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(15, 2) NOT NULL,
  vencimento DATE NOT NULL,
  pagamento_em DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','vencido','cancelado')),
  centro_custo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documentos
CREATE TABLE IF NOT EXISTS public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  nome_arquivo TEXT NOT NULL,
  tipo_documento TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partes_processo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prazos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários autenticados têm acesso total
CREATE POLICY "Authenticated full access" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.processos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.partes_processo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.prazos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.financeiro_lancamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- Índices para performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_processos_cliente ON public.processos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_processos_status ON public.processos(status);
CREATE INDEX IF NOT EXISTS idx_prazos_processo ON public.prazos(processo_id);
CREATE INDEX IF NOT EXISTS idx_prazos_data_final ON public.prazos(data_final);
CREATE INDEX IF NOT EXISTS idx_prazos_status ON public.prazos(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_cliente ON public.financeiro_lancamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_vencimento ON public.financeiro_lancamentos(vencimento);
CREATE INDEX IF NOT EXISTS idx_financeiro_status ON public.financeiro_lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON public.clientes(nome);
