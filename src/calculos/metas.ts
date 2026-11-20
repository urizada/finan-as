// 5.4 Reserva de emergência, 5.5 metas e saldo de investimentos.
import type { Centavos, DataISO, Id, Investimento, Lancamento, Meta, SnapshotInvestimento } from '../tipos';
import { diasEntre } from './datas';

/** Aportes − retiradas para um destino (meta ou investimento) até a data (inclusive). */
export function movimentoDoDestino(lancamentos: Lancamento[], id: Id, ate: DataISO, depoisDe?: DataISO): Centavos {
  let s = 0;
  for (const l of lancamentos) {
    if (l.tipo !== 'transferencia' || l.destino?.id !== id || l.data > ate || (depoisDe && l.data <= depoisDe)) continue;
    s += l.retirada ? -l.valor : l.valor;
  }
  return s;
}

export function saldoDaMeta(meta: Meta, lancamentos: Lancamento[], hoje: DataISO): Centavos {
  return meta.saldoAtual + movimentoDoDestino(lancamentos, meta.id, hoje);
}

/** Saldo do investimento: última atualização manual + aportes − retiradas depois dela. */
export function saldoDoInvestimento(inv: Investimento, snapshots: SnapshotInvestimento[], lancamentos: Lancamento[], hoje: DataISO): { saldo: Centavos; atualizadoEm: DataISO | null } {
  const ultimo = snapshots.filter((s) => s.investimentoId === inv.id && s.data <= hoje).sort((a, b) => (a.data < b.data ? 1 : -1))[0];
  return {
    saldo: (ultimo?.saldo ?? 0) + movimentoDoDestino(lancamentos, inv.id, hoje, ultimo?.data),
    atualizadoEm: ultimo?.data ?? null,
  };
}

// ---------- 5.4 Reserva ----------

export interface Reserva {
  saldo: Centavos;
  alvo: Centavos;
  /** saldo ÷ custo fixo mensal, com 1 casa (null se não há fixos). */
  meses: number | null;
  mesesAlvo: number;
  /** (contas + reserva) ÷ custo fixo: quantos meses aguenta sem entrar nada. */
  folego: number | null;
  pct: number;
}

const umaCasa = (n: number) => Math.floor(n * 10) / 10;

export function calcularReserva(saldoReserva: Centavos, saldoContas: Centavos, custoFixo: Centavos, mesesAlvo: number): Reserva {
  const alvo = custoFixo * mesesAlvo;
  return {
    saldo: saldoReserva, alvo, mesesAlvo,
    meses: custoFixo > 0 ? umaCasa(saldoReserva / custoFixo) : null,
    folego: custoFixo > 0 ? umaCasa(Math.max(0, saldoContas + saldoReserva) / custoFixo) : null,
    pct: alvo > 0 ? Math.min(100, Math.round((saldoReserva / alvo) * 100)) : 0,
  };
}

/** 2.3 → "2,3". */
export const formatarMeses = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

// ---------- 5.5 Metas ----------

export type StatusMeta = 'concluida' | 'adiantada' | 'no ritmo' | 'atrasada';

/** Meses (frações contam como mês inteiro) de hoje até o prazo; mínimo 1. */
export function mesesAte(hoje: DataISO, prazo: DataISO): number {
  return Math.max(1, Math.ceil(diasEntre(hoje, prazo) / 30.44));
}

export function aporteMensalNecessario(alvo: Centavos, saldo: Centavos, hoje: DataISO, prazo?: DataISO): Centavos | null {
  if (!prazo) return null;
  const falta = alvo - saldo;
  if (falta <= 0) return 0;
  return Math.ceil(falta / mesesAte(hoje, prazo));
}

/**
 * Compara o saldo real com o esperado se você guardasse por igual do início (criadaEm) até o prazo.
 * Folga de 5% do alvo para cada lado.
 */
export function statusDaMeta(alvo: Centavos, saldo: Centavos, hoje: DataISO, criadaEm?: DataISO, prazo?: DataISO): StatusMeta | null {
  if (alvo > 0 && saldo >= alvo) return 'concluida';
  if (!prazo || !criadaEm || prazo <= criadaEm) return null;
  const fracao = Math.min(1, Math.max(0, diasEntre(criadaEm, hoje) / diasEntre(criadaEm, prazo)));
  const esperado = alvo * fracao;
  const folga = alvo * 0.05;
  if (saldo > esperado + folga) return 'adiantada';
  if (saldo < esperado - folga) return 'atrasada';
  return 'no ritmo';
}

// ---------- Situação geral (tela Hoje) ----------

export type Situacao = 'tranquilo' | 'atencao' | 'aperto';

export function situacaoGeral(p: {
  livreHoje: Centavos; aindaPossoHoje: Centavos; saldoHoje: Centavos; alertaDia: DataISO | null; limitesEstourados: number;
}): { situacao: Situacao; motivo: string } {
  if (p.saldoHoje < 0) return { situacao: 'aperto', motivo: 'Sua conta está no negativo.' };
  if (p.livreHoje < 0) return { situacao: 'aperto', motivo: 'O dinheiro garantido não fecha o mês.' };
  if (p.alertaDia) return { situacao: 'atencao', motivo: `A conta fica negativa em ${p.alertaDia.slice(8)}/${p.alertaDia.slice(5, 7)}.` };
  if (p.aindaPossoHoje < 0) return { situacao: 'atencao', motivo: 'Você passou do previsto para hoje.' };
  if (p.limitesEstourados > 0) return { situacao: 'atencao', motivo: p.limitesEstourados === 1 ? 'Uma categoria passou do limite.' : `${p.limitesEstourados} categorias passaram do limite.` };
  return { situacao: 'tranquilo', motivo: 'Seu mês está sob controle.' };
}
