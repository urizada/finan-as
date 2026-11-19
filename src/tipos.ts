// Modelo de dados da v1 (CLAUDE.md, seção 4).
// Todo valor em dinheiro é Centavos: número inteiro, nunca float.

export type Centavos = number;
export type Id = string;
/** Data no formato ISO 'AAAA-MM-DD'. Na tela é exibida como dd/mm/aaaa. */
export type DataISO = string;
/** Mês no formato 'AAAA-MM'. */
export type MesRef = string;

export type Certeza = 'garantida' | 'provavel' | 'possivel';
export type PerfilRenda = 'fixa' | 'variavel' | 'autonoma' | 'sazonal' | 'mista';
export type TipoFonteRenda = Exclude<PerfilRenda, 'mista'>;

export interface Config {
  id: 'principal';
  perfilRenda: PerfilRenda;
  mesesReservaAlvo: number;
  destinoSobraMes: 'reserva' | 'proximoMes';
  onboardingConcluido: boolean;
  tema: 'claro' | 'escuro';
  /** Conta usada quando o lançamento não diz qual (lançamento rápido, fixos). */
  contaPadraoId?: Id;
  /** 5.7: como dividir o que sobra de uma entrada depois dos fixos (percentuais que somam 100). */
  divisaoEntrada?: { reserva: number; investimentos: number; metas: number; livre: number };
  /** Mostrar a sugestão de divisão ao lançar entrada que já caiu. Padrão: sim. */
  sugerirDivisao?: boolean;
}

export interface Conta {
  id: Id;
  nome: string;
  tipo: 'corrente' | 'carteira';
  saldoInicial: Centavos;
  /** Dia em que o saldo inicial foi informado. O saldo projetado parte daqui. */
  dataSaldoInicial: DataISO;
}

export interface Categoria {
  id: Id;
  nome: string;
  tipo: 'entrada' | 'saida';
  icone: string;
  cor: string;
  palavrasChave: string[];
  /** Limite de gasto por mês (só categorias de saída). */
  limiteMensal?: Centavos;
}

export interface FonteRenda {
  id: Id;
  nome: string;
  tipo: TipoFonteRenda;
  valorMedioMensal: Centavos;
  certezaPadrao: Certeza;
  /** Ex.: 0.035 para 3,5%. */
  taxaComissao?: number;
}

export interface Parcela {
  numero: number;
  total: number;
  grupoId: Id;
}

export interface Lancamento {
  id: Id;
  tipo: 'entrada' | 'saida' | 'transferencia';
  valor: Centavos;
  /** Data de competência (compra ou recebimento). */
  data: DataISO;
  descricao: string;
  categoriaId?: Id;
  contaId?: Id;
  cartaoId?: Id;
  faturaRef?: MesRef;
  fonteRendaId?: Id;
  /** Saídas são sempre 'garantida'. */
  certeza: Certeza;
  status: 'realizado' | 'previsto';
  recorrenciaId?: Id;
  /** Data prevista da ocorrência do fixo/repetição (continua igual se o usuário mudar a data). */
  recorrenciaData?: DataISO;
  parcela?: Parcela;
  /** Fatura que já estava aberta antes de começar a usar o app (não é gasto do mês). */
  saldoAnterior?: boolean;
  /** Transferência que tira da meta/investimento e volta para a conta. */
  retirada?: boolean;
  destino?: { tipo: 'meta' | 'investimento'; id: Id };
}

export type Frequencia = 'mensal' | 'quinzenal' | 'semanal';

export interface Recorrencia {
  id: Id;
  modelo: Partial<Omit<Lancamento, 'id'>>;
  /** Padrão: mensal. */
  frequencia?: Frequencia;
  /** Usado na frequência mensal. */
  diaDoMes: number;
  /** Primeira ocorrência. Obrigatório para semanal/quinzenal. */
  dataInicio?: DataISO;
  ativa: boolean;
  /** Data da última ocorrência. */
  fim?: DataISO;
  /** Datas que você excluiu só daquela vez (não são criadas de novo). */
  excecoes?: DataISO[];
}

export interface Cartao {
  id: Id;
  nome: string;
  limite: Centavos;
  diaFechamento: number;
  diaVencimento: number;
  contaPagamentoId: Id;
}

export interface Meta {
  id: Id;
  nome: string;
  tipo: 'reserva_emergencia' | 'meta';
  valorAlvo: Centavos;
  prazo?: DataISO;
  /** Saldo que já existia antes do app. O atual = este + aportes − retiradas. */
  saldoAtual: Centavos;
  criadaEm?: DataISO;
}

export type TipoInvestimento =
  | 'caixinha' | 'cdb' | 'tesouro' | 'acoes' | 'fii' | 'cripto' | 'outro';

export interface Investimento {
  id: Id;
  nome: string;
  tipo: TipoInvestimento;
  instituicao: string;
  rendimentoDescricao?: string;
  aporteMensalPlanejado: Centavos;
}

export interface SnapshotInvestimento {
  id: Id;
  investimentoId: Id;
  data: DataISO;
  saldo: Centavos;
}
