// Fixos e repetições: em que datas acontecem e quais lançamentos previstos criar.
import type { DataISO, Frequencia, Lancamento, MesRef, Recorrencia } from '../tipos';
import { diasEntre, diasNoMes, mesDe, somarDias, somarMesesNaData } from './datas';

/** Dia do fixo dentro do mês; dia 31 em novembro cai no dia 30. */
export function dataDaRecorrencia(mes: MesRef, diaDoMes: number): DataISO {
  const dia = Math.min(diaDoMes, diasNoMes(mes));
  return `${mes}-${String(dia).padStart(2, '0')}`;
}

const PASSO: Record<Exclude<Frequencia, 'mensal'>, number> = { semanal: 7, quinzenal: 14 };

/** Datas em que a recorrência acontece dentro do mês (respeitando início e fim). */
export function datasNoMes(r: Recorrencia, mes: MesRef): DataISO[] {
  const freq = r.frequencia ?? 'mensal';
  const primeiro = `${mes}-01`;
  const ultimo = `${mes}-${String(diasNoMes(mes)).padStart(2, '0')}`;
  let datas: DataISO[];
  if (freq === 'mensal') {
    datas = [dataDaRecorrencia(mes, r.diaDoMes)];
  } else {
    if (!r.dataInicio) return [];
    const passo = PASSO[freq];
    const atraso = diasEntre(r.dataInicio, primeiro);
    let d = atraso <= 0 ? r.dataInicio : somarDias(r.dataInicio, Math.ceil(atraso / passo) * passo);
    datas = [];
    for (; d <= ultimo; d = somarDias(d, passo)) datas.push(d);
  }
  return datas.filter((d) => (!r.dataInicio || d >= r.dataInicio) && (!r.fim || d <= r.fim) && !r.excecoes?.includes(d));
}

/** Número da ocorrência (1, 2, 3…) contando a partir do início. Sem início no mensal: null. */
export function numeroDaOcorrencia(r: Recorrencia, data: DataISO): number | null {
  if (!r.dataInicio) return null;
  const freq = r.frequencia ?? 'mensal';
  if (freq === 'mensal') {
    const [a1, m1] = r.dataInicio.split('-').map(Number);
    const [a2, m2] = data.split('-').map(Number);
    return (a2 - a1) * 12 + (m2 - m1) + 1;
  }
  return Math.floor(diasEntre(r.dataInicio, data) / PASSO[freq]) + 1;
}

/** Total de vezes, quando a repetição tem fim. */
export function totalDeOcorrencias(r: Recorrencia): number | null {
  return r.fim ? numeroDaOcorrencia(r, r.fim) : null;
}

/** Data da N-ésima ocorrência a partir de `inicio`. */
export function dataDaOcorrencia(inicio: DataISO, freq: Frequencia, n: number): DataISO {
  return freq === 'mensal' ? somarMesesNaData(inicio, n - 1) : somarDias(inicio, (n - 1) * PASSO[freq]);
}

export const ROTULO_FREQUENCIA: Record<Frequencia, string> = {
  semanal: 'Toda semana', quinzenal: 'A cada 15 dias', mensal: 'Todo mês',
};

/** "3 de 10", "toda semana" ou "fixo". */
export function rotuloRepeticao(r: Recorrencia, data: DataISO): string {
  const total = totalDeOcorrencias(r);
  const n = numeroDaOcorrencia(r, data);
  if (total && n) return `${n} de ${total}`;
  const freq = r.frequencia ?? 'mensal';
  return freq === 'mensal' ? 'fixo' : ROTULO_FREQUENCIA[freq].toLowerCase();
}

/**
 * Lançamentos que faltam criar no mês.
 * - Mensal: um por mês; pula se já existe lançamento dessa recorrência no mês.
 * - Semanal/quinzenal: um por data; pula a data que já tem lançamento.
 * - Nada antes de `inicio` (mês em que você começou a usar o app); no primeiro mês,
 *   o que é anterior ao início entra como realizado.
 */
export function gerarPrevistosDoMes(
  recorrencias: Recorrencia[],
  mes: MesRef,
  existentes: Pick<Lancamento, 'recorrenciaId' | 'data' | 'recorrenciaData'>[],
  inicio: DataISO,
): Omit<Lancamento, 'id'>[] {
  if (mes < mesDe(inicio)) return [];
  const doMes = existentes.filter((l) => l.recorrenciaId && mesDe(l.recorrenciaData ?? l.data) === mes);
  const mensalJaTem = new Set(doMes.map((l) => l.recorrenciaId));
  const dataJaTem = new Set(doMes.map((l) => `${l.recorrenciaId}|${l.recorrenciaData ?? l.data}`));
  const novos: Omit<Lancamento, 'id'>[] = [];
  for (const r of recorrencias) {
    if (!r.ativa) continue;
    const mensal = (r.frequencia ?? 'mensal') === 'mensal';
    if (mensal && mensalJaTem.has(r.id)) continue;
    for (const data of datasNoMes(r, mes)) {
      if (!mensal && dataJaTem.has(`${r.id}|${data}`)) continue;
      const m = r.modelo;
      const tipo = m.tipo ?? 'saida';
      const l: Omit<Lancamento, 'id'> = {
        tipo,
        valor: m.valor ?? 0,
        data,
        descricao: m.descricao ?? '',
        certeza: tipo === 'saida' ? 'garantida' : m.certeza ?? 'garantida',
        status: data < inicio ? 'realizado' : 'previsto',
        recorrenciaId: r.id,
        recorrenciaData: data,
      };
      if (m.categoriaId) l.categoriaId = m.categoriaId;
      if (m.contaId) l.contaId = m.contaId;
      if (m.cartaoId) l.cartaoId = m.cartaoId;
      if (m.fonteRendaId) l.fonteRendaId = m.fonteRendaId;
      if (m.destino) l.destino = m.destino;
      novos.push(l);
    }
  }
  return novos;
}
