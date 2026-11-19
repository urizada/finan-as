// Regras de validação dos cadastros. Cada função devolve um mapa campo → mensagem (vazio = válido).
import type { Cartao, Categoria, Conta, FonteRenda, Recorrencia } from '../tipos';

export type Erros = Record<string, string>;

const diaValido = (d: number) => Number.isInteger(d) && d >= 1 && d <= 31;
const vazio = (t: string | undefined) => !t || !t.trim();

export function validarConta(c: Partial<Conta>): Erros {
  const e: Erros = {};
  if (vazio(c.nome)) e.nome = 'Dê um nome para a conta.';
  if (!Number.isInteger(c.saldoInicial)) e.saldoInicial = 'Informe o saldo de hoje.';
  return e;
}

export function validarCartao(c: Partial<Cartao>): Erros {
  const e: Erros = {};
  if (vazio(c.nome)) e.nome = 'Dê um nome para o cartão.';
  if (!Number.isInteger(c.limite) || (c.limite ?? 0) <= 0) e.limite = 'Informe o limite do cartão.';
  if (!diaValido(c.diaFechamento ?? 0)) e.diaFechamento = 'Use um dia de 1 a 31.';
  if (!diaValido(c.diaVencimento ?? 0)) e.diaVencimento = 'Use um dia de 1 a 31.';
  if (!e.diaFechamento && !e.diaVencimento && c.diaFechamento === c.diaVencimento)
    e.diaVencimento = 'O vencimento precisa ser em dia diferente do fechamento.';
  if (vazio(c.contaPagamentoId)) e.contaPagamentoId = 'Escolha a conta que paga a fatura.';
  return e;
}

export function validarFonte(f: Partial<FonteRenda>): Erros {
  const e: Erros = {};
  if (vazio(f.nome)) e.nome = 'Dê um nome para a fonte.';
  if (!Number.isInteger(f.valorMedioMensal) || (f.valorMedioMensal ?? -1) < 0)
    e.valorMedioMensal = 'Informe quanto entra, em média, por mês.';
  if (f.taxaComissao !== undefined && !(f.taxaComissao > 0 && f.taxaComissao <= 1))
    e.taxaComissao = 'Use um percentual entre 0 e 100, ex.: 3,5.';
  return e;
}

export function validarRecorrencia(r: Partial<Recorrencia>): Erros {
  const e: Erros = {};
  const m = r.modelo ?? {};
  if (vazio(m.descricao)) e.descricao = 'Diga o que é, ex.: Aluguel.';
  if (!Number.isInteger(m.valor) || (m.valor ?? 0) <= 0) e.valor = 'Informe o valor.';
  const freq = r.frequencia ?? 'mensal';
  if (freq === 'mensal' && !diaValido(r.diaDoMes ?? 0)) e.diaDoMes = 'Use um dia de 1 a 31.';
  if (freq !== 'mensal' && !r.dataInicio) e.dataInicio = 'Escolha a data da primeira vez.';
  if (r.fim && r.dataInicio && r.fim < r.dataInicio) e.fim = 'O fim precisa ser depois do início.';
  if (vazio(m.contaId) && vazio(m.cartaoId)) e.contaId = 'Escolha onde cai ou de onde sai.';
  return e;
}

export function validarCategoria(c: Partial<Categoria>, existentes: Categoria[]): Erros {
  const e: Erros = {};
  const nome = c.nome?.trim().toLowerCase();
  if (!nome) e.nome = 'Dê um nome para a categoria.';
  else if (existentes.some((x) => x.id !== c.id && x.tipo === c.tipo && x.nome.trim().toLowerCase() === nome))
    e.nome = 'Já existe uma categoria com esse nome.';
  return e;
}

export const valido = (e: Erros) => Object.keys(e).length === 0;
