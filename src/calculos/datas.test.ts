import { describe, expect, it } from 'vitest';
import { diasNoMes, diasRestantesNoMes, formatarData, mesDe, nomeDoMes, paraISO, somarMeses } from './datas';

describe('datas', () => {
  it('formata dd/mm/aaaa', () => expect(formatarData('2026-11-19')).toBe('19/11/2026'));
  it('converte Date local para ISO', () => expect(paraISO(new Date(2026, 0, 5))).toBe('2026-01-05'));
  it('extrai o mês', () => expect(mesDe('2026-11-19')).toBe('2026-11'));
  it('conta dias no mês, incluindo bissexto', () => {
    expect(diasNoMes('2026-11')).toBe(30);
    expect(diasNoMes('2028-02')).toBe(29);
    expect(diasNoMes('2026-02')).toBe(28);
  });
  it('soma meses atravessando o ano', () => {
    expect(somarMeses('2026-12', 1)).toBe('2027-01');
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
    expect(somarMeses('2026-11', 12)).toBe('2027-11');
  });
  it('dias restantes incluem hoje', () => {
    expect(diasRestantesNoMes('2026-11-19')).toBe(12);
    expect(diasRestantesNoMes('2026-11-30')).toBe(1);
  });
  it('nome do mês', () => expect(nomeDoMes('2026-03')).toBe('março de 2026'));
});
