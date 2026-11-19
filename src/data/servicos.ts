// Operações que combinam repositório + cálculos puros. Componentes usam estas funções, não o Dexie.
import { repositorio } from './repositorio';
import { diasNoMes, hojeISO, mesDe } from '../calculos/datas';
import { gerarPrevistosDoMes } from '../calculos/recorrencias';
import { saldosDoMes, type SaldoDia } from '../calculos/saldos';
import type { DataISO, Id, Lancamento, MesRef } from '../tipos';

/** Primeiro dia em que você informou saldo (início do uso do app). */
export async function dataDeInicio(): Promise<DataISO> {
  const contas = await repositorio.contas.listar();
  return contas.reduce((m, c) => (c.dataSaldoInicial < m ? c.dataSaldoInicial : m), hojeISO());
}

const emAndamento = new Map<MesRef, Promise<void>>();

/** Cria (uma vez) os lançamentos previstos dos fixos no mês. Seguro chamar várias vezes. */
export function garantirFixosDoMes(mes: MesRef): Promise<void> {
  const atual = emAndamento.get(mes);
  if (atual) return atual;
  const p = (async () => {
    const [recs, existentes, inicio] = await Promise.all([
      repositorio.recorrencias.listar(), repositorio.lancamentos.porMes(mes), dataDeInicio(),
    ]);
    await repositorio.lancamentos.criarVarios(gerarPrevistosDoMes(recs, mes, existentes, inicio));
  })().finally(() => emAndamento.delete(mes));
  emAndamento.set(mes, p);
  return p;
}

/**
 * Depois de editar um fixo: refaz os previstos (ainda não pagos) deste mês em diante.
 * O que já foi marcado como pago não muda.
 */
export async function reaplicarRecorrencia(recorrenciaId: Id): Promise<void> {
  const inicioMesAtual = `${mesDe(hojeISO())}-01`;
  const ls = await repositorio.lancamentos.porRecorrencia(recorrenciaId);
  const futuros = ls.filter((l) => l.status === 'previsto' && l.data >= inicioMesAtual);
  await repositorio.lancamentos.excluirVarios(futuros.map((l) => l.id));
  const meses = new Set([mesDe(hojeISO()), ...futuros.map((l) => mesDe(l.data))]);
  for (const m of meses) await garantirFixosDoMes(m);
}

/** Ao excluir um fixo: apaga os previstos dele deste mês em diante (mantém o histórico pago). */
export async function excluirRecorrencia(recorrenciaId: Id): Promise<void> {
  const inicioMesAtual = `${mesDe(hojeISO())}-01`;
  const ls = await repositorio.lancamentos.porRecorrencia(recorrenciaId);
  await repositorio.lancamentos.excluirVarios(ls.filter((l) => l.status === 'previsto' && l.data >= inicioMesAtual).map((l) => l.id));
  await repositorio.recorrencias.excluir(recorrenciaId);
}

export async function marcarComoPago(id: Id, pago = true): Promise<void> {
  await repositorio.lancamentos.atualizar(id, { status: pago ? 'realizado' : 'previsto' });
}

/** Grade da tela Saldos para o mês. */
export async function gradeDoMes(mes: MesRef): Promise<{ dias: SaldoDia[]; lancamentos: Lancamento[] }> {
  await garantirFixosDoMes(mes);
  const [contas, inicio] = await Promise.all([repositorio.contas.listar(), dataDeInicio()]);
  const fim = `${mes}-${String(diasNoMes(mes)).padStart(2, '0')}`;
  const desde = inicio < `${mes}-01` ? inicio : `${mes}-01`;
  const lancamentos = await repositorio.lancamentos.porPeriodo(desde, fim);
  return { dias: saldosDoMes(mes, contas, lancamentos), lancamentos: lancamentos.filter((l) => l.data.startsWith(mes)) };
}
