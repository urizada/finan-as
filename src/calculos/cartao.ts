// Fatura e parcelas de cartão (a tela de cartões completa vem na Fase 4).
import type { Centavos, DataISO, Id, Lancamento, MesRef } from '../tipos';
import { mesDe, somarMeses, somarMesesNaData } from './datas';
import { dividirCentavos } from './dinheiro';

/** Compra até o dia do fechamento cai na fatura do mês; depois, na do mês seguinte. */
export function faturaDaCompra(data: DataISO, diaFechamento: number): MesRef {
  const dia = Number(data.slice(8, 10));
  return dia <= diaFechamento ? mesDe(data) : somarMeses(mesDe(data), 1);
}

/**
 * Divide uma compra em N parcelas, uma por fatura. A parcela k tem competência k−1 meses depois da compra.
 * O resto dos centavos vai para as primeiras parcelas.
 */
export function gerarParcelas(
  compra: Omit<Lancamento, 'id' | 'parcela' | 'faturaRef'> & { cartaoId: Id },
  total: number,
  diaFechamento: number,
  grupoId: Id,
): Omit<Lancamento, 'id'>[] {
  const valores: Centavos[] = dividirCentavos(compra.valor, total);
  const primeiraFatura = faturaDaCompra(compra.data, diaFechamento);
  return valores.map((valor, i) => ({
    ...compra,
    valor,
    data: somarMesesNaData(compra.data, i),
    faturaRef: somarMeses(primeiraFatura, i),
    parcela: { numero: i + 1, total, grupoId },
  }));
}
