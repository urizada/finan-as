import { describe, expect, it } from 'vitest';
import { alertaDeCaixa, dividirEntrada, livrePorDia, percentuaisValidos, saldoDasContas, totaisDoMes, PERCENTUAIS_PADRAO } from './orcamento';
import type { Conta, Lancamento } from '../tipos';

let n = 0;
const lanc = (data: string, tipo: Lancamento['tipo'], valor: number, extra: Partial<Lancamento> = {}): Lancamento => ({
  id: `l${n++}`, tipo, valor, data, descricao: 'x', certeza: 'garantida', status: 'realizado', contaId: 'c1', ...extra,
});
const conta: Conta = { id: 'c1', nome: 'N', tipo: 'corrente', saldoInicial: 100000, dataSaldoInicial: '2026-11-01' };
const k = { id: 'k', nome: 'K', limite: 1, diaFechamento: 3, diaVencimento: 10, contaPagamentoId: 'c1' };

describe('5.1 livre por dia (com plano e meta de guardar)', () => {
  const hoje = '2026-11-21'; // 10 dias restantes contando hoje
  const ls = [
    lanc('2026-11-05', 'entrada', 600000),
    lanc('2026-11-25', 'entrada', 300000, { certeza: 'provavel', status: 'previsto' }), // entrada futura também conta
    lanc('2026-11-10', 'saida', 150000, { recorrenciaId: 'aluguel', status: 'previsto' }),
    lanc('2026-11-28', 'saida', 10000, { recorrenciaId: 'net', status: 'previsto' }),
    lanc('2026-11-12', 'saida', 20000, { contaId: undefined, cartaoId: 'k', parcela: { numero: 2, total: 3, grupoId: 'g' } }),
    lanc('2026-11-15', 'transferencia', 30000, { destino: { tipo: 'meta', id: 'r' } }),
    lanc('2026-11-20', 'saida', 5000),
    lanc('2026-11-18', 'saida', 15000, { contaId: undefined, cartaoId: 'k' }),
    lanc('2026-11-21', 'saida', 3000),
    lanc('2026-11-10', 'transferencia', 99999, { cartaoId: 'k', faturaRef: '2026-11' }),
    lanc('2026-11-01', 'saida', 77777, { contaId: undefined, cartaoId: 'k', saldoAnterior: true }),
  ];
  it('sem plano: tudo que sobra vira o dia a dia', () => {
    const r = livrePorDia(ls, hoje);
    expect(r).toMatchObject({ entradas: 900000, fixos: 160000, parcelas: 20000, guardado: 30000, variaveisAteOntem: 20000, variaveisHoje: 3000, diasRestantes: 10 });
    expect(r.capacidade).toBe(900000 - 160000 - 20000 - 30000);          // 690.000
    expect(r.livreHoje).toBe(Math.floor((690000 - 20000) / 10));         // 67.000
    expect(r.aindaPossoHoje).toBe(64000);
    expect(r.faltaEntrada).toBe(0);
  });
  it('com plano: usa o plano e mostra o que sobra no fim', () => {
    const r = livrePorDia(ls, hoje, { planejado: 300000 });
    expect(r.orcamentoDiaADia).toBe(300000);
    expect(r.livreHoje).toBe(28000);                                    // (300.000 − 20.000) ÷ 10
    expect(r.mediaPorDia).toBe(10000);                                  // 300.000 ÷ 30
    expect(r.diferenca).toBe(18000);                                    // gastou menos antes: hoje pode mais
    expect(r.sobraNoFim).toBe(390000);
    expect(r.planoAcima).toBe(0);
  });
  it('plano acima do que dá: limita e avisa', () => {
    const r = livrePorDia(ls, hoje, { planejado: 800000 });
    expect(r.orcamentoDiaADia).toBe(690000);
    expect(r.planoAcima).toBe(110000);
  });
  it('meta de guardar sai antes do dia a dia', () => {
    const r = livrePorDia(ls, hoje, { guardarMeta: 100000 });
    expect(r).toMatchObject({ guardarMeta: 100000, faltaGuardar: 70000, capacidade: 620000 });
    expect(livrePorDia(ls, hoje, { guardarMeta: 10000 }).capacidade).toBe(690000); // já guardou mais que a meta
  });
  it('dinheiro de partida entra', () => {
    expect(livrePorDia(ls, hoje, { partida: 50000 }).capacidade).toBe(740000);
  });
  it('gastou menos, amanhã sobe; gastou mais, cai', () => {
    const plano = { planejado: 300000 };
    const hojeR = livrePorDia(ls, hoje, plano);
    expect(livrePorDia(ls, '2026-11-22', plano).livreHoje).toBeGreaterThan(hojeR.aindaPossoHoje);
    const gastao = livrePorDia([...ls, lanc('2026-11-21', 'saida', 100000)], '2026-11-22', plano);
    expect(gastao.livreHoje).toBeLessThan(hojeR.livreHoje);
  });
  it('primeiro mês: usa só a parte do plano dos dias que restam', () => {
    const r = livrePorDia([], '2026-11-20', { planejado: 300000, inicio: '2026-11-20', partida: 200000 }); // 11 de 30 dias
    expect(r.orcamentoDiaADia).toBe(110000);
    expect(r.mediaPorDia).toBe(10000);                                 // igual a 300.000 ÷ 30
    expect(r.livreHoje).toBe(10000);
  });
  it('mês que não fecha mostra quanto falta de entrada', () => {
    const r = livrePorDia([lanc('2026-11-10', 'saida', 150000, { recorrenciaId: 'a' })], hoje);
    expect(r.livreHoje).toBe(-15000);
    expect(r.faltaEntrada).toBe(150000);
  });
});

describe('saldo das contas e 5.2 alerta de caixa', () => {
  it('saldo por conta numa data', () => {
    const c2: Conta = { id: 'c2', nome: 'Carteira', tipo: 'carteira', saldoInicial: 5000, dataSaldoInicial: '2026-11-15' };
    const ls = [lanc('2026-11-10', 'saida', 1000), lanc('2026-11-16', 'saida', 500, { contaId: 'c2' }), lanc('2026-11-20', 'entrada', 9000, { certeza: 'provavel' })];
    expect(saldoDasContas([conta, c2], ls, [], '2026-11-12')).toEqual({ total: 99000, porConta: { c1: 99000 } });
    expect(saldoDasContas([conta, c2], ls, [], '2026-11-30').porConta).toEqual({ c1: 108000, c2: 4500 });
    expect(saldoDasContas([conta, c2], ls, [], '2026-11-30', true).porConta.c1).toBe(99000);
  });
  it('avisa o primeiro dia negativo e o pior valor, sem contar prováveis', () => {
    const ls = [
      lanc('2026-11-25', 'saida', 80000, { recorrenciaId: 'a', status: 'previsto' }),
      lanc('2026-11-04', 'saida', 50000, { contaId: undefined, cartaoId: 'k' }),          // fatura dez, vence 10/12: fora do mês
      lanc('2026-11-02', 'saida', 40000, { contaId: undefined, cartaoId: 'k' }),          // fatura nov, vence 10/11
      lanc('2026-11-27', 'entrada', 500000, { certeza: 'provavel', status: 'previsto' }),
      lanc('2026-11-28', 'saida', 10000),
    ];
    expect(alertaDeCaixa([conta], ls, [k], '2026-11-05')).toEqual({ dia: '2026-11-25', falta: 30000 });
    expect(alertaDeCaixa([conta], ls.slice(0, 2), [k], '2026-11-05')).toBeNull();
  });
});

describe('5.7 divisão de entrada', () => {
  it('completa os fixos primeiro e divide o resto', () => {
    expect(dividirEntrada(500000, 120000, PERCENTUAIS_PADRAO)).toEqual({ fixos: 120000, reserva: 76000, investimentos: 38000, metas: 0, livre: 266000 });
    expect(dividirEntrada(100000, 300000, PERCENTUAIS_PADRAO)).toEqual({ fixos: 100000, reserva: 0, investimentos: 0, metas: 0, livre: 0 });
  });
  it('a soma é sempre o valor', () => {
    const d = dividirEntrada(33333, 0, { reserva: 33, investimentos: 33, metas: 1, livre: 33 });
    expect(d.fixos + d.reserva + d.investimentos + d.metas + d.livre).toBe(33333);
  });
  it('percentuais precisam somar 100', () => {
    expect(percentuaisValidos(PERCENTUAIS_PADRAO)).toBe(true);
    expect(percentuaisValidos({ reserva: 50, investimentos: 50, metas: 0, livre: 1 })).toBe(false);
  });
});

describe('totais do mês', () => {
  it('soma por tipo, custo de vida, economizado e diário médio', () => {
    const ls = [
      lanc('2026-11-05', 'entrada', 500000), lanc('2026-11-25', 'entrada', 200000, { certeza: 'provavel' }),
      lanc('2026-11-10', 'saida', 150000, { recorrenciaId: 'a' }),
      lanc('2026-11-03', 'saida', 20000), lanc('2026-11-08', 'saida', 10000, { contaId: undefined, cartaoId: 'k' }),
      lanc('2026-11-12', 'saida', 20000, { contaId: undefined, cartaoId: 'k', parcela: { numero: 1, total: 3, grupoId: 'g' } }),
      lanc('2026-11-15', 'transferencia', 50000, { destino: { tipo: 'meta', id: 'r' } }),
    ];
    const t = totaisDoMes(ls, '2026-11', '2026-11-10');
    expect(t).toMatchObject({ entradas: 500000, entradasIncertas: 200000, fixos: 150000, variaveis: 30000, parcelas: 20000, noCartao: 30000, guardado: 50000, custoDeVida: 200000, resultado: 250000, economizadoPct: 10, diarioMedio: 3000, diasConsiderados: 10 });
    expect(totaisDoMes(ls, '2026-10', '2026-11-10').diasConsiderados).toBe(31);
    expect(totaisDoMes(ls, '2026-11', '2026-11-10', '2026-11-08')).toMatchObject({ diasConsiderados: 3, diarioMedio: 10000 });
  });
});
