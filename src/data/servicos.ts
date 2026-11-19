// Operações que combinam repositório + cálculos puros. Componentes usam estas funções, não o Dexie.
import { repositorio } from './repositorio';
import { diasNoMes, hojeISO, mesDe } from '../calculos/datas';
import { dataDaOcorrencia, gerarPrevistosDoMes } from '../calculos/recorrencias';
import { faturaDaCompra, gerarParcelas } from '../calculos/cartao';
import { aprenderPalavra } from '../calculos/parser';
import { saldosDoMes, type SaldoDia } from '../calculos/saldos';
import type { DataISO, Frequencia, Id, Lancamento, MesRef, Recorrencia } from '../tipos';

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

export interface OpcoesNovo {
  /** Compra no cartão em N vezes. */
  parcelas?: number;
  /** Repetir a partir da data do lançamento. vezes null = sem fim. */
  repeticao?: { frequencia: Frequencia; vezes: number | null };
}

/**
 * Cria um lançamento novo: simples, parcelado no cartão ou que se repete.
 * Devolve uma função que desfaz tudo o que foi criado.
 */
export async function criarLancamento(dados: Omit<Lancamento, 'id'>, op: OpcoesNovo = {}): Promise<() => Promise<void>> {
  const cartao = dados.cartaoId ? await repositorio.cartoes.obter(dados.cartaoId) : undefined;

  if (op.repeticao) {
    const { frequencia, vezes } = op.repeticao;
    const { data, status: _s, recorrenciaId: _r, recorrenciaData: _d, parcela: _p, faturaRef: _f, ...modelo } = dados;
    const rec: Omit<Recorrencia, 'id'> = {
      modelo, frequencia, diaDoMes: Number(data.slice(8, 10)), dataInicio: data, ativa: true,
      ...(vezes ? { fim: dataDaOcorrencia(data, frequencia, vezes) } : {}),
    };
    const salvo = await repositorio.recorrencias.criar(rec);
    await garantirFixosDoMes(mesDe(data));
    if (mesDe(hojeISO()) !== mesDe(data)) await garantirFixosDoMes(mesDe(hojeISO()));
    const primeiro = (await repositorio.lancamentos.porRecorrencia(salvo.id)).find((l) => l.recorrenciaData === data);
    if (primeiro && primeiro.status !== dados.status) await repositorio.lancamentos.atualizar(primeiro.id, { status: dados.status });
    return async () => {
      const ls = await repositorio.lancamentos.porRecorrencia(salvo.id);
      await repositorio.lancamentos.excluirVarios(ls.map((l) => l.id));
      await repositorio.recorrencias.excluir(salvo.id);
    };
  }

  if (cartao && dados.tipo === 'saida' && (op.parcelas ?? 1) > 1) {
    const ps = gerarParcelas({ ...dados, cartaoId: cartao.id }, op.parcelas!, cartao.diaFechamento, crypto.randomUUID());
    const criados = await repositorio.lancamentos.criarVarios(ps);
    return () => repositorio.lancamentos.excluirVarios(criados.map((l) => l.id));
  }

  const final = cartao ? { ...dados, faturaRef: faturaDaCompra(dados.data, cartao.diaFechamento) } : dados;
  const criado = await repositorio.lancamentos.criar(final);
  return () => repositorio.lancamentos.excluir(criado.id);
}

/** Exclui todas as parcelas de uma compra parcelada. */
export async function excluirParcelas(grupoId: Id): Promise<void> {
  const ls = await repositorio.lancamentos.porGrupoParcela(grupoId);
  await repositorio.lancamentos.excluirVarios(ls.map((l) => l.id));
}

/** O app aprende a palavra para a categoria escolhida (e tira das outras do mesmo tipo). */
export async function ensinarCategoria(palavra: string, categoriaId: Id): Promise<void> {
  const mudadas = aprenderPalavra(await repositorio.categorias.listar(), palavra, categoriaId);
  for (const c of mudadas) await repositorio.categorias.salvar(c);
}
