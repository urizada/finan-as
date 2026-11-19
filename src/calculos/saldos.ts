// Saldo projetado da conta, dia a dia (tela Saldos).
import type { Centavos, Conta, DataISO, Lancamento, MesRef } from '../tipos';
import { diasNoMes } from './datas';

export type EstadoSaldo = 'ok' | 'apertado' | 'negativo';

export interface SaldoDia {
  data: DataISO;
  dia: number;
  /** Todas as entradas do dia (qualquer certeza). */
  entradas: Centavos;
  /** Parte das entradas que ainda é provável/possível (não conta no saldo). */
  entradasIncertas: Centavos;
  /** Saídas que saem da conta (inclui fixos pagos pela conta). */
  saidas: Centavos;
  /** Compras no cartão (não mexem na conta até a fatura). */
  cartao: Centavos;
  /** Fixos do dia (conta ou cartão). */
  fixos: Centavos;
  /** Há fixo do dia ainda não marcado como pago. */
  fixoPendente: boolean;
  /** Saldo somado das contas no fim do dia; null antes de você começar a usar o app. */
  saldo: Centavos | null;
  estado: EstadoSaldo | null;
}

/**
 * Quanto o lançamento muda o saldo das contas.
 * - Compra no cartão: nada (o dinheiro só sai no pagamento da fatura).
 * - Entrada só conta se for garantida: o dia a dia usa apenas o que é certo.
 * - Transferência (pagamento de fatura, aporte): sai da conta.
 */
export function efeitoNaConta(l: Lancamento): Centavos {
  if (!l.contaId) return 0;
  if (l.tipo === 'entrada') return l.certeza === 'garantida' ? l.valor : 0;
  if (l.tipo === 'saida') return l.cartaoId ? 0 : -l.valor;
  return -l.valor;
}

/**
 * Amarelo quando o saldo do dia não cobre o que ainda sai da conta até o fim do mês;
 * vermelho quando está negativo.
 */
export function estadoDoSaldo(saldo: Centavos, aSairDepois: Centavos): EstadoSaldo {
  if (saldo < 0) return 'negativo';
  if (saldo < aSairDepois) return 'apertado';
  return 'ok';
}

/**
 * Monta a grade do mês. `lancamentos` precisa ter tudo desde o primeiro saldo inicial até o fim do mês.
 * O saldo de cada conta começa no seu saldoInicial e soma os lançamentos a partir de dataSaldoInicial (inclusive).
 */
export function saldosDoMes(mes: MesRef, contas: Conta[], lancamentos: Lancamento[]): SaldoDia[] {
  const n = diasNoMes(mes);
  const inicioDe = new Map(contas.map((c) => [c.id, c.dataSaldoInicial]));
  const conta = (l: Lancamento) => (l.contaId ? inicioDe.get(l.contaId) : undefined);
  const primeiroInicio = contas.reduce<DataISO | null>((m, c) => (m === null || c.dataSaldoInicial < m ? c.dataSaldoInicial : m), null);
  const inicioMes = `${mes}-01`;

  // Saldo das contas na virada para o mês.
  let saldo = contas.filter((c) => c.dataSaldoInicial < inicioMes).reduce((s, c) => s + c.saldoInicial, 0);
  for (const l of lancamentos) {
    const ini = conta(l);
    if (ini && l.data >= ini && l.data < inicioMes) saldo += efeitoNaConta(l);
  }

  const doMes = lancamentos.filter((l) => l.data.startsWith(mes));
  const porDia = new Map<DataISO, Lancamento[]>();
  for (const l of doMes) porDia.set(l.data, [...(porDia.get(l.data) ?? []), l]);

  // Quanto ainda sai das contas depois de cada dia (para o amarelo).
  const saidaDoDia = (data: DataISO) =>
    (porDia.get(data) ?? []).reduce((s, l) => { const ini = conta(l); const e = ini && l.data >= ini ? efeitoNaConta(l) : 0; return s + (e < 0 ? -e : 0); }, 0);

  const dias: SaldoDia[] = [];
  const datas = Array.from({ length: n }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
  let aSairDepois = datas.reduce((s, d) => s + saidaDoDia(d), 0);

  for (const [i, data] of datas.entries()) {
    for (const c of contas) if (c.dataSaldoInicial === data) saldo += c.saldoInicial;
    const ls = porDia.get(data) ?? [];
    let entradas = 0, entradasIncertas = 0, saidas = 0, cartao = 0, fixos = 0, fixoPendente = false;
    for (const l of ls) {
      const ini = conta(l);
      if (ini && l.data >= ini) saldo += efeitoNaConta(l);
      if (l.tipo === 'entrada') {
        entradas += l.valor;
        if (l.certeza !== 'garantida') entradasIncertas += l.valor;
      } else if (l.tipo === 'saida') {
        if (l.cartaoId) cartao += l.valor;
        else saidas += l.valor;
        if (l.recorrenciaId) {
          fixos += l.valor;
          if (l.status === 'previsto') fixoPendente = true;
        }
      }
    }
    aSairDepois -= saidaDoDia(data);
    const comecou = primeiroInicio !== null && data >= primeiroInicio;
    dias.push({
      data, dia: i + 1, entradas, entradasIncertas, saidas, cartao, fixos, fixoPendente,
      saldo: comecou ? saldo : null,
      estado: comecou ? estadoDoSaldo(saldo, aSairDepois) : null,
    });
  }
  return dias;
}
