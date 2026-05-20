export interface ModeloPeticao {
  id: string
  grupo: string
  nomeExibido: string
  nomeAcao: string
  enderecamentoPadrao: string
  topicosBase: string[]
  pedidosSugeridos: string[]
}

interface ModeloPeticaoFonte {
  nome: string
  enderecamento: string
}

interface GrupoPeticaoFonte {
  grupo: string
  modelos: ModeloPeticaoFonte[]
}

const GRUPOS_EXTRAIDOS_LOVABLE: GrupoPeticaoFonte[] = [
  {
    "grupo": "Cível — Conhecimento (ações)",
    "modelos": [
      {
        "nome": "Ação de Cobrança",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Monitória",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Indenização por Danos Morais",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Indenização por Danos Materiais",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Indenização por Danos Morais e Materiais",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Indenização por Danos Estéticos",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Declaratória de Inexistência de Débito",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Declaratória de Existência/Inexistência de Relação Jurídica",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Obrigação de Fazer",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Obrigação de Não Fazer",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Obrigação de Dar Coisa Certa",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Consignação em Pagamento",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Prestação de Contas / Exigir Contas",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Revisional de Contrato",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Rescisão Contratual c/c Perdas e Danos",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Resolução Contratual c/c Reintegração",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Anulatória de Negócio Jurídico",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Nulidade de Ato Jurídico",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Pauliana (Fraude contra Credores)",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Adjudicação Compulsória",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Outorga de Escritura",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Reintegração de Posse",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Manutenção de Posse",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Interdito Proibitório",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Reivindicatória",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Imissão na Posse",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Usucapião Extraordinária",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Usucapião Ordinária",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Usucapião Especial Urbana",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Usucapião Especial Rural",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Usucapião Familiar",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Usucapião Extrajudicial",
        "enderecamento": "Exmo. Sr. Oficial do Registro de Imóveis da ___ Circunscrição de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Despejo por Falta de Pagamento",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Despejo por Denúncia Vazia",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Renovatória de Locação",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Revisional de Aluguel",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Exigir Caução",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Divisão e Demarcação de Terras",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Nunciação de Obra Nova",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Demolitória",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Dano Infecto",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Possessória de Direito Autoral / Propriedade Intelectual",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Alimentos Civis (entre parentes maiores)",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Civil Pública",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Popular",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara da Fazenda Pública da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Improbidade Administrativa",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara da Fazenda Pública da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Responsabilidade Civil do Estado",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara da Fazenda Pública da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Despejo c/c Cobrança",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Retomada do Imóvel",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Pauliana",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Sonegados",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Sucessões da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Petição de Herança",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Sucessões da Comarca de Belo Horizonte/MG"
      }
    ]
  },
  {
    "grupo": "Cível — Procedimentos Especiais",
    "modelos": [
      {
        "nome": "Embargos Monitórios",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Depósito",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Exigir Contas",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Habilitação Incidental",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Restauração de Autos",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Dissolução Parcial de Sociedade",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Empresarial da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Embargos de Terceiro",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Oposição",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Notificação Judicial",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Interpelação Judicial",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Protesto Judicial",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Justificação Judicial",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Homologação de Acordo Extrajudicial",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Homologação de Penhor Legal",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Alienação Judicial de Bens",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      }
    ]
  },
  {
    "grupo": "Cível — Execução e Cumprimento",
    "modelos": [
      {
        "nome": "Execução de Título Extrajudicial",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Execução por Quantia Certa",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Execução de Obrigação de Fazer",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Execução de Obrigação de Não Fazer",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Execução de Entrega de Coisa",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Execução de Alimentos (rito prisão)",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Execução de Alimentos (rito expropriação)",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Cumprimento de Sentença que reconhece obrigação de pagar quantia certa",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Cumprimento de Sentença de Alimentos",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Cumprimento Provisório de Sentença",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Cumprimento de Sentença contra a Fazenda Pública",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara da Fazenda Pública da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Embargos à Execução",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Embargos à Adjudicação / Arrematação",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Impugnação ao Cumprimento de Sentença",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Exceção de Pré-Executividade",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Pedido de Penhora / Bloqueio (SISBAJUD/RENAJUD)",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Pedido de Desconsideração da Personalidade Jurídica",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      }
    ]
  },
  {
    "grupo": "Cível — Cautelares e Tutelas",
    "modelos": [
      {
        "nome": "Tutela Cautelar Antecedente",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Tutela Antecipada Antecedente",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Tutela de Urgência Incidental",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Tutela de Evidência",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Arresto",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Sequestro",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Busca e Apreensão (Cível)",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Busca e Apreensão (Alienação Fiduciária - DL 911)",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Arrolamento de Bens",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Produção Antecipada de Provas",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Exibição de Documento ou Coisa",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Caução",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      }
    ]
  },
  {
    "grupo": "Cível — Defesas e Manifestações",
    "modelos": [
      {
        "nome": "Contestação",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Reconvenção",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Réplica / Impugnação à Contestação",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Impugnação ao Valor da Causa",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Impugnação à Justiça Gratuita",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Impugnação à Assistência Judiciária",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Impugnação aos Cálculos",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Impugnação à Penhora",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Impugnação aos Embargos de Declaração",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Exceção de Incompetência",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Exceção de Suspeição",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Exceção de Impedimento",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Incidente de Falsidade Documental",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Incidente de Desconsideração da Personalidade Jurídica",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Incidente de Resolução de Demandas Repetitivas (IRDR)",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Assistência Simples / Litisconsorcial",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Denunciação da Lide",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Chamamento ao Processo",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Nomeação à Autoria",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Alegações Finais / Memoriais",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Razões Finais",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Petição de Especificação de Provas",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Petição de Quesitos para Perícia",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Petição de Assistente Técnico",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Petição de Manifestação sobre Laudo Pericial",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Petição Comum / Manifestação",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Petição de Juntada de Documentos",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Petição de Desistência da Ação",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Petição de Renúncia ao Direito",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Petição de Acordo / Transação",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      }
    ]
  },
  {
    "grupo": "Cível — Recursos",
    "modelos": [
      {
        "nome": "Apelação",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Contrarrazões de Apelação",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Agravo de Instrumento",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Contrarrazões de Agravo de Instrumento",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Agravo Interno",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Agravo em Recurso Especial",
        "enderecamento": "Exmo. Sr. Desembargador Presidente do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Agravo em Recurso Extraordinário",
        "enderecamento": "Exmo. Sr. Desembargador Presidente do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Embargos de Declaração",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Embargos de Declaração (2º grau)",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Embargos Infringentes de Nulidade",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Embargos de Divergência",
        "enderecamento": "Exmo. Sr. Ministro Relator do Superior Tribunal de Justiça"
      },
      {
        "nome": "Recurso Especial",
        "enderecamento": "Exmo. Sr. Desembargador Presidente do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Contrarrazões de Recurso Especial",
        "enderecamento": "Exmo. Sr. Desembargador Presidente do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Recurso Extraordinário",
        "enderecamento": "Exmo. Sr. Desembargador Presidente do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Contrarrazões de Recurso Extraordinário",
        "enderecamento": "Exmo. Sr. Desembargador Presidente do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Recurso Ordinário Constitucional",
        "enderecamento": "Exmo. Sr. Ministro Relator do Supremo Tribunal Federal"
      },
      {
        "nome": "Recurso Adesivo",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Reclamação Constitucional",
        "enderecamento": "Exmo. Sr. Ministro Relator do Supremo Tribunal Federal"
      },
      {
        "nome": "Ação Rescisória",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Mandado de Segurança contra Ato Judicial",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Habeas Data",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Suspensão de Segurança / Liminar",
        "enderecamento": "Exmo. Sr. Desembargador Presidente do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Pedido de Uniformização de Jurisprudência",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Querela Nullitatis",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      }
    ]
  },
  {
    "grupo": "Juizado Especial Cível",
    "modelos": [
      {
        "nome": "Petição Inicial (JEC)",
        "enderecamento": "Exmo. Sr. Juiz de Direito do Juizado Especial Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Contestação (JEC)",
        "enderecamento": "Exmo. Sr. Juiz de Direito do Juizado Especial Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Recurso Inominado",
        "enderecamento": "Exma. Turma Recursal dos Juizados Especiais de Belo Horizonte/MG"
      },
      {
        "nome": "Contrarrazões de Recurso Inominado",
        "enderecamento": "Exmo. Sr. Juiz de Direito do Juizado Especial Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Embargos de Declaração (JEC)",
        "enderecamento": "Exmo. Sr. Juiz de Direito do Juizado Especial Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Mandado de Segurança contra ato de Juiz do JEC",
        "enderecamento": "Exma. Turma Recursal dos Juizados Especiais de Belo Horizonte/MG"
      }
    ]
  },
  {
    "grupo": "Família e Sucessões",
    "modelos": [
      {
        "nome": "Divórcio Consensual",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Divórcio Litigioso",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Alimentos",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Revisional de Alimentos",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Exoneração de Alimentos",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Reconhecimento e Dissolução de União Estável",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Guarda",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Regulamentação de Visitas",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Alteração de Guarda",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Investigação de Paternidade",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Negatória de Paternidade",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Adoção",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Interdição / Curatela",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Tomada de Decisão Apoiada",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Família da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Inventário e Partilha",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Sucessões da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Arrolamento Sumário",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Sucessões da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Sobrepartilha",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Sucessões da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Cumprimento de Testamento / Codicilo",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Sucessões da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Petição de Herança",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Sucessões da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Remoção de Inventariante",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Sucessões da Comarca de Belo Horizonte/MG"
      }
    ]
  },
  {
    "grupo": "Consumidor",
    "modelos": [
      {
        "nome": "Ação de Repetição de Indébito (CDC)",
        "enderecamento": "Exmo. Sr. Juiz de Direito do Juizado Especial Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Indenizatória por Vício do Produto",
        "enderecamento": "Exmo. Sr. Juiz de Direito do Juizado Especial Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Indenizatória por Fato do Produto",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Indenizatória por Falha na Prestação de Serviços",
        "enderecamento": "Exmo. Sr. Juiz de Direito do Juizado Especial Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Declaratória de Inexigibilidade de Débito c/c Indenização",
        "enderecamento": "Exmo. Sr. Juiz de Direito do Juizado Especial Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Cancelamento de Inscrição em SPC/Serasa",
        "enderecamento": "Exmo. Sr. Juiz de Direito do Juizado Especial Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Revisão Contratual Bancária",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Exibição de Documentos (CDC)",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      }
    ]
  },
  {
    "grupo": "Empresarial e Recuperacional",
    "modelos": [
      {
        "nome": "Pedido de Recuperação Judicial",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Empresarial da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Plano de Recuperação Judicial",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Empresarial da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Habilitação de Crédito",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Empresarial da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Impugnação de Crédito",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Empresarial da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Pedido de Falência",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Empresarial da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Pedido de Restituição em Falência",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Empresarial da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Dissolução Parcial de Sociedade",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Empresarial da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Dissolução Total de Sociedade",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Empresarial da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Exclusão de Sócio",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Empresarial da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Apuração de Haveres",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Empresarial da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Recuperação Extrajudicial - Homologação",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Empresarial da Comarca de Belo Horizonte/MG"
      }
    ]
  },
  {
    "grupo": "Tributário e Administrativo",
    "modelos": [
      {
        "nome": "Mandado de Segurança",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara da Fazenda Pública da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Mandado de Segurança Coletivo",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara da Fazenda Pública da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Anulatória de Débito Fiscal",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Execuções Fiscais da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Declaratória de Inexistência de Relação Tributária",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara da Fazenda Pública da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Embargos à Execução Fiscal",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Execuções Fiscais da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Exceção de Pré-Executividade (Fiscal)",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara de Execuções Fiscais da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Repetição de Indébito Tributário",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara da Fazenda Pública da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Consignação em Pagamento Tributário",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara da Fazenda Pública da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Compensação Tributária",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara da Fazenda Pública da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Recurso Administrativo",
        "enderecamento": "Ilmo. Sr. Presidente do ___ (órgão administrativo)"
      },
      {
        "nome": "Defesa Administrativa",
        "enderecamento": "Ilmo. Sr. Presidente do ___ (órgão administrativo)"
      }
    ]
  },
  {
    "grupo": "Trabalhista — Empregado (autor)",
    "modelos": [
      {
        "nome": "Reclamação Trabalhista",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Reclamação Trabalhista (Rito Sumaríssimo)",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Reclamação Trabalhista (Rito Sumário)",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Reclamação Trabalhista de Acidente de Trabalho",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Reclamação de Doença Ocupacional",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Reclamação de Equiparação Salarial",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Reclamação de Reconhecimento de Vínculo",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Reclamação de Horas Extras",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Reclamação de Adicional de Insalubridade / Periculosidade",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Reclamação de Dano Moral Trabalhista (Assédio)",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Cumprimento de Acordo / Convenção Coletiva",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Consignação em Pagamento (Trabalhista)",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Monitória Trabalhista",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Inquérito para Apuração de Falta Grave",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Ação de Estabilidade Provisória",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Pedido de Tutela de Urgência (Reintegração)",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Habilitação de Crédito Trabalhista (Falência/RJ)",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Empresarial da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Petição de Acordo Extrajudicial - Homologação (art. 855-B CLT)",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      }
    ]
  },
  {
    "grupo": "Trabalhista — Defesa / Empregador",
    "modelos": [
      {
        "nome": "Defesa / Contestação Trabalhista",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Reconvenção Trabalhista",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Exceção de Incompetência Territorial",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Impugnação ao Valor da Causa (Trabalhista)",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Impugnação à Gratuidade de Justiça",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Impugnação aos Cálculos de Liquidação",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Impugnação à Sentença de Liquidação",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Embargos à Execução Trabalhista",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Embargos de Terceiro (Trabalhista)",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Exceção de Pré-Executividade (Trabalhista)",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      }
    ]
  },
  {
    "grupo": "Trabalhista — Manifestações e Memoriais",
    "modelos": [
      {
        "nome": "Razões Finais (Remissivas)",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Razões Finais Escritas / Memoriais",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Petição de Rol de Testemunhas",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Manifestação sobre Laudo Pericial",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Quesitos para Perícia",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Petição de Acordo (Trabalhista)",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Petição de Desistência (Trabalhista)",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Pedido de Liberação de Depósito / Alvará",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Pedido de Penhora BACENJUD/SISBAJUD",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Pedido de Expedição de Ofício",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      }
    ]
  },
  {
    "grupo": "Trabalhista — Recursos",
    "modelos": [
      {
        "nome": "Recurso Ordinário",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Contrarrazões de Recurso Ordinário",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Recurso de Revista",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal Regional do Trabalho da 3ª Região"
      },
      {
        "nome": "Contrarrazões de Recurso de Revista",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal Regional do Trabalho da 3ª Região"
      },
      {
        "nome": "Agravo de Instrumento em Recurso de Revista",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal Regional do Trabalho da 3ª Região"
      },
      {
        "nome": "Agravo de Petição",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Contrarrazões de Agravo de Petição",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Embargos de Declaração (Trabalhista)",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Embargos de Declaração (TRT)",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal Regional do Trabalho da 3ª Região"
      },
      {
        "nome": "Embargos à SDI / Embargos no TST",
        "enderecamento": "Exmo. Sr. Ministro Relator do Tribunal Superior do Trabalho"
      },
      {
        "nome": "Recurso Extraordinário Trabalhista",
        "enderecamento": "Exmo. Sr. Ministro Relator do Tribunal Superior do Trabalho"
      },
      {
        "nome": "Agravo Interno / Regimental (Trabalhista)",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal Regional do Trabalho da 3ª Região"
      },
      {
        "nome": "Agravo (art. 897, b, CLT)",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Mandado de Segurança contra ato de Juiz do Trabalho",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal Regional do Trabalho da 3ª Região"
      },
      {
        "nome": "Ação Rescisória Trabalhista",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal Regional do Trabalho da 3ª Região"
      },
      {
        "nome": "Reclamação Constitucional (Trabalhista)",
        "enderecamento": "Exmo. Sr. Ministro Relator do Tribunal Superior do Trabalho"
      },
      {
        "nome": "Correição Parcial",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal Regional do Trabalho da 3ª Região"
      },
      {
        "nome": "Pedido de Uniformização de Jurisprudência (TRT)",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal Regional do Trabalho da 3ª Região"
      }
    ]
  },
  {
    "grupo": "Trabalhista — Dissídios Coletivos e Sindicais",
    "modelos": [
      {
        "nome": "Dissídio Coletivo de Natureza Econômica",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal Regional do Trabalho da 3ª Região"
      },
      {
        "nome": "Dissídio Coletivo de Natureza Jurídica",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal Regional do Trabalho da 3ª Região"
      },
      {
        "nome": "Dissídio Coletivo de Greve",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal Regional do Trabalho da 3ª Região"
      },
      {
        "nome": "Ação de Cumprimento (Sindicato)",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      },
      {
        "nome": "Ação Anulatória de Cláusula Coletiva",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal Regional do Trabalho da 3ª Região"
      },
      {
        "nome": "Ação Civil Pública Trabalhista",
        "enderecamento": "Exmo. Sr. Juiz do Trabalho da ___ Vara do Trabalho de Belo Horizonte/MG"
      }
    ]
  },
  {
    "grupo": "Criminal e Constitucional",
    "modelos": [
      {
        "nome": "Habeas Corpus",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Mandado de Injunção",
        "enderecamento": "Exmo. Sr. Ministro Relator do Supremo Tribunal Federal"
      },
      {
        "nome": "Queixa-Crime",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Criminal da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Resposta à Acusação",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Criminal da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Alegações Finais Criminais",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Criminal da Comarca de Belo Horizonte/MG"
      },
      {
        "nome": "Recurso em Sentido Estrito",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Apelação Criminal",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal de Justiça de Minas Gerais"
      },
      {
        "nome": "Revisão Criminal",
        "enderecamento": "Exmo. Sr. Desembargador Relator do Tribunal de Justiça de Minas Gerais"
      }
    ]
  },
  {
    "grupo": "Extrajudicial / Outras",
    "modelos": [
      {
        "nome": "Notificação Extrajudicial",
        "enderecamento": "Ao(À) Sr.(a) ___"
      },
      {
        "nome": "Parecer Jurídico (peça avulsa)",
        "enderecamento": ""
      },
      {
        "nome": "Memorial Doutrinário",
        "enderecamento": "Exmo. Sr. Juiz de Direito da ___ Vara Cível da Comarca de Belo Horizonte/MG"
      }
    ]
  }
]

function slug(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function topicosBase(nome: string, grupo: string) {
  const topicos = ['DOS FATOS', 'DO DIREITO', 'DOS PEDIDOS']
  if (/recurso|agravo|apelação|contrarrazões|embargos/i.test(nome) || grupo.includes('Recursos')) {
    return ['DA TEMPESTIVIDADE', 'DO CABIMENTO', 'DAS RAZÕES RECURSAIS', 'DOS PEDIDOS']
  }
  if (/execução|cumprimento|embargos|impugnação|exceção de pré/i.test(nome) || grupo.includes('Execução')) {
    return ['DO CABIMENTO', 'DOS FATOS', 'DO DÉBITO OU OBRIGAÇÃO', 'DOS PEDIDOS']
  }
  if (/trabalhista|reclamação|CLT|rito sumaríssimo|rito sumário/i.test(nome) || grupo.includes('Trabalhista')) {
    return ['DO CONTRATO DE TRABALHO', 'DOS FATOS', 'DO DIREITO', 'DOS PEDIDOS']
  }
  if (/família|alimentos|guarda|divórcio|união estável|inventário|partilha|sucess/i.test(nome) || grupo.includes('Família')) {
    return ['DOS FATOS', 'DO DIREITO DE FAMÍLIA E SUCESSÕES', 'DOS PEDIDOS']
  }
  if (/tutela|cautelar|arresto|sequestro|busca|urgência|evidência/i.test(nome) || grupo.includes('Cautelares')) {
    return ['DOS FATOS', 'DA PROBABILIDADE DO DIREITO', 'DO PERIGO DE DANO', 'DOS PEDIDOS']
  }
  if (/mandado de segurança|habeas|injunção|constitucional/i.test(nome) || grupo.includes('Criminal')) {
    return ['DOS FATOS', 'DO DIREITO LÍQUIDO E CERTO', 'DA MEDIDA LIMINAR', 'DOS PEDIDOS']
  }
  return topicos
}

function enderecamentoPadrao(nome: string, grupo: string, enderecamentoOriginal: string) {
  if (nome === 'Notificação Extrajudicial') return 'AO(À) SR.(A) ___.'
  if (grupo === 'Extrajudicial / Outras') return enderecamentoOriginal.toUpperCase()
  if (grupo.includes('Recursos') || /recurso|agravo|apelação|embargos|rescisória|reclamação constitucional/i.test(nome)) {
    return 'AO JUÍZO OU TRIBUNAL COMPETENTE, CONFORME A PEÇA RECURSAL.'
  }
  if (grupo.includes('Juizado Especial')) {
    return 'EXMO. SR. JUIZ DE DIREITO DO ___ JUIZADO ESPECIAL CÍVEL DA COMARCA DE ___/UF.'
  }
  if (grupo.includes('Família') || grupo.includes('Sucessões')) {
    return 'EXMO. SR. JUIZ DE DIREITO DA ___ VARA DE FAMÍLIA E SUCESSÕES DA COMARCA DE ___/UF.'
  }
  if (grupo.includes('Trabalhista')) {
    return 'EXMO. SR. JUIZ DA ___ VARA DO TRABALHO DE ___/UF.'
  }
  if (grupo.includes('Tributário') || grupo.includes('Administrativo')) {
    return 'EXMO. SR. JUIZ DE DIREITO DA ___ VARA DA FAZENDA PÚBLICA DA COMARCA DE ___/UF.'
  }
  if (grupo.includes('Criminal')) {
    return 'EXMO. SR. JUIZ DE DIREITO DA ___ VARA CRIMINAL DA COMARCA DE ___/UF.'
  }
  if (/usucapião extrajudicial/i.test(nome)) {
    return 'EXMO. SR. OFICIAL DO REGISTRO DE IMÓVEIS DA ___ CIRCUNSCRIÇÃO DE ___/UF.'
  }
  return 'EXMO. SR. JUIZ DE DIREITO DA ___ VARA CÍVEL DA COMARCA DE ___/UF.'
}

function pedidosSugeridos(nome: string, grupo: string) {
  if (/cobrança|monitória/i.test(nome)) {
    return ['Citação da parte ré.', 'Procedência dos pedidos.', 'Condenação ao pagamento dos valores devidos.', 'Juros, correção monetária, custas e honorários.', 'Produção de provas.']
  }
  if (/indeniza/i.test(nome)) {
    return ['Citação da parte ré.', 'Reconhecimento do ato ilícito, se comprovado.', 'Condenação ao pagamento da indenização cabível.', 'Juros, correção monetária, custas e honorários.', 'Produção de provas.']
  }
  if (/contestação|defesa|contrarrazões|impugnação/i.test(nome)) {
    return ['Recebimento da defesa ou manifestação.', 'Acolhimento de preliminares, se houver.', 'Improcedência dos pedidos da parte contrária.', 'Produção de provas.', 'Condenação em custas e honorários, quando cabível.']
  }
  if (/recurso|agravo|apelação|embargos/i.test(nome) || grupo.includes('Recursos')) {
    return ['Conhecimento do recurso.', 'Provimento para reforma ou anulação da decisão, conforme o caso.', 'Intimação da parte contrária para contrarrazões, quando cabível.', 'Demais providências necessárias ao julgamento.']
  }
  if (/execução|cumprimento/i.test(nome)) {
    return ['Recebimento da medida executiva.', 'Intimação ou citação da parte executada, conforme o rito aplicável.', 'Adoção dos atos constritivos cabíveis em caso de inadimplemento.']
  }
  if (/trabalhista|reclamação/i.test(nome) || grupo.includes('Trabalhista — Empregado')) {
    return ['Notificação da reclamada.', 'Procedência dos pedidos.', 'Pagamento das verbas indicadas.', 'Reflexos legais cabíveis.', 'Juros, correção monetária, honorários e produção de provas.']
  }
  if (grupo.includes('Família') || grupo.includes('Sucessões')) {
    return ['Citação ou intimação da parte contrária, quando cabível.', 'Procedência dos pedidos.', 'Providência familiar ou sucessória correspondente ao modelo.', 'Intervenção do Ministério Público, quando cabível.', 'Produção de provas.']
  }
  if (grupo.includes('Criminal')) {
    return ['Recebimento da medida.', 'Apreciação dos fundamentos após revisão jurídica específica.', 'Concessão da ordem, absolvição, reforma ou providência cabível conforme o caso.', 'Produção de provas, quando admitida.']
  }
  if (/tutela|cautelar|arresto|sequestro|busca|urgência|evidência/i.test(nome)) {
    return ['Concessão da tutela de urgência ou medida cabível.', 'Confirmação da medida ao final.', 'Produção das provas necessárias.']
  }
  return ['Recebimento e processamento da petição.', 'Julgamento de procedência dos pedidos, conforme fundamentos a desenvolver.', 'Condenação da parte contrária nos ônus cabíveis, quando aplicável.', 'Produção de todos os meios de prova em direito admitidos.']
}

export const CATALOGO_PETICOES: ModeloPeticao[] = GRUPOS_EXTRAIDOS_LOVABLE.flatMap(grupo =>
  grupo.modelos.map(modelo => ({
    id: slug(modelo.nome),
    grupo: grupo.grupo,
    nomeExibido: modelo.nome,
    nomeAcao: modelo.nome.toUpperCase(),
    enderecamentoPadrao: enderecamentoPadrao(modelo.nome, grupo.grupo, modelo.enderecamento),
    topicosBase: topicosBase(modelo.nome, grupo.grupo),
    pedidosSugeridos: pedidosSugeridos(modelo.nome, grupo.grupo),
  })),
)

export const GRUPOS_PETICOES = GRUPOS_EXTRAIDOS_LOVABLE.map(grupo => ({
  grupo: grupo.grupo,
  modelos: CATALOGO_PETICOES.filter(modelo => modelo.grupo === grupo.grupo),
}))

export function buscarModeloPeticao(id: string) {
  return CATALOGO_PETICOES.find(modelo => modelo.id === id) ?? null
}
