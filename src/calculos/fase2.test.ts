import { describe, expect, it } from 'vitest';
import { dataDaRecorrencia, gerarPrevistosDoMes } from './recorrencias';
import { efeitoNaConta, estadoDoSaldo, saldosDoMes } from './saldos';
import { calcularFaturas, proximaFaturaAPagar, vencimentoDaFatura } from './cartao';
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
    const g = saldosDoMes('2026-11', [conta], ls).dias;
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
    const g = saldosDoMes('2026-11', [conta], ls).dias;
    expect(g[17].estado).toBe('ok');              // 100.000 cobre 90.000
    const ls2 = [...ls, lanc('2026-11-18', 'saida', 20000)];
    const g2 = saldosDoMes('2026-11', [conta], ls2).dias;
    expect(g2[17].estado).toBe('apertado');       // 80.000 não cobre 90.000
    expect(g[28].estado).toBe('ok');              // depois do dia 28 nada mais sai: 10.000 basta
  });

  it('carrega o saldo dos meses anteriores', () => {
    const ls = [lanc('2026-11-20', 'saida', 30000), lanc('2026-12-05', 'entrada', 10000)];
    const dez = saldosDoMes('2026-12', [conta], ls).dias;
    expect(dez[0].saldo).toBe(70000);
    expect(dez[4].saldo).toBe(80000);
  });

  it('soma várias contas, cada uma com sua data de início', () => {
    const carteira: Conta = { id: 'c2', nome: 'Carteira', tipo: 'carteira', saldoInicial: 5000, dataSaldoInicial: '2026-11-20' };
    const g = saldosDoMes('2026-11', [conta, carteira], [lanc('2026-11-19', 'saida', 1000, { contaId: 'c2' })]).dias;
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

import { datasNoMes, dataDaOcorrencia, numeroDaOcorrencia, rotuloRepeticao, totalDeOcorrencias } from './recorrencias';

describe('repetições semanais e quinzenais', () => {
  const semanal: Recorrencia = { id: 'com', frequencia: 'semanal', dataInicio: '2026-11-06', diaDoMes: 6, ativa: true,
    modelo: { tipo: 'entrada', valor: 50000, descricao: 'Comissão', contaId: 'c1', certeza: 'garantida' } };
  it('datas no mês', () => {
    expect(datasNoMes(semanal, '2026-11')).toEqual(['2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27']);
    expect(datasNoMes(semanal, '2026-12')).toEqual(['2026-12-04', '2026-12-11', '2026-12-18', '2026-12-25']);
    expect(datasNoMes(semanal, '2026-10')).toEqual([]);
    expect(datasNoMes({ ...semanal, frequencia: 'quinzenal' }, '2026-12')).toEqual(['2026-12-04', '2026-12-18']);
    expect(datasNoMes({ ...semanal, fim: '2026-11-20' }, '2026-11')).toEqual(['2026-11-06', '2026-11-13', '2026-11-20']);
  });
  it('gera uma por semana sem repetir as que já existem', () => {
    const novos = gerarPrevistosDoMes([semanal], '2026-11', [{ recorrenciaId: 'com', data: '2026-11-14', recorrenciaData: '2026-11-13' }], '2026-11-10');
    expect(novos.map((l) => [l.data, l.status])).toEqual([['2026-11-06', 'realizado'], ['2026-11-20', 'previsto'], ['2026-11-27', 'previsto']]);
    expect(novos[0].recorrenciaData).toBe('2026-11-06');
  });
  it('conta "3 de 10" e rótulos', () => {
    const dez = { ...semanal, fim: dataDaOcorrencia('2026-11-06', 'semanal', 10) };
    expect(dez.fim).toBe('2027-01-08');
    expect(numeroDaOcorrencia(dez, '2026-11-20')).toBe(3);
    expect(totalDeOcorrencias(dez)).toBe(10);
    expect(rotuloRepeticao(dez, '2026-11-20')).toBe('3 de 10');
    expect(rotuloRepeticao(semanal, '2026-11-20')).toBe('toda semana');
    expect(rotuloRepeticao({ ...semanal, frequencia: 'mensal', dataInicio: undefined }, '2026-11-06')).toBe('fixo');
    const mensal6 = { ...semanal, frequencia: 'mensal' as const, fim: dataDaOcorrencia('2026-11-06', 'mensal', 6) };
    expect(mensal6.fim).toBe('2027-04-06');
    expect(rotuloRepeticao(mensal6, '2027-01-06')).toBe('3 de 6');
  });
});

describe('cartão no saldo projetado', () => {
  const conta: Conta = { id: 'c1', nome: 'Nubank', tipo: 'corrente', saldoInicial: 300000, dataSaldoInicial: '2026-11-19' };
  const nubank = { id: 'k', nome: 'Nubank', limite: 500000, diaFechamento: 3, diaVencimento: 10, contaPagamentoId: 'c1' };
  const compra = (data: string, valor: number, extra: Partial<Lancamento> = {}) => lanc(data, 'saida', valor, { contaId: undefined, cartaoId: 'k', ...extra });

  it('vencimento da fatura', () => {
    expect(vencimentoDaFatura('2026-12', nubank)).toBe('2026-12-10');
    expect(vencimentoDaFatura('2026-11', { diaFechamento: 25, diaVencimento: 5 })).toBe('2026-12-05');
    expect(vencimentoDaFatura('2027-01', { diaFechamento: 28, diaVencimento: 31 })).toBe('2027-01-31');
  });
  it('próxima fatura a pagar', () => {
    expect(proximaFaturaAPagar('2026-11-05', nubank)).toBe('2026-11');   // fechou dia 3, vence dia 10
    expect(proximaFaturaAPagar('2026-11-19', nubank)).toBe('2026-12');   // a de novembro já venceu
    expect(proximaFaturaAPagar('2026-11-02', nubank)).toBe('2026-11');
  });
  it('compra de hoje sai da conta no vencimento da fatura', () => {
    const ls = [compra('2026-11-19', 30000)];
    const nov = saldosDoMes('2026-11', [conta], ls, [nubank]).dias;
    expect(nov[18].cartao).toBe(30000);
    expect(nov[29].saldo).toBe(300000);                  // novembro não muda
    const dez = saldosDoMes('2026-12', [conta], ls, [nubank]).dias;
    expect(dez[8].saldo).toBe(300000);
    expect(dez[9].faturas).toBe(30000);                  // 10/12
    expect(dez[9].saidas).toBe(30000);
    expect(dez[9].saldo).toBe(270000);
  });
  it('parcelado: cada parcela sai no vencimento da sua fatura', () => {
    const ls = [1, 2, 3].map((n) => compra(n === 1 ? '2026-11-19' : n === 2 ? '2026-12-19' : '2027-01-19', 10000, { faturaRef: n === 1 ? '2026-12' : n === 2 ? '2027-01' : '2027-02', parcela: { numero: n, total: 3, grupoId: 'g' } }));
    const fev = saldosDoMes('2027-02', [conta], ls, [nubank]).dias;
    expect(fev[0].saldo).toBe(280000);                   // dez e jan já saíram
    expect(fev[9].saldo).toBe(270000);                   // fevereiro sai a última
  });
  it('pagamento já feito reduz o que falta sair', () => {
    const ls = [compra('2026-11-19', 30000), lanc('2026-11-25', 'transferencia', 10000, { cartaoId: 'k', faturaRef: '2026-12', descricao: 'Fatura' })];
    const f = calcularFaturas(ls, [nubank]);
    expect(f[0]).toMatchObject({ total: 30000, pago: 10000, restante: 20000, vencimento: '2026-12-10' });
    expect(saldosDoMes('2026-11', [conta], ls, [nubank]).dias[24].saldo).toBe(290000);
    expect(saldosDoMes('2026-12', [conta], ls, [nubank]).dias[9].saldo).toBe(270000);
  });
  it('fatura anterior ao app também vence', () => {
    const ls = [compra('2026-11-19', 120000, { faturaRef: '2026-12', saldoAnterior: true })];
    expect(saldosDoMes('2026-12', [conta], ls, [nubank]).dias[9].saldo).toBe(180000);
  });
  it('saldo com entradas prováveis aparece à parte', () => {
    const ls = [lanc('2026-11-20', 'entrada', 50000, { certeza: 'provavel', status: 'previsto' }), lanc('2026-11-21', 'entrada', 10000)];
    const d = saldosDoMes('2026-11', [conta], ls).dias;
    expect(d[20].saldo).toBe(310000);
    expect(d[20].saldoComIncertas).toBe(360000);
  });
});
