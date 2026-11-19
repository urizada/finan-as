import { describe, expect, it } from 'vitest';
import { dividirCentavos, formatarReais, textoParaCentavos } from './dinheiro';

describe('formatarReais', () => {
  it('formata no padrão R$ 1.234,56', () => {
    expect(formatarReais(123456)).toBe('R$ 1.234,56');
    expect(formatarReais(3200)).toBe('R$ 32,00');
    expect(formatarReais(5)).toBe('R$ 0,05');
    expect(formatarReais(10000000)).toBe('R$ 100.000,00');
  });
  it('formata negativos', () => {
    expect(formatarReais(-1850)).toBe('-R$ 18,50');
  });
  it('recusa valor não inteiro', () => {
    expect(() => formatarReais(10.5)).toThrow();
  });
});

describe('textoParaCentavos', () => {
  it.each([
    ['32', 3200],
    ['32,50', 3250],
    ['32,5', 3250],
    ['18,50', 1850],
    ['1.200', 120000],
    ['1200', 120000],
    ['1.200,99', 120099],
    ['R$ 2.500', 250000],
    ['0,01', 1],
  ])('%s → %i', (texto, esperado) => {
    expect(textoParaCentavos(texto)).toBe(esperado);
  });
  it.each(['', 'abc', '12,345', '1.20', '12.5'])('rejeita "%s"', (texto) => {
    expect(textoParaCentavos(texto)).toBeNull();
  });
});

describe('dividirCentavos', () => {
  it('divide sem perder centavos', () => {
    expect(dividirCentavos(60000, 3)).toEqual([20000, 20000, 20000]);
    expect(dividirCentavos(1000, 3)).toEqual([334, 333, 333]);
    expect(dividirCentavos(1000, 3).reduce((a, b) => a + b)).toBe(1000);
  });
});
