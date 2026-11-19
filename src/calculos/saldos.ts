// Saldo projetado das contas, dia a dia (tela Saldos).
import type { Cartao, Centavos, Conta, DataISO, Lancamento, MesRef } from '../tipos';
import { calcularFaturas, type Fatura } from './cartao';
import { diasNoMes } from './datas';

export type EstadoSaldo = 'ok' | 'apertado' | 'negativo';

export interface SaldoDia {
  data: DataISO;
  dia: number;
  /** Todas as entradas do dia (qualquer certeza). */
  entradas: Centavos;
  /** Parte das entradas marcada como "talvez" (não conta no saldo). */
  entradasIncertas: Centavos;
  /** Gastos do dia a dia que saem da conta (não fixos, não cartão). */
  diario: Centavos;
  /** Fixos (contas que se repetem) que saem da conta no dia. */
  fixos: Centavos;
  /** Dinheiro guardado no dia (reserva, metas), avulso ou repetido. */
  economia: Centavos;
  /** Cartão que sai da conta no dia: faturas que vencem + pagamentos de fatura feitos no dia. */
  faturas: Centavos;
  /** Compras feitas no cartão no dia (só informativo: saem da conta na fatura). */
  cartao: Centavos;
  /** Quanto o saldo mudou no dia = entradas que contam − dia a dia − fixos − economia − faturas. */
  liquido: Centavos;
  /** Há fixo do dia ainda não marcado como pago. */
  fixoPendente: boolean;
  /** Saldo somado das contas no fim do dia; null antes de você começar a usar o app. */
  saldo: Centavos | null;
  /** Saldo se as entradas "talvez" também caírem. */
  saldoComIncertas: Centavos | null;
  estado: EstadoSaldo | null;
}

/**
 * Quanto o lançamento muda o saldo das contas.
 * - Compra no cartão: nada agora; sai da conta no vencimento da fatura.
 * - Entrada certa ou provável conta (é a previsão); "talvez" (possível) fica de fora.
 *   O "livre para gastar hoje" (5.1) usa só o garantido; este saldo é a projeção da conta.
 * - Transferência (pagamento de fatura, aporte): sai da conta.
 */
export function efeitoNaConta(l: Lancamento): Centavos {
  if (!l.contaId) return 0;
  if (l.tipo === 'entrada') return l.certeza === 'possivel' ? 0 : l.valor;
  if (l.tipo === 'saida') return l.cartaoId ? 0 : -l.valor;
  return -l.valor;
}

/** Amarelo quando o saldo não cobre o que ainda sai da conta até o fim do mês; vermelho quando negativo. */
export function estadoDoSaldo(saldo: Centavos, aSairDepois: Centavos): EstadoSaldo {
  if (saldo < 0) return 'negativo';
  if (saldo < aSairDepois) return 'apertado';
  return 'ok';
}

interface Movimento { data: DataISO; efeito: Centavos; incerto: Centavos }

/**
 * Monta a grade do mês.
 * `lancamentos` precisa ter tudo desde o primeiro saldo inicial até o fim do mês.
 * Cada conta começa no saldoInicial e soma os movimentos a partir de dataSaldoInicial (inclusive).
 * Faturas de cartão saem da conta de pagamento no vencimento (o que ainda não foi pago).
 */
export interface ResumoMes {
  /** Saldo das contas na virada para o mês (ou no dia em que começou a usar o app). */
  inicio: Centavos;
  /** Entradas que entraram no saldo (certas e prováveis). */
  entradas: Centavos;
  /** Tudo o que saiu das contas: gastos, fixos, faturas e economias. */
  saidas: Centavos;
  /** Parte das saídas que é pagamento de fatura. */
  faturas: Centavos;
  fim: Centavos;
  /** Entradas "talvez" do mês (fora do saldo). */
  talvez: Centavos;
}

export function saldosDoMes(mes: MesRef, contas: Conta[], lancamentos: Lancamento[], cartoes: Cartao[] = []): { dias: SaldoDia[]; faturas: Fatura[]; resumo: ResumoMes | null } {
  const n = diasNoMes(mes);
  const inicioDe = new Map(contas.map((c) => [c.id, c.dataSaldoInicial]));
  const valeNaConta = (contaId: string | undefined, data: DataISO) => {
    const ini = contaId ? inicioDe.get(contaId) : undefined;
    return !!ini && data >= ini;
  };
  const primeiroInicio = contas.reduce<DataISO | null>((m, c) => (m === null || c.dataSaldoInicial < m ? c.dataSaldoInicial : m), null);
  const inicioMes = `${mes}-01`;
  const fimMes = `${mes}-${String(n).padStart(2, '0')}`;

  const faturas = calcularFaturas(lancamentos, cartoes);
  const movimentos: Movimento[] = [];
  for (const l of lancamentos) {
    if (!valeNaConta(l.contaId, l.data)) continue;
    movimentos.push({ data: l.data, efeito: efeitoNaConta(l), incerto: l.tipo === 'entrada' && l.certeza === 'possivel' ? l.valor : 0 });
  }
  for (const f of faturas) {
    if (f.restante > 0 && valeNaConta(f.contaId, f.vencimento)) movimentos.push({ data: f.vencimento, efeito: -f.restante, incerto: 0 });
  }

  // Saldo na virada para o mês.
  let saldo = contas.filter((c) => c.dataSaldoInicial < inicioMes).reduce((s, c) => s + c.saldoInicial, 0);
  let incertas = 0;
  for (const m of movimentos) if (m.data < inicioMes) { saldo += m.efeito; incertas += m.incerto; }

  const porDia = new Map<DataISO, Movimento[]>();
  for (const m of movimentos) if (m.data >= inicioMes && m.data <= fimMes) porDia.set(m.data, [...(porDia.get(m.data) ?? []), m]);
  const saidaDoDia = (d: DataISO) => (porDia.get(d) ?? []).reduce((s, m) => s + (m.efeito < 0 ? -m.efeito : 0), 0);

  const doMes = lancamentos.filter((l) => l.data >= inicioMes && l.data <= fimMes);
  const lancsDoDia = new Map<DataISO, Lancamento[]>();
  for (const l of doMes) lancsDoDia.set(l.data, [...(lancsDoDia.get(l.data) ?? []), l]);
  const faturasDoDia = new Map<DataISO, Centavos>();
  for (const f of faturas) if (f.restante > 0 && valeNaConta(f.contaId, f.vencimento)) faturasDoDia.set(f.vencimento, (faturasDoDia.get(f.vencimento) ?? 0) + f.restante);

  const datas = Array.from({ length: n }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
  let resumo: ResumoMes | null = null;
  const abrir = () => { resumo ??= { inicio: saldo, entradas: 0, saidas: 0, faturas: 0, fim: 0, talvez: 0 }; };
  let aSairDepois = datas.reduce((s, d) => s + saidaDoDia(d), 0);
  const dias: SaldoDia[] = [];

  for (const [i, data] of datas.entries()) {
    for (const c of contas) if (c.dataSaldoInicial === data) saldo += c.saldoInicial;
    if (primeiroInicio !== null && data >= primeiroInicio) abrir();
    for (const m of porDia.get(data) ?? []) {
      saldo += m.efeito; incertas += m.incerto;
      if (resumo) { const r: ResumoMes = resumo; if (m.efeito > 0) r.entradas += m.efeito; else r.saidas -= m.efeito; r.talvez += m.incerto; }
    }
    let entradas = 0, entradasIncertas = 0, diario = 0, cartao = 0, fixos = 0, economia = 0, pagamentos = 0, fixoPendente = false;
    for (const l of lancsDoDia.get(data) ?? []) {
      if (l.tipo === 'entrada') {
        entradas += l.valor;
        if (l.certeza === 'possivel') entradasIncertas += l.valor;
      } else if (l.tipo === 'saida' && l.cartaoId) {
        if (!l.saldoAnterior) cartao += l.valor;             // compra no cartão: só informativo
      } else if (l.tipo === 'transferencia' && l.cartaoId) {
        if (l.contaId) pagamentos += l.valor;                // pagamento de fatura
      } else if (l.tipo === 'transferencia' && l.destino) {
        if (l.contaId) economia += l.valor;                  // guardado (avulso ou repetido)
      } else if (l.contaId) {
        if (l.recorrenciaId) { fixos += l.valor; if (l.status === 'previsto') fixoPendente = true; }
        else diario += l.valor;                              // gasto do dia a dia na conta
      }
    }
    const faturasHoje = (faturasDoDia.get(data) ?? 0) + pagamentos;
    const entradasQueContam = entradas - entradasIncertas;
    if (resumo) (resumo as ResumoMes).faturas += faturasDoDia.get(data) ?? 0;
    aSairDepois -= saidaDoDia(data);
    const comecou = primeiroInicio !== null && data >= primeiroInicio;
    dias.push({
      data, dia: i + 1, entradas, entradasIncertas, diario, fixos, economia, faturas: faturasHoje, cartao, fixoPendente,
      liquido: entradasQueContam - diario - fixos - economia - faturasHoje,
      saldo: comecou ? saldo : null,
      saldoComIncertas: comecou ? saldo + incertas : null,
      estado: comecou ? estadoDoSaldo(saldo, aSairDepois) : null,
    });
  }
  if (resumo) (resumo as ResumoMes).fim = saldo;
  return { dias, faturas, resumo };
}

/** Em qual linha do dia o lançamento aparece na tela Saldos. */
export type LinhaDia = 'entradas' | 'fixos' | 'diario' | 'economia' | 'cartao';

export function linhaDoLancamento(l: Lancamento): LinhaDia {
  if (l.tipo === 'entrada') return 'entradas';
  if (l.tipo === 'transferencia') return l.destino ? 'economia' : 'cartao';
  if (l.cartaoId || l.saldoAnterior) return 'cartao';
  return l.recorrenciaId ? 'fixos' : 'diario';
}

// ---------- Cores do horizonte ----------

export type CorSaldo = 'forte' | 'bom' | 'apertado' | 'pouco-negativo' | 'negativo';

/**
 * Cor de um dia no horizonte. `referencia` é o custo fixo de um mês:
 * verde forte = sobra mais que um mês de fixos; verde claro = cobre o que falta pagar;
 * amarelo = não cobre o que ainda sai no mês; rosa = negativo até 10% da referência; vermelho = mais negativo que isso.
 */
export function corDoSaldo(saldo: Centavos, estado: EstadoSaldo, referencia: Centavos): CorSaldo {
  if (saldo < 0) return referencia > 0 && -saldo <= referencia * 0.1 ? 'pouco-negativo' : 'negativo';
  if (estado === 'apertado') return 'apertado';
  return referencia > 0 && saldo >= referencia ? 'forte' : 'bom';
}

/** "5,85k", "−1,62k", "725", "1,2mi": saldo curto para caber na grade de meses. */
export function saldoCurto(c: Centavos): string {
  const reais = c / 100;
  const abs = Math.abs(reais);
  const sinal = reais < 0 ? '−' : '';
  const fmt = (v: number, casas: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas });
  if (abs >= 1_000_000) return `${sinal}${fmt(abs / 1_000_000, 2)}mi`;
  if (abs >= 1_000) return `${sinal}${fmt(abs / 1_000, abs >= 100_000 ? 0 : abs >= 10_000 ? 1 : 2)}k`;
  return `${sinal}${Math.round(abs)}`;
}
