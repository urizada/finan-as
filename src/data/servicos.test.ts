import { beforeEach, describe, expect, it } from 'vitest';
import { repositorio } from './repositorio';
import { gradeDoMes, pagarFatura, salvarFaturaAnterior } from './servicos';
import { hojeISO, mesDe, somarMeses } from '../calculos/datas';

beforeEach(async () => {
  const b = await repositorio.exportar();
  await repositorio.importar({ ...b, dados: { ...b.dados, config: [], contas: [], categorias: [], fontesRenda: [], lancamentos: [], recorrencias: [], cartoes: [], metas: [], investimentos: [], snapshotsInvestimento: [] } });
});

describe('grade do mês (serviço)', () => {
  it('mês futuro desconta os fixos dos meses do meio, mesmo sem abri-los', async () => {
    const hoje = hojeISO();
    const conta = await repositorio.contas.criar({ nome: 'Nubank', tipo: 'corrente', saldoInicial: 1000000, dataSaldoInicial: hoje });
    await repositorio.recorrencias.criar({ diaDoMes: 28, ativa: true, modelo: { tipo: 'saida', valor: 100000, descricao: 'Aluguel', contaId: conta.id } });
    const daqui3 = somarMeses(mesDe(hoje), 3);
    const g = await gradeDoMes(daqui3);
    // aluguel de 3 meses inteiros (+ o deste mês se o dia 28 ainda não passou)
    const esteMes = Number(hoje.slice(8, 10)) <= 28 ? 1 : 0;
    expect(g.dias[0].saldo).toBe(1000000 - 100000 * (2 + esteMes));
  });

  it('fatura anterior e pagamento', async () => {
    const hoje = hojeISO();
    const conta = await repositorio.contas.criar({ nome: 'Nubank', tipo: 'corrente', saldoInicial: 500000, dataSaldoInicial: hoje });
    const cartao = await repositorio.cartoes.criar({ nome: 'Nubank', limite: 500000, diaFechamento: 3, diaVencimento: 10, contaPagamentoId: conta.id });
    await salvarFaturaAnterior(cartao.id, 120000);
    await salvarFaturaAnterior(cartao.id, 150000); // atualiza, não duplica
    const todas = (await repositorio.lancamentos.listar()).filter((l) => l.saldoAnterior);
    expect(todas).toHaveLength(1);
    const ref = todas[0].faturaRef!;
    const venc = `${ref}-10` >= hoje ? ref : somarMeses(ref, 0);
    const g = await gradeDoMes(mesDe(`${venc}-10`));
    const f = g.faturas[0];
    expect(f.restante).toBe(150000);
    await pagarFatura(f);
    const g2 = await gradeDoMes(mesDe(f.vencimento));
    expect(g2.faturas[0].restante).toBe(0);
    expect(g2.dias[g2.dias.length - 1].saldo).toBe(350000);
  });
});

import { criarLancamento, excluirLancamento, garantirFixosDoMes } from './servicos';

describe('excluir com escopo', () => {
  async function repeticao() {
    const hoje = hojeISO();
    const conta = await repositorio.contas.criar({ nome: 'C', tipo: 'corrente', saldoInicial: 0, dataSaldoInicial: hoje });
    await criarLancamento({ tipo: 'saida', valor: 1000, data: hoje, descricao: 'Academia', contaId: conta.id, certeza: 'garantida', status: 'realizado' },
      { repeticao: { frequencia: 'semanal', vezes: null } });
    const m = mesDe(hoje);
    for (const x of [m, somarMeses(m, 1)]) await garantirFixosDoMes(x);
    return (await repositorio.lancamentos.listar()).sort((a, b) => (a.data < b.data ? -1 : 1));
  }
  it('só esta vez: não volta ao abrir o mês de novo', async () => {
    const ls = await repeticao();
    const alvo = ls[1];
    await excluirLancamento(alvo, 'este');
    await garantirFixosDoMes(mesDe(alvo.data));
    const depois = await repositorio.lancamentos.listar();
    expect(depois.find((l) => l.data === alvo.data)).toBeUndefined();
    expect(depois).toHaveLength(ls.length - 1);
  });
  it('esta e as próximas: corta a repetição', async () => {
    const ls = await repeticao();
    await excluirLancamento(ls[2], 'proximos');
    await garantirFixosDoMes(somarMeses(mesDe(hojeISO()), 2));
    const depois = await repositorio.lancamentos.listar();
    expect(depois.map((l) => l.data).sort()).toEqual([ls[0].data, ls[1].data]);
  });
  it('todas: some a repetição inteira', async () => {
    const ls = await repeticao();
    await excluirLancamento(ls[0], 'todos');
    expect(await repositorio.lancamentos.listar()).toHaveLength(0);
    expect(await repositorio.recorrencias.listar()).toHaveLength(0);
  });
  it('parcelas: só esta, esta e as próximas, todas', async () => {
    const hoje = hojeISO();
    const conta = await repositorio.contas.criar({ nome: 'C', tipo: 'corrente', saldoInicial: 0, dataSaldoInicial: hoje });
    const k = await repositorio.cartoes.criar({ nome: 'K', limite: 100000, diaFechamento: 3, diaVencimento: 10, contaPagamentoId: conta.id });
    await criarLancamento({ tipo: 'saida', valor: 6000, data: hoje, descricao: 'TV', cartaoId: k.id, certeza: 'garantida', status: 'realizado' }, { parcelas: 6 });
    const ps = () => repositorio.lancamentos.listar().then((x) => x.map((l) => l.parcela!.numero).sort((a, b) => a - b));
    const pega = async (n: number) => (await repositorio.lancamentos.listar()).find((l) => l.parcela!.numero === n)!;
    await excluirLancamento(await pega(2), 'este');
    expect(await ps()).toEqual([1, 3, 4, 5, 6]);
    await excluirLancamento(await pega(5), 'proximos');
    expect(await ps()).toEqual([1, 3, 4]);
    await excluirLancamento(await pega(1), 'todos');
    expect(await ps()).toEqual([]);
  });
});

import { resumoHoje, sugerirDivisao } from './servicos';
import { diasRestantesNoMes, diasNoMes } from '../calculos/datas';

describe('tela Hoje (serviço)', () => {
  it('primeiro mês: o saldo informado entra no livre por dia, fixos e fatura antiga saem', async () => {
    const hoje = hojeISO();
    const conta = await repositorio.contas.criar({ nome: 'C', tipo: 'corrente', saldoInicial: 300000, dataSaldoInicial: hoje });
    await repositorio.salvarConfig({ contaPadraoId: conta.id, onboardingConcluido: true });
    const ultimoDia = diasNoMes(mesDe(hoje));
    await repositorio.recorrencias.criar({ diaDoMes: ultimoDia, ativa: true, modelo: { tipo: 'saida', valor: 120000, descricao: 'Aluguel', contaId: conta.id } });
    const r = await resumoHoje();
    expect(r.livre.partida).toBe(300000);
    expect(r.livre.fixos).toBe(120000);
    expect(r.livre.livreHoje).toBe(Math.floor(180000 / diasRestantesNoMes(hoje)));
    expect(r.saldoHoje.total).toBe(300000);
    expect(r.fimDoMes).toBe(180000);
    expect(r.alerta).toBeNull();
    expect(r.chegando.some((c) => c.lancamento?.descricao === 'Aluguel')).toBe(diasRestantesNoMes(hoje) <= 11);
  });
  it('divisão: completa os fixos que faltam e divide o resto', async () => {
    const hoje = hojeISO();
    const conta = await repositorio.contas.criar({ nome: 'C', tipo: 'corrente', saldoInicial: 0, dataSaldoInicial: hoje });
    await repositorio.recorrencias.criar({ diaDoMes: diasNoMes(mesDe(hoje)), ativa: true, modelo: { tipo: 'saida', valor: 100000, descricao: 'Aluguel', contaId: conta.id } });
    await criarLancamento({ tipo: 'entrada', valor: 500000, data: hoje, descricao: 'Comissão', contaId: conta.id, certeza: 'garantida', status: 'realizado' });
    const d = await sugerirDivisao(500000);
    expect(d.fixos).toBe(100000);
    expect(d.fixos + d.reserva + d.investimentos + d.metas + d.livre).toBe(500000);
    expect(d.reserva).toBe(80000);
  });
});

import { movimentarDestino, patrimonio, verificarLimite } from './servicos';

describe('fase 6 (serviço)', () => {
  it('avisa limite ao lançar e ignora o próprio lançamento ao editar', async () => {
    const hoje = hojeISO();
    const conta = await repositorio.contas.criar({ nome: 'C', tipo: 'corrente', saldoInicial: 0, dataSaldoInicial: hoje });
    const cat = await repositorio.categorias.criar({ nome: 'Mercado', tipo: 'saida', icone: '🛒', cor: '#000', palavrasChave: [], limiteMensal: 80000 });
    const l = await repositorio.lancamentos.criar({ tipo: 'saida', valor: 70000, data: hoje, descricao: 'Mercado', categoriaId: cat.id, contaId: conta.id, certeza: 'garantida', status: 'realizado' });
    expect(await verificarLimite(cat.id, hoje, 5000)).toMatchObject({ estado: 'perto', depois: 75000 });
    expect(await verificarLimite(cat.id, hoje, 20000)).toMatchObject({ estado: 'estourado', acima: 10000 });
    expect(await verificarLimite(cat.id, hoje, 70000, l.id)).toMatchObject({ estado: 'perto', depois: 70000 });
    expect(await verificarLimite(cat.id, hoje, 1000, l.id)).toBeNull();
  });
  it('reserva em meses e fôlego', async () => {
    const hoje = hojeISO();
    const conta = await repositorio.contas.criar({ nome: 'C', tipo: 'corrente', saldoInicial: 600000, dataSaldoInicial: hoje });
    await repositorio.salvarConfig({ contaPadraoId: conta.id, mesesReservaAlvo: 6 });
    await repositorio.recorrencias.criar({ diaDoMes: 1, ativa: true, modelo: { tipo: 'saida', valor: 200000, descricao: 'Aluguel', contaId: conta.id } });
    const p0 = await patrimonio();
    await movimentarDestino({ tipo: 'meta', id: p0.reserva.meta.id, nome: 'Reserva' }, 300000);
    const p = await patrimonio();
    expect(p.custoFixo).toBe(200000);
    expect(p.reserva).toMatchObject({ saldo: 300000, meses: 1.5, alvo: 1200000, folego: 3 });
  });
});

import { configurarRenda } from './servicos';

describe('renda configurada na primeira abertura', () => {
  it('salário todo mês e comissão toda semana já gerados para 12 meses', async () => {
    const hoje = hojeISO();
    const conta = await repositorio.contas.criar({ nome: 'C', tipo: 'corrente', saldoInicial: 0, dataSaldoInicial: hoje });
    await configurarRenda({ tipo: 'salario', porRecebimento: 250000, mensal: 250000, frequencia: 'mensal', dataInicio: hoje, contaId: conta.id });
    await configurarRenda({ tipo: 'comissao', porRecebimento: 30000, mensal: 130000, frequencia: 'semanal', dataInicio: hoje, contaId: conta.id });
    const todos = await repositorio.lancamentos.listar();
    const meses = (desc: string) => new Set(todos.filter((l) => l.descricao === desc).map((l) => mesDe(l.data)));
    expect(meses('Salário').size).toBe(13);                    // este mês + 12
    expect(meses('Comissão').size).toBe(13);
    const em3 = somarMeses(mesDe(hoje), 3);
    expect(todos.filter((l) => l.descricao === 'Comissão' && l.data.startsWith(em3)).length).toBeGreaterThanOrEqual(4);
    expect(todos.find((l) => l.descricao === 'Comissão' && l.data > hoje)?.certeza).toBe('garantida');
    expect(todos.find((l) => l.descricao === 'Salário' && l.data > hoje)?.certeza).toBe('garantida');
    // refazer não duplica
    await configurarRenda({ tipo: 'salario', porRecebimento: 300000, mensal: 300000, frequencia: 'mensal', dataInicio: hoje, contaId: conta.id });
    const salarios = (await repositorio.lancamentos.listar()).filter((l) => l.descricao === 'Salário' && l.data.startsWith(em3));
    expect(salarios.map((l) => l.valor)).toEqual([300000]);
  });
});

describe('livre no primeiro mês', () => {
  it('fixo com dia antes do início do uso não desconta de novo', async () => {
    const hoje = hojeISO();
    const conta = await repositorio.contas.criar({ nome: 'C', tipo: 'corrente', saldoInicial: 100000, dataSaldoInicial: hoje });
    await repositorio.salvarConfig({ contaPadraoId: conta.id, onboardingConcluido: true });
    const dia = Number(hoje.slice(8, 10));
    if (dia > 1) {
      await repositorio.recorrencias.criar({ diaDoMes: dia - 1, ativa: true, modelo: { tipo: 'saida', valor: 150000, descricao: 'Aluguel', contaId: conta.id } });
      const r = await resumoHoje();
      expect(r.livre.fixos).toBe(0);
      expect(r.livre.livreHoje).toBeGreaterThan(0);
    }
  });
});

import { simplificarEntradasAntigas } from './servicos';
describe('entradas simples', () => {
  it('entrada nova sempre conta como recebida e as antigas são convertidas', async () => {
    const hoje = hojeISO();
    const c = await repositorio.contas.criar({ nome: 'C', tipo: 'corrente', saldoInicial: 0, dataSaldoInicial: hoje });
    await criarLancamento({ tipo: 'entrada', valor: 100, data: hoje, descricao: 'x', contaId: c.id, certeza: 'possivel', status: 'previsto' });
    expect((await repositorio.lancamentos.listar())[0]).toMatchObject({ certeza: 'garantida', status: 'realizado' });
    await repositorio.lancamentos.criar({ tipo: 'entrada', valor: 100, data: '2020-01-01', descricao: 'antiga', contaId: c.id, certeza: 'provavel', status: 'previsto' });
    await simplificarEntradasAntigas();
    expect((await repositorio.lancamentos.listar()).every((l) => l.certeza === 'garantida')).toBe(true);
  });
});
