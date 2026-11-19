// Renda na primeira abertura: salário fixo, comissão estimada (pessimista) e quanto precisa entrar.
import type { Centavos, Frequencia, PerfilRenda } from '../tipos';

export const temSalario = (p: PerfilRenda) => p === 'fixa' || p === 'mista';
export const temComissao = (p: PerfilRenda) => p !== 'fixa';

/** Valor de cada recebimento para chegar no total do mês (semana: ×12÷52; quinzena: ×12÷26). */
export function valorPorRecebimento(mensal: Centavos, f: Frequencia): Centavos {
  if (f === 'semanal') return Math.round((mensal * 12) / 52);
  if (f === 'quinzenal') return Math.round((mensal * 12) / 26);
  return mensal;
}

export interface Necessario {
  /** Quanto precisa entrar de comissão por mês para cobrir os fixos (depois do salário). */
  porMes: Centavos;
  porSemana: Centavos;
  /** Com a estimativa pessimista: positivo sobra, negativo falta. */
  sobraNoMesFraco: Centavos | null;
}

/** 5.6 ponto de equilíbrio, sem meta de vendas: quanto precisa entrar para pagar os fixos. */
export function necessarioParaFixos(custoFixoMensal: Centavos, salario: Centavos, comissaoPessimista?: Centavos): Necessario {
  const porMes = Math.max(0, custoFixoMensal - salario);
  return {
    porMes,
    porSemana: Math.ceil((porMes * 12) / 52),
    sobraNoMesFraco: comissaoPessimista === undefined ? null : salario + comissaoPessimista - custoFixoMensal,
  };
}
