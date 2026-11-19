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
  parcela?: Parcela;
  destino?: { tipo: 'meta' | 'investimento'; id: Id };
}

export interface Recorrencia {
  id: Id;
  modelo: Partial<Omit<Lancamento, 'id'>>;
  diaDoMes: number;
  ativa: boolean;
  fim?: DataISO;
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
  saldoAtual: Centavos;
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
