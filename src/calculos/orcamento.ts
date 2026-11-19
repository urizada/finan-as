// Fase 5: livre por dia (5.1), alerta de caixa (5.2), divisão de entrada (5.7) e totais do mês.
import type { Cartao, Centavos, Conta, DataISO, Id, Lancamento, MesRef } from '../tipos';
import { calcularFaturas } from './cartao';
import { diasNoMes, diasRestantesNoMes, mesDe, somarDias } from './datas';
import { efeitoNaConta } from './saldos';

// ---------- Saldo das contas numa data ----------

interface Mov { contaId: Id; data: DataISO; efeito: Centavos }

/** Movimentos que mexem nas contas (lançamentos + faturas no vencimento). */
function movimentos(contas: Conta[], lancamentos: Lancamento[], cartoes: Cartao[], apenasGarantidas: boolean): Mov[] {
  const inicio = new Map(contas.map((c) => [c.id, c.dataSaldoInicial]));
  const vale = (id: Id | undefined, d: DataISO) => !!id && inicio.has(id) && d >= inicio.get(id)!;
  const ms: Mov[] = [];
  for (const l of lancamentos) {
    if (!vale(l.contaId, l.data)) continue;
    if (apenasGarantidas && l.tipo === 'entrada' && l.certeza !== 'garantida') continue;
    const e = efeitoNaConta(l);
    if (e) ms.push({ contaId: l.contaId!, data: l.data, efeito: e });
  }
  for (const f of calcularFaturas(lancamentos, cartoes))
    if (f.restante > 0 && vale(f.contaId, f.vencimento)) ms.push({ contaId: f.contaId, data: f.vencimento, efeito: -f.restante });
  return ms;
}

/** Saldo de cada conta no fim do dia `data`. Antes do início de uma conta, ela não entra. */
export function saldoDasContas(
  contas: Conta[], lancamentos: Lancamento[], cartoes: Cartao[], data: DataISO, apenasGarantidas = false,
): { total: Centavos; porConta: Record<Id, Centavos> } {
  const porConta: Record<Id, Centavos> = {};
  for (const c of contas) if (c.dataSaldoInicial <= data) porConta[c.id] = c.saldoInicial;
  for (const m of movimentos(contas, lancamentos, cartoes, apenasGarantidas))
    if (m.data <= data && m.contaId in porConta) porConta[m.contaId] += m.efeito;
  return { total: Object.values(porConta).reduce((s, v) => s + v, 0), porConta };
}

// ---------- 5.2 Alerta de caixa ----------

export interface AlertaCaixa {
  /** Primeiro dia em que a conta fica negativa. */
  dia: DataISO;
  /** Quanto falta no pior momento até o fim do mês. */
  falta: Centavos;
}

/**
 * Olha de hoje até o fim do mês contando só entradas garantidas (conservador).
 * Se o saldo ficar negativo em algum dia, avisa quando e quanto vai faltar.
 */
export function alertaDeCaixa(contas: Conta[], lancamentos: Lancamento[], cartoes: Cartao[], hoje: DataISO): AlertaCaixa | null {
  const mes = mesDe(hoje);
  const fim = `${mes}-${String(diasNoMes(mes)).padStart(2, '0')}`;
  const ms = movimentos(contas, lancamentos, cartoes, true);
  let saldo = saldoDasContas(contas, lancamentos, cartoes, somarDias(hoje, -1), true).total;
  let primeiro: DataISO | null = null;
  let pior = 0;
  for (let d = hoje; d <= fim; d = somarDias(d, 1)) {
    for (const c of contas) if (c.dataSaldoInicial === d) saldo += c.saldoInicial;
    for (const m of ms) if (m.data === d) saldo += m.efeito;
    if (saldo < 0) { primeiro ??= d; pior = Math.min(pior, saldo); }
  }
  return primeiro ? { dia: primeiro, falta: -pior } : null;
}

// ---------- 5.1 Livre por dia ----------

/** Classificação de um lançamento para o orçamento (competência). */
export function tipoNoOrcamento(l: Lancamento): 'entrada' | 'fixo' | 'parcela' | 'aporte' | 'variavel' | 'neutro' {
  if (l.saldoAnterior) return 'neutro';                         // dívida de antes do app
  if (l.tipo === 'entrada') return 'entrada';
  if (l.tipo === 'transferencia') return l.destino ? 'aporte' : 'neutro'; // pagamento de fatura é neutro
  if (l.parcela) return 'parcela';
  if (l.recorrenciaId) return 'fixo';
  return 'variavel';
}

export interface LivrePorDia {
  /** Dinheiro de partida do mês (saldo da virada que pode ser usado). */
  partida: Centavos;
  entradasGarantidas: Centavos;
  fixos: Centavos;
  parcelas: Centavos;
  aportes: Centavos;
  variaveisAteOntem: Centavos;
  variaveisHoje: Centavos;
  orcamentoLivreMes: Centavos;
  diasRestantes: number;
  livreHoje: Centavos;
  aindaPossoHoje: Centavos;
  /** Quando o mês não fecha: quanto falta de entrada. */
  faltaEntrada: Centavos;
  /** Livre por dia se as entradas prováveis também caírem. */
  livreComProvaveis: Centavos;
}

/**
 * 5.1 — quanto dá para gastar hoje sem comprometer o mês.
 * orcamentoLivreMes = partida + entradas GARANTIDAS − fixos − parcelas − aportes − variáveis até ontem.
 * `partida` é o dinheiro que já estava na conta no início do mês (ver servico); entra para que o
 * saldo que você já tem também possa ser gasto.
 */
export function livrePorDia(lancamentosDoMes: Lancamento[], hoje: DataISO, partida: Centavos = 0): LivrePorDia {
  let entradasGarantidas = 0, provaveis = 0, fixos = 0, parcelas = 0, aportes = 0, variaveisAteOntem = 0, variaveisHoje = 0;
  for (const l of lancamentosDoMes) {
    switch (tipoNoOrcamento(l)) {
      case 'entrada':
        if (l.certeza === 'garantida') entradasGarantidas += l.valor;
        else if (l.certeza === 'provavel') provaveis += l.valor;
        break;
      case 'fixo': fixos += l.valor; break;
      case 'parcela': parcelas += l.valor; break;
      case 'aporte': aportes += l.valor; break;
      case 'variavel':
        if (l.data < hoje) variaveisAteOntem += l.valor;
        else if (l.data === hoje) variaveisHoje += l.valor;
        break;
    }
  }
  const orcamentoLivreMes = partida + entradasGarantidas - fixos - parcelas - aportes - variaveisAteOntem;
  const diasRestantes = diasRestantesNoMes(hoje);
  const livreHoje = Math.floor(orcamentoLivreMes / diasRestantes);
  return {
    partida, entradasGarantidas, fixos, parcelas, aportes, variaveisAteOntem, variaveisHoje,
    orcamentoLivreMes, diasRestantes, livreHoje,
    aindaPossoHoje: livreHoje - variaveisHoje,
    faltaEntrada: orcamentoLivreMes < 0 ? -orcamentoLivreMes : 0,
    livreComProvaveis: Math.floor((orcamentoLivreMes + provaveis) / diasRestantes),
  };
}

// ---------- 5.7 Divisão automática de entrada ----------

export interface Percentuais { reserva: number; investimentos: number; metas: number; livre: number }
export const PERCENTUAIS_PADRAO: Percentuais = { reserva: 20, investimentos: 10, metas: 0, livre: 70 };

export interface Divisao { fixos: Centavos; reserva: Centavos; investimentos: Centavos; metas: Centavos; livre: Centavos }

/**
 * 1. Primeiro completa o que falta dos fixos do mês.
 * 2. O resto vai por percentual; o arredondamento sobra para "livre". A soma é sempre o valor.
 */
export function dividirEntrada(valor: Centavos, faltaFixos: Centavos, p: Percentuais): Divisao {
  const fixos = Math.min(valor, Math.max(0, faltaFixos));
  const resto = valor - fixos;
  const parte = (pct: number) => Math.floor((resto * pct) / 100);
  const reserva = parte(p.reserva), investimentos = parte(p.investimentos), metas = parte(p.metas);
  return { fixos, reserva, investimentos, metas, livre: resto - reserva - investimentos - metas };
}

export function percentuaisValidos(p: Percentuais): boolean {
  const vs = [p.reserva, p.investimentos, p.metas, p.livre];
  return vs.every((v) => Number.isInteger(v) && v >= 0 && v <= 100) && vs.reduce((a, b) => a + b, 0) === 100;
}

// ---------- Totais do mês ----------

export interface TotaisMes {
  /** Entradas que caíram ou são certas (garantidas). */
  entradas: Centavos;
  /** Entradas prováveis/talvez ainda não confirmadas. */
  entradasIncertas: Centavos;
  fixos: Centavos;
  /** Gastos variáveis (conta + cartão, pela data da compra). */
  variaveis: Centavos;
  parcelas: Centavos;
  /** Compras no cartão (parte de variáveis + parcelas + fixos no cartão). */
  noCartao: Centavos;
  guardado: Centavos;
  /** Fixos + variáveis + parcelas. */
  custoDeVida: Centavos;
  /** entradas − custo de vida − guardado. */
  resultado: Centavos;
  /** guardado ÷ entradas (0 a 100, inteiro). */
  economizadoPct: number;
  /** Gastos variáveis ÷ dias que já passaram (inclui hoje). */
  diarioMedio: Centavos;
  diasConsiderados: number;
}

/** `inicioUso`: no mês em que você começou a usar o app, o diário médio conta só a partir desse dia. */
export function totaisDoMes(lancamentosDoMes: Lancamento[], mes: MesRef, hoje: DataISO, inicioUso?: DataISO): TotaisMes {
  let entradas = 0, entradasIncertas = 0, fixos = 0, variaveis = 0, parcelas = 0, noCartao = 0, guardado = 0;
  for (const l of lancamentosDoMes) {
    const t = tipoNoOrcamento(l);
    if (t === 'entrada') { if (l.certeza === 'garantida') entradas += l.valor; else entradasIncertas += l.valor; }
    else if (t === 'fixo') fixos += l.valor;
    else if (t === 'parcela') parcelas += l.valor;
    else if (t === 'aporte') guardado += l.valor;
    else if (t === 'variavel') variaveis += l.valor;
    if (l.tipo === 'saida' && l.cartaoId && !l.saldoAnterior) noCartao += l.valor;
  }
  const custoDeVida = fixos + variaveis + parcelas;
  const ultimoDia = mesDe(hoje) === mes ? Number(hoje.slice(8, 10)) : mes < mesDe(hoje) ? diasNoMes(mes) : 0;
  const primeiroDia = inicioUso && mesDe(inicioUso) === mes ? Number(inicioUso.slice(8, 10)) : 1;
  const dias = Math.max(0, ultimoDia - primeiroDia + 1);
  return {
    entradas, entradasIncertas, fixos, variaveis, parcelas, noCartao, guardado, custoDeVida,
    resultado: entradas - custoDeVida - guardado,
    economizadoPct: entradas > 0 ? Math.round((guardado / entradas) * 100) : 0,
    diarioMedio: dias > 0 ? Math.round(variaveis / dias) : 0,
    diasConsiderados: dias,
  };
}

