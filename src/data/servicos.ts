// Operações que combinam repositório + cálculos puros. Componentes usam estas funções, não o Dexie.
import { repositorio } from './repositorio';
import { diasNoMes, hojeISO, mesDe, somarDias, somarMeses } from '../calculos/datas';
import { dataDaOcorrencia, gerarPrevistosDoMes } from '../calculos/recorrencias';
import { calcularFaturas, faturaDaCompra, gerarParcelas, proximaFaturaAPagar, vencimentoDaFatura, type Fatura } from '../calculos/cartao';
import { aprenderPalavra } from '../calculos/parser';
import { alertaDeCaixa, dividirEntrada, livrePorDia, PERCENTUAIS_PADRAO, saldoDasContas, totaisDoMes, type AlertaCaixa, type Divisao, type LivrePorDia, type TotaisMes } from '../calculos/orcamento';
import { avisarEntradaRecebida } from './eventos';
import { saldosDoMes, type ResumoMes, type SaldoDia } from '../calculos/saldos';
import type { Cartao, Centavos, Certeza, Conta, DataISO, Frequencia, Id, Lancamento, Meta, MesRef, Recorrencia } from '../tipos';

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

/**
 * Grade da tela Saldos para o mês. Gera antes os fixos de todos os meses desde o início do uso,
 * para o saldo de um mês futuro já descontar os meses do meio.
 */
export async function gradeDoMes(mes: MesRef): Promise<{ dias: SaldoDia[]; lancamentos: Lancamento[]; faturas: Fatura[]; resumo: ResumoMes | null }> {
  const inicio = await dataDeInicio();
  for (let m = mesDe(inicio) < mes ? mesDe(inicio) : mes; m <= mes; m = somarMeses(m, 1)) await garantirFixosDoMes(m);
  const [contas, cartoes] = await Promise.all([repositorio.contas.listar(), repositorio.cartoes.listar()]);
  const fim = `${mes}-${String(diasNoMes(mes)).padStart(2, '0')}`;
  const desde = inicio < `${mes}-01` ? inicio : `${mes}-01`;
  const lancamentos = await repositorio.lancamentos.porPeriodo(desde, fim);
  const { dias, faturas, resumo } = saldosDoMes(mes, contas, lancamentos, cartoes);
  return { dias, resumo, faturas: faturas.filter((f) => f.vencimento.startsWith(mes)), lancamentos: lancamentos.filter((l) => l.data.startsWith(mes)) };
}

/** Marca a fatura como paga: cria a saída da conta de pagamento com o que falta. */
export async function pagarFatura(f: Fatura): Promise<void> {
  if (f.restante <= 0) return;
  const cartao = await repositorio.cartoes.obter(f.cartaoId);
  const hoje = hojeISO();
  await repositorio.lancamentos.criar({
    tipo: 'transferencia', valor: f.restante, data: f.vencimento < hoje ? f.vencimento : hoje,
    descricao: `Fatura ${cartao?.nome ?? 'do cartão'}`, contaId: f.contaId, cartaoId: f.cartaoId, faturaRef: f.faturaRef,
    certeza: 'garantida', status: 'realizado',
  });
}

/** Desfaz o pagamento da fatura (apaga as transferências dela). */
export async function desfazerPagamentoFatura(f: Fatura): Promise<void> {
  const ls = await repositorio.lancamentos.porFatura(f.cartaoId, f.faturaRef);
  await repositorio.lancamentos.excluirVarios(ls.filter((l) => l.tipo === 'transferencia').map((l) => l.id));
}

/** Valor da fatura que já estava aberta quando o cartão foi cadastrado (0 se não houver). */
export async function faturaAnterior(cartaoId: Id): Promise<Lancamento | undefined> {
  return (await repositorio.lancamentos.listar()).find((l) => l.cartaoId === cartaoId && l.saldoAnterior);
}

/** Grava (ou atualiza/apaga) a fatura que já estava aberta antes de usar o app. */
export async function salvarFaturaAnterior(cartaoId: Id, valor: Centavos): Promise<void> {
  const cartao = await repositorio.cartoes.obter(cartaoId);
  if (!cartao) return;
  const atual = await faturaAnterior(cartaoId);
  if (valor <= 0) { if (atual) await repositorio.lancamentos.excluir(atual.id); return; }
  const hoje = hojeISO();
  const faturaRef = atual?.faturaRef ?? proximaFaturaAPagar(hoje, cartao);
  const dados: Omit<Lancamento, 'id'> = {
    tipo: 'saida', valor, data: atual?.data ?? hoje, descricao: 'Fatura que já estava aberta', cartaoId, faturaRef,
    certeza: 'garantida', status: 'realizado', saldoAnterior: true,
  };
  if (atual) await repositorio.lancamentos.salvar({ ...dados, id: atual.id });
  else await repositorio.lancamentos.criar(dados);
}

/** Quando vence a próxima fatura do cartão (para mostrar no cadastro). */
export function vencimentoDaProxima(cartao: { diaFechamento: number; diaVencimento: number }): DataISO {
  return vencimentoDaFatura(proximaFaturaAPagar(hojeISO(), cartao), cartao);
}

export interface OpcoesNovo {
  /** Compra no cartão em N vezes. */
  parcelas?: number;
  /** Repetir a partir da data do lançamento. vezes null = sem fim. */
  repeticao?: { frequencia: Frequencia; vezes: number | null; certezaProximas?: Certeza };
}

/**
 * Cria um lançamento novo: simples, parcelado no cartão ou que se repete.
 * Devolve uma função que desfaz tudo o que foi criado.
 */
export async function criarLancamento(dados: Omit<Lancamento, 'id'>, op: OpcoesNovo = {}): Promise<() => Promise<void>> {
  const desfazer = await criarLancamentoSemAviso(dados, op);
  if (dados.tipo === 'entrada' && dados.certeza === 'garantida' && dados.status === 'realizado') avisarEntradaRecebida(dados.valor);
  return desfazer;
}

async function criarLancamentoSemAviso(dados: Omit<Lancamento, 'id'>, op: OpcoesNovo): Promise<() => Promise<void>> {
  const cartao = dados.cartaoId ? await repositorio.cartoes.obter(dados.cartaoId) : undefined;

  if (op.repeticao) {
    const { frequencia, vezes, certezaProximas } = op.repeticao;
    const { data, status: _s, recorrenciaId: _r, recorrenciaData: _d, parcela: _p, faturaRef: _f, ...resto } = dados;
    // Entrada repetida: as próximas vezes têm a certeza escolhida (comissão futura costuma ser provável).
    const modelo = dados.tipo === 'entrada' && certezaProximas ? { ...resto, certeza: certezaProximas } : resto;
    const rec: Omit<Recorrencia, 'id'> = {
      modelo, frequencia, diaDoMes: Number(data.slice(8, 10)), dataInicio: data, ativa: true,
      ...(vezes ? { fim: dataDaOcorrencia(data, frequencia, vezes) } : {}),
    };
    const salvo = await repositorio.recorrencias.criar(rec);
    await garantirFixosDoMes(mesDe(data));
    if (mesDe(hojeISO()) !== mesDe(data)) await garantirFixosDoMes(mesDe(hojeISO()));
    const primeiro = (await repositorio.lancamentos.porRecorrencia(salvo.id)).find((l) => l.recorrenciaData === data);
    if (primeiro && (primeiro.status !== dados.status || primeiro.certeza !== dados.certeza))
      await repositorio.lancamentos.atualizar(primeiro.id, { status: dados.status, certeza: dados.certeza });
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

export type Escopo = 'este' | 'proximos' | 'todos';

/**
 * Exclui um lançamento. Em parcelado ou repetição, `escopo` diz se é só este, este e os próximos, ou todos.
 * Excluir "só este" de uma repetição guarda a data como exceção, para ela não voltar.
 */
export async function excluirLancamento(l: Lancamento, escopo: Escopo = 'este'): Promise<void> {
  if (l.parcela) {
    const ps = await repositorio.lancamentos.porGrupoParcela(l.parcela.grupoId);
    const alvo = escopo === 'todos' ? ps : escopo === 'proximos' ? ps.filter((p) => p.parcela!.numero >= l.parcela!.numero) : [l];
    await repositorio.lancamentos.excluirVarios(alvo.map((p) => p.id));
    return;
  }
  const rec = l.recorrenciaId ? await repositorio.recorrencias.obter(l.recorrenciaId) : undefined;
  if (!rec) { await repositorio.lancamentos.excluir(l.id); return; }
  const dataOc = l.recorrenciaData ?? l.data;
  const todos = await repositorio.lancamentos.porRecorrencia(rec.id);
  if (escopo === 'todos') {
    await repositorio.lancamentos.excluirVarios(todos.map((x) => x.id));
    await repositorio.recorrencias.excluir(rec.id);
  } else if (escopo === 'proximos') {
    await repositorio.lancamentos.excluirVarios(todos.filter((x) => (x.recorrenciaData ?? x.data) >= dataOc).map((x) => x.id));
    const fim = somarDias(dataOc, -1);
    if (rec.dataInicio && fim < rec.dataInicio) await repositorio.recorrencias.excluir(rec.id);
    else await repositorio.recorrencias.salvar({ ...rec, fim });
  } else {
    await repositorio.recorrencias.salvar({ ...rec, excecoes: [...(rec.excecoes ?? []), dataOc] });
    await repositorio.lancamentos.excluir(l.id);
  }
}

// ---------- Economia ----------

/** A reserva de emergência (cria se ainda não existir). */
export async function garantirReserva(): Promise<Meta> {
  const metas = await repositorio.metas.listar();
  return metas.find((m) => m.tipo === 'reserva_emergencia')
    ?? repositorio.metas.criar({ nome: 'Reserva de emergência', tipo: 'reserva_emergencia', valorAlvo: 0, saldoAtual: 0 });
}

// ---------- Cartões ----------

export interface ResumoCartao {
  cartao: Cartao;
  /** Todas as faturas com compras, em ordem de vencimento. */
  faturas: Fatura[];
  /** A próxima a pagar (pode estar com total 0). */
  proxima: Fatura;
  /** O que ainda não foi pago (inclui parcelas futuras). */
  limiteUsado: Centavos;
  melhorDia: number;
  lancamentos: Lancamento[];
}

export async function resumoDosCartoes(): Promise<ResumoCartao[]> {
  await garantirFixosDoMes(mesDe(hojeISO()));
  await garantirFixosDoMes(somarMeses(mesDe(hojeISO()), 1));
  const [cartoes, todos] = await Promise.all([repositorio.cartoes.listar(), repositorio.lancamentos.listar()]);
  const hoje = hojeISO();
  return cartoes.map((cartao) => {
    const lancamentos = todos.filter((l) => l.cartaoId === cartao.id);
    const faturas = calcularFaturas(lancamentos, [cartao]);
    const ref = proximaFaturaAPagar(hoje, cartao);
    const vazia: Fatura = { cartaoId: cartao.id, faturaRef: ref, vencimento: vencimentoDaFatura(ref, cartao), contaId: cartao.contaPagamentoId, total: 0, pago: 0, restante: 0 };
    // a fatura "atual" é a primeira ainda não paga a partir da próxima a pagar
    const proxima = faturas.find((f) => f.faturaRef >= ref && f.restante > 0) ?? faturas.find((f) => f.faturaRef === ref) ?? vazia;
    return {
      cartao, faturas, proxima, lancamentos,
      limiteUsado: faturas.reduce((s, f) => s + f.restante, 0),
      melhorDia: cartao.diaFechamento >= 28 ? 1 : cartao.diaFechamento + 1,
    };
  });
}

// ---------- Fase 5: tela Hoje e Totais ----------

const fimDoMes = (mes: MesRef) => `${mes}-${String(diasNoMes(mes)).padStart(2, '0')}`;

/** Tudo o que existe desde o início do uso até o fim do mês (com os fixos já gerados). */
async function lancamentosAte(mes: MesRef): Promise<{ inicio: DataISO; lancamentos: Lancamento[] }> {
  const inicio = await dataDeInicio();
  for (let m = mesDe(inicio) < mes ? mesDe(inicio) : mes; m <= mes; m = somarMeses(m, 1)) await garantirFixosDoMes(m);
  const desde = inicio < `${mes}-01` ? inicio : `${mes}-01`;
  return { inicio, lancamentos: await repositorio.lancamentos.porPeriodo(desde, fimDoMes(mes)) };
}

/**
 * Dinheiro de partida do mês para o "livre por dia":
 * - No primeiro mês de uso: o saldo que você informou nas contas.
 * - Depois: a sobra do mês anterior se a configuração for "Próximo mês"; se for "Reserva", só conta se for negativa.
 * - Menos a fatura que já estava aberta antes do app (é dinheiro já comprometido).
 */
function calcularPartida(
  mes: MesRef, inicioApp: DataISO, destino: 'reserva' | 'proximoMes',
  contas: Conta[], lancamentos: Lancamento[], cartoes: Cartao[], hoje: DataISO,
): { partida: Centavos; sobraAnterior: Centavos } {
  const vespera = somarDias(`${mes}-01`, -1);
  const virada = saldoDasContas(contas, lancamentos, cartoes, vespera, true).total;
  const novas = contas.filter((c) => c.dataSaldoInicial >= `${mes}-01` && c.dataSaldoInicial <= hoje).reduce((s, c) => s + c.saldoInicial, 0);
  const primeiroMes = mesDe(inicioApp) === mes;
  const daVirada = primeiroMes || destino === 'proximoMes' ? virada : Math.min(0, virada);
  const porCartao = new Map(cartoes.map((c) => [c.id, c]));
  const divida = lancamentos.filter((l) => l.saldoAnterior && l.cartaoId && porCartao.has(l.cartaoId)
    && vencimentoDaFatura(l.faturaRef ?? mesDe(l.data), porCartao.get(l.cartaoId)!) <= fimDoMes(mes)).reduce((s, l) => s + l.valor, 0);
  return { partida: daVirada + novas - divida, sobraAnterior: primeiroMes ? 0 : virada };
}

export interface ItemChegando {
  tipo: 'lancamento' | 'fatura';
  data: DataISO;
  atrasado: boolean;
  lancamento?: Lancamento;
  fatura?: Fatura;
}

export interface ResumoHoje {
  hoje: DataISO;
  livre: LivrePorDia;
  alerta: AlertaCaixa | null;
  saldoHoje: { total: Centavos; porConta: Record<Id, Centavos> };
  fimDoMes: Centavos;
  chegando: ItemChegando[];
  totais: TotaisMes;
  /** Fixos ainda não pagos + faturas a vencer até o fim do mês. */
  faltaPagar: Centavos;
  reserva: Centavos;
  /** Sobra do mês passado ainda na conta (quando o destino é a reserva). */
  sobraParaGuardar: Centavos;
}

export async function resumoHoje(diasAFrente = 10): Promise<ResumoHoje> {
  const hoje = hojeISO();
  const mes = mesDe(hoje);
  const ate = mesDe(somarDias(hoje, diasAFrente));
  const [{ inicio, lancamentos }, contas, cartoes, config, metas] = await Promise.all([
    lancamentosAte(ate), repositorio.contas.listar(), repositorio.cartoes.listar(), repositorio.obterConfig(), repositorio.metas.listar(),
  ]);
  const doMes = lancamentos.filter((l) => l.data.startsWith(mes));
  const { partida, sobraAnterior } = calcularPartida(mes, inicio, config.destinoSobraMes, contas, lancamentos, cartoes, hoje);
  const faturas = calcularFaturas(lancamentos, cartoes);
  const limite = somarDias(hoje, diasAFrente);

  const chegando: ItemChegando[] = [
    ...lancamentos.filter((l) => l.status === 'previsto' && l.data <= limite && l.data >= `${mes}-01` && l.tipo !== 'transferencia' && !(l.tipo === 'saida' && l.cartaoId))
      .map((l) => ({ tipo: 'lancamento' as const, data: l.data, atrasado: l.data < hoje, lancamento: l })),
    ...faturas.filter((f) => f.restante > 0 && f.vencimento <= limite && f.vencimento >= `${mes}-01`)
      .map((f) => ({ tipo: 'fatura' as const, data: f.vencimento, atrasado: f.vencimento < hoje, fatura: f })),
  ].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

  const fim = fimDoMes(mes);
  const faltaPagar = doMes.filter((l) => l.status === 'previsto' && l.tipo !== 'entrada' && l.contaId && !l.cartaoId).reduce((s, l) => s + l.valor, 0)
    + faturas.filter((f) => f.vencimento >= `${mes}-01` && f.vencimento <= fim).reduce((s, f) => s + f.restante, 0);
  const reservaId = metas.find((m) => m.tipo === 'reserva_emergencia')?.id;
  const reserva = lancamentos.filter((l) => l.tipo === 'transferencia' && l.destino?.id === reservaId && l.data <= hoje).reduce((s, l) => s + l.valor, 0);

  return {
    hoje,
    livre: livrePorDia(doMes, hoje, partida),
    alerta: alertaDeCaixa(contas, lancamentos, cartoes, hoje),
    saldoHoje: saldoDasContas(contas, lancamentos, cartoes, hoje),
    fimDoMes: saldoDasContas(contas, lancamentos, cartoes, fim).total,
    chegando,
    totais: totaisDoMes(doMes, mes, hoje, inicio),
    faltaPagar,
    reserva,
    sobraParaGuardar: config.destinoSobraMes === 'reserva' && sobraAnterior > 0 ? sobraAnterior : 0,
  };
}

/** 5.7: como dividir uma entrada que acabou de cair (ela já está salva). */
export async function sugerirDivisao(valor: Centavos): Promise<Divisao> {
  const hoje = hojeISO();
  const mes = mesDe(hoje);
  const [{ lancamentos }, contas, cartoes, config] = await Promise.all([
    lancamentosAte(mes), repositorio.contas.listar(), repositorio.cartoes.listar(), repositorio.obterConfig(),
  ]);
  const fim = fimDoMes(mes);
  const aPagar = lancamentos.filter((l) => l.status === 'previsto' && l.tipo !== 'entrada' && l.contaId && !l.cartaoId && l.data >= hoje && l.data <= fim)
    .reduce((s, l) => s + l.valor, 0)
    + calcularFaturas(lancamentos, cartoes).filter((f) => f.vencimento >= hoje && f.vencimento <= fim).reduce((s, f) => s + f.restante, 0);
  const tinhaAntes = saldoDasContas(contas, lancamentos, cartoes, hoje, true).total - valor;
  return dividirEntrada(valor, Math.max(0, aPagar - Math.max(0, tinhaAntes)), config.divisaoEntrada ?? PERCENTUAIS_PADRAO);
}

/** Guarda na reserva agora (economia de hoje). */
export async function guardarNaReserva(valor: Centavos): Promise<void> {
  if (valor <= 0) return;
  const [reserva, config, contas] = await Promise.all([garantirReserva(), repositorio.obterConfig(), repositorio.contas.listar()]);
  const contaId = config.contaPadraoId ?? contas[0]?.id;
  if (!contaId) return;
  await repositorio.lancamentos.criar({
    tipo: 'transferencia', valor, data: hojeISO(), descricao: `Guardado: ${reserva.nome}`, contaId,
    destino: { tipo: 'meta', id: reserva.id }, certeza: 'garantida', status: 'realizado',
  });
}

export interface TotaisTela { mes: MesRef; totais: TotaisMes; ano: { mes: MesRef; totais: TotaisMes }[] }

export async function totaisDaTela(mes: MesRef): Promise<TotaisTela> {
  const hoje = hojeISO();
  const ano = mes.slice(0, 4);
  const ultimo = mes > mesDe(hoje) ? mes : mesDe(hoje) > `${ano}-12` ? `${ano}-12` : mesDe(hoje);
  const { inicio } = await lancamentosAte(ultimo < mes ? mes : ultimo);
  const doAno = await repositorio.lancamentos.porPeriodo(`${ano}-01-01`, `${ano}-12-31`);
  const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`).filter((m) => m <= ultimo);
  const por = (m: MesRef) => totaisDoMes(doAno.filter((l) => l.data.startsWith(m)), m, hoje, inicio);
  return { mes, totais: por(mes), ano: meses.map((m) => ({ mes: m, totais: por(m) })) };
}
