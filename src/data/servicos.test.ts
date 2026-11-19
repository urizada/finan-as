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
