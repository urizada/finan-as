// 5.9 Limites por categoria.
import type { Centavos, Id, Lancamento } from '../tipos';

export type EstadoLimite = 'ok' | 'perto' | 'estourado';
export const PERTO = 0.8;

/** Gasto do mês por categoria, pela data da compra (conta + cartão). Fatura antiga não conta. */
export function gastoPorCategoria(lancamentosDoMes: Lancamento[], ignorarId?: Id): Record<Id, Centavos> {
  const g: Record<Id, Centavos> = {};
  for (const l of lancamentosDoMes) {
    if (l.tipo !== 'saida' || l.saldoAnterior || !l.categoriaId || l.id === ignorarId) continue;
    g[l.categoriaId] = (g[l.categoriaId] ?? 0) + l.valor;
  }
  return g;
}

export function estadoDoLimite(gasto: Centavos, limite: Centavos): { estado: EstadoLimite; pct: number; restante: Centavos } {
  const pct = limite > 0 ? Math.round((gasto / limite) * 100) : 0;
  const estado: EstadoLimite = gasto > limite ? 'estourado' : gasto >= limite * PERTO ? 'perto' : 'ok';
  return { estado, pct, restante: limite - gasto };
}

export interface AvisoLimite {
  antes: Centavos;
  depois: Centavos;
  limite: Centavos;
  estado: Exclude<EstadoLimite, 'ok'>;
  /** Quanto passa do limite (0 se ainda não passou). */
  acima: Centavos;
  pct: number;
}

/** Pergunta antes de salvar se o gasto novo deixa a categoria perto (≥ 80%) ou acima do limite. */
export function avisoDeLimite(gastoAtual: Centavos, valorNovo: Centavos, limite: Centavos | undefined): AvisoLimite | null {
  if (!limite || limite <= 0 || valorNovo <= 0) return null;
  const depois = gastoAtual + valorNovo;
  const { estado, pct } = estadoDoLimite(depois, limite);
  if (estado === 'ok') return null;
  return { antes: gastoAtual, depois, limite, estado, acima: Math.max(0, depois - limite), pct };
}
