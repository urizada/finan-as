import { describe, expect, it } from 'vitest';
import { avisoDeLimite, estadoDoLimite, gastoPorCategoria } from './limites';
import { aporteMensalNecessario, calcularReserva, formatarMeses, saldoDaMeta, saldoDoInvestimento, situacaoGeral, statusDaMeta } from './metas';
import { efeitoNaConta, saldosDoMes } from './saldos';
import { livrePorDia, totaisDoMes } from './orcamento';
import type { Conta, Lancamento } from '../tipos';

let n = 0;
const lanc = (data: string, tipo: Lancamento['tipo'], valor: number, extra: Partial<Lancamento> = {}): Lancamento => ({
  id: `l${n++}`, tipo, valor, data, descricao: 'x', certeza: 'garantida', status: 'realizado', contaId: 'c1', ...extra,
});

describe('5.9 limites por categoria', () => {
  const ls = [
    lanc('2026-11-02', 'saida', 30000, { categoriaId: 'mercado' }),
    lanc('2026-11-10', 'saida', 42000, { categoriaId: 'mercado', contaId: undefined, cartaoId: 'k' }),
    lanc('2026-11-11', 'saida', 9999, { categoriaId: 'mercado', saldoAnterior: true }),
    lanc('2026-11-12', 'entrada', 50000, { categoriaId: 'mercado' }),
  ];
  it('soma gastos da categoria (conta + cartão), sem fatura antiga nem entrada', () => {
    expect(gastoPorCategoria(ls)).toEqual({ mercado: 72000 });
    expect(gastoPorCategoria(ls, ls[1].id)).toEqual({ mercado: 30000 });
  });
  it('estado', () => {
    expect(estadoDoLimite(72000, 80000)).toEqual({ estado: 'perto', pct: 90, restante: 8000 });
    expect(estadoDoLimite(50000, 80000).estado).toBe('ok');
    expect(estadoDoLimite(85000, 80000)).toMatchObject({ estado: 'estourado', restante: -5000 });
  });
  it('avisa antes de salvar quando fica perto ou passa', () => {
    expect(avisoDeLimite(72000, 15000, 80000)).toEqual({ antes: 72000, depois: 87000, limite: 80000, estado: 'estourado', acima: 7000, pct: 109 });
    expect(avisoDeLimite(60000, 5000, 80000)).toMatchObject({ estado: 'perto', acima: 0 });
    expect(avisoDeLimite(10000, 5000, 80000)).toBeNull();
    expect(avisoDeLimite(10000, 5000, undefined)).toBeNull();
  });
});

describe('5.4 reserva e fôlego', () => {
  it('meses de reserva, alvo e fôlego', () => {
    expect(calcularReserva(690000, 300000, 300000, 9)).toEqual({ saldo: 690000, alvo: 2700000, mesesAlvo: 9, meses: 2.3, folego: 3.3, pct: 26 });
    expect(formatarMeses(2.3)).toBe('2,3');
    expect(calcularReserva(100, 0, 0, 6)).toMatchObject({ meses: null, folego: null, alvo: 0 });
  });
});

describe('5.5 metas', () => {
  it('saldo da meta com aportes e retiradas até hoje', () => {
    const meta = { id: 'm', nome: 'Viagem', tipo: 'meta' as const, valorAlvo: 600000, saldoAtual: 50000 };
    const ls = [
      lanc('2026-10-05', 'transferencia', 100000, { destino: { tipo: 'meta', id: 'm' } }),
      lanc('2026-11-05', 'transferencia', 30000, { destino: { tipo: 'meta', id: 'm' }, retirada: true }),
      lanc('2026-12-05', 'transferencia', 100000, { destino: { tipo: 'meta', id: 'm' }, status: 'previsto' }),
    ];
    expect(saldoDaMeta(meta, ls, '2026-11-19')).toBe(120000);
  });
  it('aporte mensal necessário', () => {
    expect(aporteMensalNecessario(600000, 120000, '2026-11-19', '2027-05-19')).toBe(80000); // 6 meses
    expect(aporteMensalNecessario(600000, 700000, '2026-11-19', '2027-05-19')).toBe(0);
    expect(aporteMensalNecessario(600000, 0, '2026-11-19')).toBeNull();
  });
  it('status: no ritmo, atrasada, adiantada, concluída', () => {
    const args = ['2026-11-19', '2026-05-19', '2027-05-19'] as const; // metade do caminho → esperado 300.000
    expect(statusDaMeta(600000, 300000, ...args)).toBe('no ritmo');
    expect(statusDaMeta(600000, 200000, ...args)).toBe('atrasada');
    expect(statusDaMeta(600000, 400000, ...args)).toBe('adiantada');
    expect(statusDaMeta(600000, 600000, ...args)).toBe('concluida');
    expect(statusDaMeta(600000, 0, '2026-11-19')).toBeNull();
  });
});

describe('investimentos', () => {
  it('última atualização + aportes depois dela', () => {
    const inv = { id: 'cdb', nome: 'CDB', tipo: 'cdb' as const, instituicao: 'Banco', aporteMensalPlanejado: 0 };
    const snaps = [{ id: 's1', investimentoId: 'cdb', data: '2026-10-01', saldo: 100000 }, { id: 's2', investimentoId: 'cdb', data: '2026-11-01', saldo: 105000 }];
    const ls = [
      lanc('2026-10-15', 'transferencia', 50000, { destino: { tipo: 'investimento', id: 'cdb' } }), // antes da última atualização: já incluso
      lanc('2026-11-10', 'transferencia', 20000, { destino: { tipo: 'investimento', id: 'cdb' } }),
    ];
    expect(saldoDoInvestimento(inv, snaps, ls, '2026-11-19')).toEqual({ saldo: 125000, atualizadoEm: '2026-11-01' });
    expect(saldoDoInvestimento(inv, [], ls, '2026-11-19').saldo).toBe(70000);
  });
});

describe('retirada da reserva volta para a conta', () => {
  const conta: Conta = { id: 'c1', nome: 'N', tipo: 'corrente', saldoInicial: 100000, dataSaldoInicial: '2026-11-01' };
  const ls = [
    lanc('2026-11-05', 'transferencia', 40000, { destino: { tipo: 'meta', id: 'r' } }),
    lanc('2026-11-10', 'transferencia', 15000, { destino: { tipo: 'meta', id: 'r' }, retirada: true }),
  ];
  it('saldo, linha economia, livre e totais', () => {
    expect(efeitoNaConta(ls[1])).toBe(15000);
    const d = saldosDoMes('2026-11', [conta], ls).dias;
    expect(d[9]).toMatchObject({ economia: -15000, liquido: 15000, saldo: 75000 });
    expect(livrePorDia(ls, '2026-11-20').guardado).toBe(25000);
    expect(totaisDoMes(ls, '2026-11', '2026-11-20').guardado).toBe(25000);
  });
});

describe('situação geral', () => {
  const base = { livreHoje: 5000, aindaPossoHoje: 3000, saldoHoje: 100000, alertaDia: null, limitesEstourados: 0 };
  it('tranquilo, atenção, aperto', () => {
    expect(situacaoGeral(base).situacao).toBe('tranquilo');
    expect(situacaoGeral({ ...base, alertaDia: '2026-11-25' })).toEqual({ situacao: 'atencao', motivo: 'A conta fica negativa em 25/11.' });
    expect(situacaoGeral({ ...base, limitesEstourados: 2 }).motivo).toBe('2 categorias passaram do limite.');
    expect(situacaoGeral({ ...base, aindaPossoHoje: -1 }).situacao).toBe('atencao');
    expect(situacaoGeral({ ...base, livreHoje: -1 }).situacao).toBe('aperto');
    expect(situacaoGeral({ ...base, saldoHoje: -1 }).motivo).toBe('Sua conta está no negativo.');
  });
});
