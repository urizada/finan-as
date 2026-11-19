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
