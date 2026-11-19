import { describe, expect, it } from 'vitest';
import { digitosParaCentavos, formatarTaxa, textoParaTaxa } from './dinheiro';
import { normalizar, separarPalavrasChave } from './texto';
import { CATEGORIAS_PADRAO, PERFIS, limitarMesesReserva } from './padroes';
import { validarCartao, validarCategoria, validarConta, validarFonte, validarRecorrencia, valido } from './validacoes';
import type { Categoria } from '../tipos';

describe('digitosParaCentavos', () => {
  it.each([
    ['', 0], ['1', 1], ['12', 12], ['123456', 123456], ['R$ 1.234,56', 123456], ['000150', 150],
  ])('"%s" → %i', (t, c) => expect(digitosParaCentavos(t)).toBe(c));
});

describe('taxa de comissão', () => {
  it.each([['3,5', 0.035], ['3.5%', 0.035], ['10', 0.1], ['0,25', 0.0025]])('"%s" → %f', (t, v) => {
    expect(textoParaTaxa(t)).toBeCloseTo(v, 10);
  });
  it.each(['', 'abc', '101', '-2'])('rejeita "%s"', (t) => expect(textoParaTaxa(t)).toBeNull());
  it('formata', () => expect(formatarTaxa(0.035)).toBe('3,5%'));
});

describe('texto', () => {
  it('normaliza acentos e caixa', () => expect(normalizar('  Comissão  Extra ')).toBe('comissao extra'));
  it('separa palavras-chave', () =>
    expect(separarPalavrasChave('Uber, 99 ,Gasolina,, uber')).toEqual(['uber', '99', 'gasolina']));
});

describe('padrões', () => {
  it('cada perfil tem reserva dentro da própria faixa', () => {
    for (const p of Object.values(PERFIS)) {
      expect(p.mesesReservaAlvo).toBeGreaterThanOrEqual(p.faixaReserva[0]);
      expect(p.mesesReservaAlvo).toBeLessThanOrEqual(p.faixaReserva[1]);
    }
  });
  it('variável pede mais reserva que fixa', () =>
    expect(PERFIS.variavel.mesesReservaAlvo).toBeGreaterThan(PERFIS.fixa.mesesReservaAlvo));
  it('categorias padrão têm nomes únicos e palavras normalizadas', () => {
    const nomes = CATEGORIAS_PADRAO.map((c) => `${c.tipo}:${c.nome}`);
    expect(new Set(nomes).size).toBe(nomes.length);
    for (const c of CATEGORIAS_PADRAO) for (const p of c.palavrasChave) expect(p).toBe(normalizar(p));
  });
  it('uma palavra-chave não aponta para duas categorias de saída', () => {
    const vistas = new Map<string, string>();
    for (const c of CATEGORIAS_PADRAO.filter((c) => c.tipo === 'saida'))
      for (const p of c.palavrasChave) {
        expect(vistas.get(p), `"${p}" repetida`).toBeUndefined();
        vistas.set(p, c.nome);
      }
  });
  it('limita meses de reserva', () => {
    expect(limitarMesesReserva(0)).toBe(1);
    expect(limitarMesesReserva(30)).toBe(24);
    expect(limitarMesesReserva(6.4)).toBe(6);
  });
});

describe('validações', () => {
  it('conta', () => {
    expect(valido(validarConta({ nome: 'Nubank', saldoInicial: 0 }))).toBe(true);
    expect(validarConta({ nome: ' ', saldoInicial: 0 }).nome).toBeTruthy();
  });
  it('cartão', () => {
    const ok = { nome: 'Nubank', limite: 500000, diaFechamento: 3, diaVencimento: 10, contaPagamentoId: 'c1' };
    expect(valido(validarCartao(ok))).toBe(true);
    expect(validarCartao({ ...ok, diaFechamento: 32 }).diaFechamento).toBeTruthy();
    expect(validarCartao({ ...ok, diaVencimento: 3 }).diaVencimento).toBeTruthy();
    expect(validarCartao({ ...ok, contaPagamentoId: '' }).contaPagamentoId).toBeTruthy();
  });
  it('fonte de renda', () => {
    expect(valido(validarFonte({ nome: 'Comissão', valorMedioMensal: 500000, taxaComissao: 0.035 }))).toBe(true);
    expect(validarFonte({ nome: 'X', valorMedioMensal: 0, taxaComissao: 0 }).taxaComissao).toBeTruthy();
  });
  it('recorrência', () => {
    const ok = { diaDoMes: 5, ativa: true, modelo: { descricao: 'Aluguel', valor: 150000, contaId: 'c1' } };
    expect(valido(validarRecorrencia(ok))).toBe(true);
    expect(validarRecorrencia({ ...ok, diaDoMes: 0 }).diaDoMes).toBeTruthy();
    expect(validarRecorrencia({ ...ok, modelo: { ...ok.modelo, contaId: undefined } }).contaId).toBeTruthy();
  });
  it('categoria não repete nome', () => {
    const existentes = [{ id: '1', nome: 'Mercado', tipo: 'saida' }] as Categoria[];
    expect(validarCategoria({ nome: 'mercado ', tipo: 'saida' }, existentes).nome).toBeTruthy();
    expect(valido(validarCategoria({ id: '1', nome: 'Mercado', tipo: 'saida' }, existentes))).toBe(true);
    expect(valido(validarCategoria({ nome: 'Mercado', tipo: 'entrada' }, existentes))).toBe(true);
  });
});
