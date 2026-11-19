import { describe, expect, it } from 'vitest';
import { dataDaRecorrencia, gerarPrevistosDoMes } from './recorrencias';
import { efeitoNaConta, estadoDoSaldo, saldosDoMes } from './saldos';
import { agruparPorDia, filtrarLancamentos, statusSugerido, validarLancamento } from './lancamentos';
import type { Conta, Lancamento, Recorrencia } from '../tipos';

const rec = (id: string, dia: number, valor: number, extra: Partial<Recorrencia> = {}): Recorrencia => ({
  id, diaDoMes: dia, ativa: true, modelo: { tipo: 'saida', valor, descricao: id, contaId: 'c1', categoriaId: 'cat' }, ...extra,
});
let n = 0;
const lanc = (data: string, tipo: Lancamento['tipo'], valor: number, extra: Partial<Lancamento> = {}): Lancamento => ({
  id: `l${n++}`, tipo, valor, data, descricao: 'x', certeza: 'garantida', status: 'realizado', contaId: 'c1', ...extra,
});

describe('recorrências', () => {
  it('dia 31 cai no último dia do mês', () => {
    expect(dataDaRecorrencia('2026-11', 31)).toBe('2026-11-30');
    expect(dataDaRecorrencia('2026-02', 30)).toBe('2026-02-28');
    expect(dataDaRecorrencia('2026-12', 5)).toBe('2026-12-05');
  });
  it('gera previstos dos fixos ativos e não repete', () => {
    const recs = [rec('aluguel', 5, 150000), rec('net', 20, 10000), rec('pausado', 10, 999, { ativa: false })];
    const novos = gerarPrevistosDoMes(recs, '2026-12', [], '2026-11-19');
    expect(novos.map((l) => [l.descricao, l.data, l.status])).toEqual([
      ['aluguel', '2026-12-05', 'previsto'], ['net', '2026-12-20', 'previsto'],
    ]);
    expect(gerarPrevistosDoMes(recs, '2026-12', [{ recorrenciaId: 'aluguel', data: '2026-12-05' }], '2026-11-19').map((l) => l.descricao)).toEqual(['net']);
  });
  it('no primeiro mês, o que já passou entra como realizado; antes do início, nada', () => {
    const recs = [rec('aluguel', 5, 150000), rec('net', 20, 10000)];
    const nov = gerarPrevistosDoMes(recs, '2026-11', [], '2026-11-19');
    expect(nov.map((l) => l.status)).toEqual(['realizado', 'previsto']);
    expect(gerarPrevistosDoMes(recs, '2026-10', [], '2026-11-19')).toEqual([]);
  });
  it('respeita a data de fim e leva o cartão e a certeza', () => {
    const r = rec('curso', 10, 5000, { fim: '2026-12-01' });
    expect(gerarPrevistosDoMes([r], '2026-12', [], '2026-11-01')).toEqual([]);
    const sal = rec('sal', 5, 300000, { modelo: { tipo: 'entrada', valor: 300000, descricao: 'Salário', contaId: 'c1', certeza: 'provavel' } });
    expect(gerarPrevistosDoMes([sal], '2026-12', [], '2026-11-01')[0].certeza).toBe('provavel');
    const net = rec('netflix', 8, 5590, { modelo: { tipo: 'saida', valor: 5590, descricao: 'Netflix', cartaoId: 'k1' } });
    const g = gerarPrevistosDoMes([net], '2026-12', [], '2026-11-01')[0];
    expect(g.cartaoId).toBe('k1');
    expect(g.contaId).toBeUndefined();
  });
});

describe('efeito na conta', () => {
  it('cartão não mexe, entrada incerta não conta, transferência sai', () => {
    expect(efeitoNaConta(lanc('2026-11-01', 'saida', 100))).toBe(-100);
    expect(efeitoNaConta(lanc('2026-11-01', 'saida', 100, { cartaoId: 'k', contaId: undefined }))).toBe(0);
    expect(efeitoNaConta(lanc('2026-11-01', 'entrada', 100))).toBe(100);
    expect(efeitoNaConta(lanc('2026-11-01', 'entrada', 100, { certeza: 'provavel' }))).toBe(0);
    expect(efeitoNaConta(lanc('2026-11-01', 'transferencia', 100))).toBe(-100);
  });
  it('estado do saldo', () => {
    expect(estadoDoSaldo(-1, 0)).toBe('negativo');
    expect(estadoDoSaldo(500, 1000)).toBe('apertado');
    expect(estadoDoSaldo(1000, 1000)).toBe('ok');
  });
});

describe('saldos do mês', () => {
  const conta: Conta = { id: 'c1', nome: 'Nubank', tipo: 'corrente', saldoInicial: 100000, dataSaldoInicial: '2026-11-17' };

  it('parte do saldo inicial e projeta fixos e entradas por dia', () => {
    const ls = [
      lanc('2026-11-10', 'saida', 99999),                       // antes do início: ignorado
      lanc('2026-11-17', 'saida', 20000),                       // no dia do início: conta
      lanc('2026-11-18', 'entrada', 56517),
      lanc('2026-11-20', 'saida', 150000, { recorrenciaId: 'r', status: 'previsto' }),
      lanc('2026-11-21', 'saida', 30000, { cartaoId: 'k', contaId: undefined }),
      lanc('2026-11-25', 'entrada', 100000, { certeza: 'provavel', status: 'previsto' }),
    ];
    const g = saldosDoMes('2026-11', [conta], ls);
    expect(g).toHaveLength(30);
    expect(g[15].saldo).toBeNull();               // dia 16: antes de começar
    expect(g[16].saldo).toBe(80000);              // 17
    expect(g[17].saldo).toBe(136517);             // 18
    expect(g[19].saldo).toBe(-13483);             // 20: aluguel previsto já desconta
    expect(g[19].estado).toBe('negativo');
    expect(g[19].fixoPendente).toBe(true);
    expect(g[20].cartao).toBe(30000);             // 21: cartão aparece mas não mexe
    expect(g[20].saldo).toBe(-13483);
    expect(g[24].entradas).toBe(100000);          // 25: provável aparece...
    expect(g[24].entradasIncertas).toBe(100000);
    expect(g[24].saldo).toBe(-13483);             // ...mas não entra no saldo
  });

  it('fica amarelo quando o saldo não cobre o que ainda vai sair', () => {
    const ls = [lanc('2026-11-28', 'saida', 90000, { recorrenciaId: 'r', status: 'previsto' })];
    const g = saldosDoMes('2026-11', [conta], ls);
    expect(g[17].estado).toBe('ok');              // 100.000 cobre 90.000
    const ls2 = [...ls, lanc('2026-11-18', 'saida', 20000)];
    const g2 = saldosDoMes('2026-11', [conta], ls2);
    expect(g2[17].estado).toBe('apertado');       // 80.000 não cobre 90.000
    expect(g[28].estado).toBe('ok');              // depois do dia 28 nada mais sai: 10.000 basta
  });

  it('carrega o saldo dos meses anteriores', () => {
    const ls = [lanc('2026-11-20', 'saida', 30000), lanc('2026-12-05', 'entrada', 10000)];
    const dez = saldosDoMes('2026-12', [conta], ls);
    expect(dez[0].saldo).toBe(70000);
    expect(dez[4].saldo).toBe(80000);
  });

  it('soma várias contas, cada uma com sua data de início', () => {
    const carteira: Conta = { id: 'c2', nome: 'Carteira', tipo: 'carteira', saldoInicial: 5000, dataSaldoInicial: '2026-11-20' };
    const g = saldosDoMes('2026-11', [conta, carteira], [lanc('2026-11-19', 'saida', 1000, { contaId: 'c2' })]);
    expect(g[18].saldo).toBe(100000);             // gasto na carteira antes do início dela: ignorado
    expect(g[19].saldo).toBe(105000);
  });
});

describe('lançamentos', () => {
  it('valida', () => {
    expect(validarLancamento({ valor: 100, descricao: 'a', data: '2026-11-19', contaId: 'c' })).toEqual({});
    const e = validarLancamento({ tipo: 'entrada', valor: 0, descricao: '', data: '', cartaoId: 'k' });
    expect(Object.keys(e).sort()).toEqual(['contaId', 'data', 'descricao', 'valor']);
  });
  it('status sugerido', () => {
    expect(statusSugerido('2026-11-19', '2026-11-19', 'garantida')).toBe('realizado');
    expect(statusSugerido('2026-11-20', '2026-11-19', 'garantida')).toBe('previsto');
    expect(statusSugerido('2026-11-19', '2026-11-19', 'provavel')).toBe('previsto');
  });
  it('filtra e agrupa por dia', () => {
    const ls = [lanc('2026-11-18', 'saida', 10, { categoriaId: 'a' }), lanc('2026-11-19', 'entrada', 50), lanc('2026-11-19', 'saida', 20, { cartaoId: 'k', categoriaId: 'b' })];
    expect(filtrarLancamentos(ls, { tipo: 'saida' })).toHaveLength(2);
    expect(filtrarLancamentos(ls, { cartaoId: 'k' })).toHaveLength(1);
    expect(filtrarLancamentos(ls, { categoriaId: 'a' })[0].data).toBe('2026-11-18');
    const g = agruparPorDia(ls);
    expect(g.map((x) => x.data)).toEqual(['2026-11-19', '2026-11-18']);
    expect(g[0].itens[0].tipo).toBe('entrada');
    expect([g[0].entradas, g[0].saidas]).toEqual([50, 20]);
  });
});
