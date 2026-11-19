// Geração dos lançamentos previstos que vêm dos fixos (recorrências).
import type { DataISO, Lancamento, MesRef, Recorrencia } from '../tipos';
import { diasNoMes, mesDe } from './datas';

/** Dia do fixo dentro do mês; dia 31 em novembro cai no dia 30. */
export function dataDaRecorrencia(mes: MesRef, diaDoMes: number): DataISO {
  const dia = Math.min(diaDoMes, diasNoMes(mes));
  return `${mes}-${String(dia).padStart(2, '0')}`;
}

/**
 * Lançamentos que faltam criar no mês para os fixos ativos.
 * - Pula fixo que já tem lançamento nesse mês (pago ou não) e fixo que já terminou.
 * - Não gera nada antes de `inicio` (mês em que você começou a usar o app).
 * - Dias anteriores a `inicio` no primeiro mês entram como realizados: já tinham acontecido.
 */
export function gerarPrevistosDoMes(
  recorrencias: Recorrencia[],
  mes: MesRef,
  existentes: Pick<Lancamento, 'recorrenciaId' | 'data'>[],
  inicio: DataISO,
): Omit<Lancamento, 'id'>[] {
  if (mes < mesDe(inicio)) return [];
  const jaTem = new Set(existentes.filter((l) => l.recorrenciaId && mesDe(l.data) === mes).map((l) => l.recorrenciaId));
  const novos: Omit<Lancamento, 'id'>[] = [];
  for (const r of recorrencias) {
    if (!r.ativa || jaTem.has(r.id)) continue;
    const data = dataDaRecorrencia(mes, r.diaDoMes);
    if (r.fim && data > r.fim) continue;
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
    };
    if (m.categoriaId) l.categoriaId = m.categoriaId;
    if (m.contaId) l.contaId = m.contaId;
    if (m.cartaoId) l.cartaoId = m.cartaoId;
    if (m.fonteRendaId) l.fonteRendaId = m.fonteRendaId;
    novos.push(l);
  }
  return novos;
}
