import type { Centavos } from '../tipos';

const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 123456 → "R$ 1.234,56" (espaço normal, não o espaço especial do Intl). */
export function formatarReais(valor: Centavos): string {
  garantirInteiro(valor);
  return formatador.format(valor / 100).replace(/ /g, ' ');
}

/**
 * Converte texto digitado em centavos. Aceita "32", "32,5", "32,50", "1.200", "1.200,00", "1200".
 * Ponto é separador de milhar; vírgula é decimal. Devolve null se não for um valor válido.
 */
export function textoParaCentavos(texto: string): Centavos | null {
  const limpo = texto.trim().replace(/^r\$\s*/i, '');
  const m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(limpo);
  if (!m) return null;
  const inteiro = Number(m[1].replace(/\./g, ''));
  const decimais = Number((m[2] ?? '0').padEnd(2, '0'));
  return inteiro * 100 + decimais;
}

/** Divide um valor em N partes inteiras; o resto vai para as primeiras. 1000/3 → [334, 333, 333]. */
export function dividirCentavos(valor: Centavos, partes: number): Centavos[] {
  garantirInteiro(valor);
  if (!Number.isInteger(partes) || partes < 1) throw new Error('Número de partes inválido.');
  const base = Math.trunc(valor / partes);
  const resto = valor - base * partes;
  return Array.from({ length: partes }, (_, i) => base + (i < resto ? 1 : 0));
}

export function garantirInteiro(valor: number): void {
  if (!Number.isInteger(valor)) throw new Error(`Valor em centavos precisa ser inteiro: ${valor}`);
}
