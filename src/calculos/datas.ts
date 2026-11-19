import type { DataISO, MesRef } from '../tipos';

const doisDigitos = (n: number) => String(n).padStart(2, '0');

/** Date → 'AAAA-MM-DD' no fuso local (não usa toISOString, que é UTC). */
export function paraISO(d: Date): DataISO {
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

export function hojeISO(agora: Date = new Date()): DataISO {
  return paraISO(agora);
}

/** 'AAAA-MM-DD' → 'dd/mm/aaaa'. */
export function formatarData(data: DataISO): string {
  const [a, m, d] = data.split('-');
  return `${d}/${m}/${a}`;
}

export function mesDe(data: DataISO): MesRef {
  return data.slice(0, 7);
}

export function diasNoMes(mes: MesRef): number {
  const [a, m] = mes.split('-').map(Number);
  return new Date(a, m, 0).getDate();
}

/** Soma (ou subtrai) meses: ('2026-12', 1) → '2027-01'. */
export function somarMeses(mes: MesRef, n: number): MesRef {
  const [a, m] = mes.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${doisDigitos((total % 12) + 1)}`;
}

/** Dias restantes no mês contando o dia informado. 19/11 → 12. */
export function diasRestantesNoMes(data: DataISO): number {
  return diasNoMes(mesDe(data)) - Number(data.slice(8, 10)) + 1;
}

const NOMES_MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** '2026-11' → 'novembro de 2026'. */
export function nomeDoMes(mes: MesRef): string {
  const [a, m] = mes.split('-').map(Number);
  return `${NOMES_MESES[m - 1]} de ${a}`;
}
