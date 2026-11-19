// Regras dos lançamentos: validação, filtros e agrupamento por dia.
import type { Centavos, DataISO, Id, Lancamento } from '../tipos';
import type { Erros } from './validacoes';

export function validarLancamento(l: Partial<Lancamento>): Erros {
  const e: Erros = {};
  if (!Number.isInteger(l.valor) || (l.valor ?? 0) <= 0) e.valor = 'Informe o valor.';
  if (!l.descricao?.trim()) e.descricao = 'Diga o que foi, ex.: Almoço.';
  if (!l.data || !/^\d{4}-\d{2}-\d{2}$/.test(l.data)) e.data = 'Escolha a data.';
  if (!l.contaId && !l.cartaoId) e.contaId = 'Escolha a conta ou o cartão.';
  if (l.tipo === 'entrada' && l.cartaoId) e.contaId = 'Entrada cai numa conta, não no cartão.';
  return e;
}

/** Status sugerido: o que é futuro ou incerto fica como previsto. */
export function statusSugerido(data: DataISO, hoje: DataISO, certeza: Lancamento['certeza']): Lancamento['status'] {
  return data > hoje || certeza !== 'garantida' ? 'previsto' : 'realizado';
}

export interface Filtros {
  tipo?: 'entrada' | 'saida';
  categoriaId?: Id;
  cartaoId?: Id;
}

export function filtrarLancamentos(ls: Lancamento[], f: Filtros): Lancamento[] {
  return ls.filter((l) =>
    (!f.tipo || l.tipo === f.tipo) &&
    (!f.categoriaId || l.categoriaId === f.categoriaId) &&
    (!f.cartaoId || l.cartaoId === f.cartaoId));
}

export interface GrupoDia {
  data: DataISO;
  itens: Lancamento[];
  entradas: Centavos;
  saidas: Centavos;
}

/** Agrupa por dia, do mais recente para o mais antigo; dentro do dia, entradas primeiro. */
export function agruparPorDia(ls: Lancamento[]): GrupoDia[] {
  const mapa = new Map<DataISO, Lancamento[]>();
  for (const l of ls) mapa.set(l.data, [...(mapa.get(l.data) ?? []), l]);
  return [...mapa.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([data, itens]) => ({
      data,
      itens: [...itens].sort((a, b) => (a.tipo === b.tipo ? b.valor - a.valor : a.tipo === 'entrada' ? -1 : 1)),
      entradas: itens.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0),
      saidas: itens.filter((l) => l.tipo !== 'entrada').reduce((s, l) => s + l.valor, 0),
    }));
}
