import { describe, expect, it } from 'vitest';
import { necessarioParaFixos, temComissao, temSalario, valorPorRecebimento } from './renda';

describe('renda na configuração', () => {
  it('perfis', () => {
    expect([temSalario('fixa'), temComissao('fixa')]).toEqual([true, false]);
    expect([temSalario('variavel'), temComissao('variavel')]).toEqual([false, true]);
    expect([temSalario('mista'), temComissao('mista')]).toEqual([true, true]);
    expect([temSalario('autonoma'), temComissao('autonoma')]).toEqual([false, true]);
  });
  it('valor por recebimento', () => {
    expect(valorPorRecebimento(520000, 'semanal')).toBe(120000);
    expect(valorPorRecebimento(260000, 'quinzenal')).toBe(120000);
    expect(valorPorRecebimento(300000, 'mensal')).toBe(300000);
  });
  it('quanto precisa entrar', () => {
    expect(necessarioParaFixos(350000, 0, 300000)).toEqual({ porMes: 350000, porSemana: 80770, sobraNoMesFraco: -50000 });
    expect(necessarioParaFixos(350000, 200000, 300000)).toEqual({ porMes: 150000, porSemana: 34616, sobraNoMesFraco: 150000 });
    expect(necessarioParaFixos(100000, 200000).porMes).toBe(0);
  });
});
