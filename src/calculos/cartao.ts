// Fatura e parcelas de cartão.
import type { Cartao, Centavos, DataISO, Id, Lancamento, MesRef } from '../tipos';
import { mesDe, somarMeses, somarMesesNaData } from './datas';
import { dividirCentavos } from './dinheiro';
import { dataDaRecorrencia } from './recorrencias';

type DiasCartao = Pick<Cartao, 'diaFechamento' | 'diaVencimento'>;

/** Compra até o dia do fechamento cai na fatura do mês; depois, na do mês seguinte. */
export function faturaDaCompra(data: DataISO, diaFechamento: number): MesRef {
  const dia = Number(data.slice(8, 10));
  return dia <= diaFechamento ? mesDe(data) : somarMeses(mesDe(data), 1);
}

/**
 * Dia em que a fatura (identificada pelo mês em que fecha) vence.
 * Vencimento depois do fechamento: mesmo mês. Antes ou igual: mês seguinte.
 */
export function vencimentoDaFatura(faturaRef: MesRef, c: DiasCartao): DataISO {
  const mes = c.diaVencimento > c.diaFechamento ? faturaRef : somarMeses(faturaRef, 1);
  return dataDaRecorrencia(mes, c.diaVencimento);
}

/** Fatura em que o lançamento cai (usa a gravada; se não tiver, calcula pela data). */
export function faturaDoLancamento(l: Pick<Lancamento, 'faturaRef' | 'data'>, c: Pick<Cartao, 'diaFechamento'>): MesRef {
  return l.faturaRef ?? faturaDaCompra(l.data, c.diaFechamento);
}

/** A próxima fatura que você vai pagar: a já fechada que ainda não venceu, ou a que está aberta. */
export function proximaFaturaAPagar(hoje: DataISO, c: DiasCartao): MesRef {
  const aberta = faturaDaCompra(hoje, c.diaFechamento);
  const anterior = somarMeses(aberta, -1);
  return vencimentoDaFatura(anterior, c) >= hoje ? anterior : aberta;
}

export interface Fatura {
  cartaoId: Id;
  faturaRef: MesRef;
  vencimento: DataISO;
  /** Conta de onde sai o pagamento. */
  contaId: Id;
  total: Centavos;
  pago: Centavos;
  /** O que ainda vai sair da conta no vencimento. */
  restante: Centavos;
}

/**
 * Soma as faturas: compras (saídas com cartão) menos pagamentos (transferências com cartão e faturaRef).
 */
export function calcularFaturas(lancamentos: Lancamento[], cartoes: Cartao[]): Fatura[] {
  const porId = new Map(cartoes.map((c) => [c.id, c]));
  const mapa = new Map<string, Fatura>();
  const pegar = (c: Cartao, ref: MesRef) => {
    const k = `${c.id}|${ref}`;
    let f = mapa.get(k);
    if (!f) {
      f = { cartaoId: c.id, faturaRef: ref, vencimento: vencimentoDaFatura(ref, c), contaId: c.contaPagamentoId, total: 0, pago: 0, restante: 0 };
      mapa.set(k, f);
    }
    return f;
  };
  for (const l of lancamentos) {
    const c = l.cartaoId ? porId.get(l.cartaoId) : undefined;
    if (!c) continue;
    if (l.tipo === 'saida') pegar(c, faturaDoLancamento(l, c)).total += l.valor;
    else if (l.tipo === 'transferencia' && l.faturaRef) pegar(c, l.faturaRef).pago += l.valor;
  }
  return [...mapa.values()]
    .map((f) => ({ ...f, restante: Math.max(0, f.total - f.pago) }))
    .sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1));
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
