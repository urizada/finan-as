import { describe, expect, it } from 'vitest';
import { aprenderPalavra, interpretar, type ContextoParser } from './parser';
import { CATEGORIAS_PADRAO } from './padroes';
import { faturaDaCompra, gerarParcelas } from './cartao';
import type { Categoria } from '../tipos';

const categorias: Categoria[] = CATEGORIAS_PADRAO.map((c) => ({ ...c, id: c.nome }));
const ctx: ContextoParser = {
  hoje: '2026-11-19',
  categorias,
  cartoes: [{ id: 'k-nu', nome: 'Nubank', limite: 500000, diaFechamento: 3, diaVencimento: 10, contaPagamentoId: 'c-nu' }],
  contas: [
    { id: 'c-nu', nome: 'Nubank', tipo: 'corrente', saldoInicial: 0, dataSaldoInicial: '2026-11-01' },
    { id: 'c-cart', nome: 'Carteira', tipo: 'carteira', saldoInicial: 0, dataSaldoInicial: '2026-11-01' },
  ],
  fontes: [{ id: 'f-com', nome: 'Comissão', tipo: 'variavel', valorMedioMensal: 600000, certezaPadrao: 'provavel' }],
  contaPadraoId: 'c-nu',
};

describe('lançamento rápido — exemplos do CLAUDE.md', () => {
  it('almoço 32 → saída R$ 32,00 · Alimentação · conta padrão · hoje', () => {
    const r = interpretar('almoço 32', ctx);
    expect(r).toMatchObject({ tipo: 'saida', valor: 3200, categoriaId: 'Alimentação', categoriaConfiante: true, contaId: 'c-nu', data: '2026-11-19', descricao: 'Almoço', status: 'realizado' });
    expect(r.cartaoId).toBeUndefined();
  });
  it('uber 18,50 nubank → saída R$ 18,50 · Transporte · cartão Nubank', () => {
    const r = interpretar('uber 18,50 nubank', ctx);
    expect(r).toMatchObject({ tipo: 'saida', valor: 1850, categoriaId: 'Transporte', cartaoId: 'k-nu', descricao: 'Uber', parcelas: 1 });
    expect(r.contaId).toBeUndefined();
  });
  it('tênis 600 nubank 3x → 3 parcelas no cartão Nubank', () => {
    const r = interpretar('tênis 600 nubank 3x', ctx);
    expect(r).toMatchObject({ tipo: 'saida', valor: 60000, parcelas: 3, cartaoId: 'k-nu', categoriaId: 'Compras', descricao: 'Tênis' });
  });
  it('recebi 1200 comissão → entrada R$ 1.200 · garantida · fonte Comissão', () => {
    const r = interpretar('recebi 1200 comissão', ctx);
    expect(r).toMatchObject({ tipo: 'entrada', valor: 120000, certeza: 'garantida', status: 'realizado', fonteRendaId: 'f-com', categoriaId: 'Comissão', contaId: 'c-nu', descricao: 'Comissão' });
  });
  it('vou receber 2500 comissão → entrada prevista · provável', () => {
    const r = interpretar('vou receber 2500 comissão', ctx);
    expect(r).toMatchObject({ tipo: 'entrada', valor: 250000, certeza: 'provavel', status: 'previsto', fonteRendaId: 'f-com' });
  });
  it('mercado 150 ontem → saída com data de ontem', () => {
    expect(interpretar('mercado 150 ontem', ctx)).toMatchObject({ tipo: 'saida', valor: 15000, data: '2026-11-18', categoriaId: 'Mercado', descricao: 'Mercado' });
  });
});

describe('lançamento rápido — outros jeitos de falar', () => {
  it.each([
    ['café 7,5', 750], ['gasolina 1.200', 120000], ['gasolina 1.200,90', 120090], ['lanche 18.50', 1850], ['lanche R$ 25', 2500], ['lanche r$25', 2500],
  ])('valor de "%s"', (t, v) => expect(interpretar(t, ctx).valor).toBe(v));

  it('sem palavra conhecida cai em Outros e pede confirmação', () => {
    expect(interpretar('xpto 10', ctx)).toMatchObject({ categoriaId: 'Outros', categoriaConfiante: false, palavra: 'xpto' });
  });
  it('sem valor devolve null', () => expect(interpretar('almoço', ctx).valor).toBeNull());
  it('datas dd/mm, dd/mm/aa e "dia 5"', () => {
    expect(interpretar('farmácia 40 15/11', ctx).data).toBe('2026-11-15');
    expect(interpretar('farmácia 40 02/01/27', ctx).data).toBe('2027-01-02');
    expect(interpretar('aluguel 1500 dia 5', ctx).data).toBe('2026-11-05');
    expect(interpretar('cinema 60 amanhã', ctx)).toMatchObject({ data: '2026-11-20', status: 'previsto' });
  });
  it('dinheiro vai para a carteira e "no crédito" usa o único cartão', () => {
    expect(interpretar('pastel 12 em dinheiro', ctx)).toMatchObject({ contaId: 'c-cart', descricao: 'Pastel' });
    expect(interpretar('pizza 80 no crédito', ctx)).toMatchObject({ cartaoId: 'k-nu', descricao: 'Pizza' });
  });
  it('entrada cai na conta mesmo com nome igual ao do cartão', () => {
    expect(interpretar('recebi 500 nubank', ctx)).toMatchObject({ tipo: 'entrada', contaId: 'c-nu' });
  });
  it('"comissão 3000" sem verbo: hoje é o que caiu; data futura usa a certeza da fonte', () => {
    expect(interpretar('comissão 3000', ctx)).toMatchObject({ tipo: 'entrada', certeza: 'garantida', status: 'realizado' });
    expect(interpretar('comissão 3000 dia 30', ctx)).toMatchObject({ tipo: 'entrada', certeza: 'provavel', status: 'previsto', data: '2026-11-30' });
  });
  it('repetições', () => {
    expect(interpretar('recebi 500 comissão toda semana', ctx)).toMatchObject({ tipo: 'entrada', frequencia: 'semanal', vezes: null, descricao: 'Comissão', certeza: 'garantida', certezaProximas: 'provavel' });
    expect(interpretar('academia 110 todo mês', ctx)).toMatchObject({ frequencia: 'mensal', descricao: 'Academia', categoriaId: 'Cuidados pessoais' });
    expect(interpretar('curso 200 todo mês 6 vezes', ctx)).toMatchObject({ frequencia: 'mensal', vezes: 6, descricao: 'Curso' });
    expect(interpretar('celular 1200 nubank em 10 vezes', ctx)).toMatchObject({ parcelas: 10, cartaoId: 'k-nu', descricao: 'Celular' });
  });
  it('parcelas sem cartão viram à vista na conta', () => {
    const semCartao = { ...ctx, cartoes: [] };
    expect(interpretar('tênis 600 3x', semCartao)).toMatchObject({ parcelas: 1, contaId: 'c-nu' });
  });
});

describe('aprender palavra', () => {
  it('põe na categoria escolhida e tira das outras', () => {
    const mudadas = aprenderPalavra(categorias, 'Uber', 'Lazer');
    expect(mudadas.find((c) => c.id === 'Lazer')?.palavrasChave).toContain('uber');
    expect(mudadas.find((c) => c.id === 'Transporte')?.palavrasChave).not.toContain('uber');
    expect(aprenderPalavra(categorias, 'almoço', 'Alimentação')).toEqual([]);
  });
});

describe('cartão', () => {
  it('fatura da compra pelo dia de fechamento', () => {
    expect(faturaDaCompra('2026-11-03', 3)).toBe('2026-11');
    expect(faturaDaCompra('2026-11-04', 3)).toBe('2026-12');
    expect(faturaDaCompra('2026-12-20', 10)).toBe('2027-01');
  });
  it('gera parcelas sem perder centavos, uma por fatura', () => {
    const ps = gerarParcelas({ tipo: 'saida', valor: 100000, data: '2026-11-19', descricao: 'TV', certeza: 'garantida', status: 'realizado', cartaoId: 'k' }, 3, 3, 'g1');
    expect(ps.map((p) => p.valor)).toEqual([33334, 33333, 33333]);
    expect(ps.map((p) => p.faturaRef)).toEqual(['2026-12', '2027-01', '2027-02']);
    expect(ps.map((p) => p.data)).toEqual(['2026-11-19', '2026-12-19', '2027-01-19']);
    expect(ps[2].parcela).toEqual({ numero: 3, total: 3, grupoId: 'g1' });
  });
});
