import { describe, expect, it } from 'vitest'
import { fornecedorDaDescricao } from './fornecedor'

describe('fornecedorDaDescricao', () => {
  it.each([
    ['PAGAMENTO CEMIG', 'CEMIG'],
    ['PAGAMENTO DESP. COM TELEFONIA CLARO/ VIVO NO MÊS', 'CLARO / VIVO'],
    ['PAGAMENTO DESP. COM TELEFONIA VIVO NO MÊS', 'VIVO'],
    ['PAGAMENTO SERVIÇOS BLINK TELECOMUNICAÇÕES', 'BLINK TELECOMUNICAÇÕES'],
    ['PAGAMENTO ANUIDADE OAB/MG- PARCELA 09/12 - CARTÃO DE CRÉDITO - CRISTIANO', 'OAB/MG'],
    ['PAGAMENTO CONDOMINIO ED. STRAUSS - SALAS 801 E 802', 'CONDOMÍNIO ED. STRAUSS'],
    ['PAGAMENTO ALUGUEL SALAS 801 E 802', 'ED. STRAUSS (ALUGUEL DAS SALAS)'],
    ['PAGAMENTO folha de salários do mês de JUNHO', 'FOLHA DE PAGAMENTO'],
    ['PAGAMENTO VALE TRANSPORTE DE LUANA', 'LUANA (VALE TRANSPORTE)'],
    ['PAGAMENTO DESP. COM ALIMENTAÇÃO / LUANA', 'LUANA (ALIMENTAÇÃO)'],
    ['PAGAMENTO SIMPLES NACIONAL NO MÊS', 'RECEITA FEDERAL (SIMPLES NACIONAL)'],
    ['THEMIS RECORTES E TCNOLOGIA JURIDCIA MÊS', 'THEMIS RECORTES E TECNOLOGIA JURÍDICA'],
  ])('%s → %s', (descricao, esperado) => {
    expect(fornecedorDaDescricao(descricao)).toBe(esperado)
  })

  it('sem regra conhecida: tira "PAGAMENTO" e o resto depois de " - " ou "REF."', () => {
    expect(fornecedorDaDescricao('PAGAMENTO FARMÁCIA SÃO JOÃO - REF. 10/2026')).toBe('FARMÁCIA SÃO JOÃO')
    expect(fornecedorDaDescricao('Compra de café Pilão')).toBe('café Pilão')
  })

  it('se não sobra nada útil, usa o nome da despesa mesmo; vazio continua vazio', () => {
    expect(fornecedorDaDescricao('PAGAMENTO')).toBe('PAGAMENTO')
    expect(fornecedorDaDescricao('')).toBe('')
    expect(fornecedorDaDescricao(null)).toBe('')
  })
})
