// Valores iniciais que dependem do perfil de renda, e as categorias que o app já traz.
import type { Categoria, Certeza, PerfilRenda, TipoFonteRenda } from '../tipos';
import { normalizar } from './texto';

export interface PadraoPerfil {
  rotulo: string;
  descricao: string;
  mesesReservaAlvo: number;
  faixaReserva: [number, number];
  /** Fontes sugeridas no onboarding. */
  fontesSugeridas: { nome: string; tipo: TipoFonteRenda; certezaPadrao: Certeza }[];
}

export const PERFIS: Record<PerfilRenda, PadraoPerfil> = {
  fixa: {
    rotulo: 'Salário fixo',
    descricao: 'Recebe o mesmo valor todo mês (CLT, servidor).',
    mesesReservaAlvo: 4,
    faixaReserva: [3, 6],
    fontesSugeridas: [{ nome: 'Salário', tipo: 'fixa', certezaPadrao: 'garantida' }],
  },
  variavel: {
    rotulo: 'Comissão',
    descricao: 'Ganha conforme vende. Muda todo mês.',
    mesesReservaAlvo: 9,
    faixaReserva: [6, 12],
    fontesSugeridas: [{ nome: 'Comissão', tipo: 'variavel', certezaPadrao: 'provavel' }],
  },
  autonoma: {
    rotulo: 'Autônomo',
    descricao: 'Recebe por serviço ou cliente.',
    mesesReservaAlvo: 9,
    faixaReserva: [6, 12],
    fontesSugeridas: [{ nome: 'Serviços', tipo: 'autonoma', certezaPadrao: 'provavel' }],
  },
  sazonal: {
    rotulo: 'Sazonal',
    descricao: 'Entra muito em alguns meses e pouco nos outros.',
    mesesReservaAlvo: 12,
    faixaReserva: [6, 12],
    fontesSugeridas: [{ nome: 'Temporada', tipo: 'sazonal', certezaPadrao: 'possivel' }],
  },
  mista: {
    rotulo: 'Salário + comissão',
    descricao: 'Tem um salário fixo e uma parte variável.',
    mesesReservaAlvo: 6,
    faixaReserva: [6, 12],
    fontesSugeridas: [
      { nome: 'Salário', tipo: 'fixa', certezaPadrao: 'garantida' },
      { nome: 'Comissão', tipo: 'variavel', certezaPadrao: 'provavel' },
    ],
  },
};

export const ROTULO_CERTEZA: Record<Certeza, string> = {
  garantida: 'Garantida',
  provavel: 'Provável',
  possivel: 'Possível',
};

export const DESCRICAO_CERTEZA: Record<Certeza, string> = {
  garantida: 'Já caiu ou é certo',
  provavel: 'Contrato fechado, a receber',
  possivel: 'Em negociação',
};

export const ROTULO_TIPO_FONTE: Record<TipoFonteRenda, string> = {
  fixa: 'Fixa',
  variavel: 'Variável',
  autonoma: 'Autônoma',
  sazonal: 'Sazonal',
};

/** Paleta das categorias: funciona no tema claro e no escuro. */
export const CORES_CATEGORIA = [
  '#e0613f', '#e39b26', '#c9b21c', '#4caf50', '#13955f', '#1f9bb8',
  '#3f7be0', '#6d4ad8', '#b04ad8', '#d84a8f', '#8a6d5a', '#6f7f78',
];

type CategoriaPadrao = Omit<Categoria, 'id'>;

const cat = (nome: string, tipo: Categoria['tipo'], icone: string, cor: string, palavras: string[]): CategoriaPadrao => ({
  nome, tipo, icone, cor, palavrasChave: [...new Set(palavras.map(normalizar))],
});

export const NOME_OUTROS_SAIDA = 'Outros';
export const NOME_OUTROS_ENTRADA = 'Outras entradas';

export const CATEGORIAS_PADRAO: CategoriaPadrao[] = [
  cat('Alimentação', 'saida', '🍽️', '#e0613f', ['almoço', 'almoco', 'jantar', 'lanche', 'restaurante', 'ifood', 'café', 'padaria', 'pizza', 'hamburguer', 'marmita', 'sorvete']),
  cat('Mercado', 'saida', '🛒', '#e39b26', ['mercado', 'supermercado', 'feira', 'açougue', 'hortifruti', 'atacadão', 'assaí']),
  cat('Transporte', 'saida', '🚗', '#3f7be0', ['uber', '99', 'gasolina', 'combustível', 'etanol', 'ônibus', 'metrô', 'estacionamento', 'pedágio', 'mecânico', 'ipva', 'táxi']),
  cat('Moradia', 'saida', '🏠', '#8a6d5a', ['aluguel', 'condomínio', 'luz', 'energia', 'água', 'gás', 'internet', 'iptu', 'faxina', 'diarista']),
  cat('Saúde', 'saida', '💊', '#4caf50', ['farmácia', 'remédio', 'médico', 'consulta', 'exame', 'dentista', 'plano de saúde', 'psicólogo']),
  cat('Lazer', 'saida', '🎉', '#b04ad8', ['cinema', 'bar', 'show', 'viagem', 'passeio', 'cerveja', 'balada', 'ingresso', 'hotel']),
  cat('Compras', 'saida', '🛍️', '#d84a8f', ['roupa', 'tênis', 'sapato', 'loja', 'presente', 'shopee', 'amazon', 'shein', 'mercado livre', 'eletrônico']),
  cat('Assinaturas', 'saida', '📺', '#6d4ad8', ['netflix', 'spotify', 'streaming', 'assinatura', 'icloud', 'youtube', 'disney', 'prime', 'celular', 'plano']),
  cat('Educação', 'saida', '📚', '#1f9bb8', ['curso', 'faculdade', 'livro', 'escola', 'mensalidade', 'material']),
  cat('Cuidados pessoais', 'saida', '💇', '#c9b21c', ['cabelo', 'barbearia', 'barbeiro', 'salão', 'manicure', 'cosmético', 'perfume', 'academia']),
  cat('Pets', 'saida', '🐾', '#13955f', ['pet', 'ração', 'veterinário', 'petshop', 'banho e tosa']),
  cat('Taxas e juros', 'saida', '🧾', '#6f7f78', ['tarifa', 'juros', 'multa', 'anuidade', 'iof', 'imposto', 'taxa']),
  cat(NOME_OUTROS_SAIDA, 'saida', '📦', '#6f7f78', []),
  cat('Comissão', 'entrada', '💼', '#13955f', ['comissão', 'comissao', 'bônus', 'premiação']),
  cat('Salário', 'entrada', '💰', '#4caf50', ['salário', 'pagamento', 'adiantamento', 'férias', '13º', 'décimo terceiro']),
  cat('Serviços', 'entrada', '🧰', '#1f9bb8', ['freela', 'freelance', 'serviço', 'cliente', 'projeto']),
  cat('Reembolso', 'entrada', '↩️', '#3f7be0', ['reembolso', 'estorno', 'devolução', 'pix de volta']),
  cat('Rendimentos', 'entrada', '📈', '#c9b21c', ['rendimento', 'juros recebidos', 'dividendo', 'cashback']),
  cat(NOME_OUTROS_ENTRADA, 'entrada', '➕', '#6f7f78', []),
];

/** Limita os meses de reserva a uma faixa razoável (1 a 24). */
export function limitarMesesReserva(meses: number): number {
  if (!Number.isFinite(meses)) return 6;
  return Math.min(24, Math.max(1, Math.round(meses)));
}

/** Perfis mostrados na primeira abertura (sazonal fica só nas Configurações). */
export const PERFIS_NA_ABERTURA: PerfilRenda[] = ['fixa', 'variavel', 'autonoma', 'mista'];
