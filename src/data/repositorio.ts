// Única porta de acesso aos dados. Componentes e telas usam só o que está aqui.
// Na v2 basta trocar a implementação (ex.: Supabase) mantendo a interface `Repositorio`.
import { BancoFinancas } from './db';
import type { EntityTable, Table } from 'dexie';
import type {
  Cartao, Categoria, Config, Conta, DataISO, FonteRenda, Id, Investimento,
  Lancamento, Meta, MesRef, Recorrencia, SnapshotInvestimento,
} from '../tipos';

type ComId = { id: Id };
export type Novo<T extends ComId> = Omit<T, 'id'> & { id?: Id };

/** Operações básicas iguais para todas as coleções. */
export interface Colecao<T extends ComId> {
  listar(): Promise<T[]>;
  obter(id: Id): Promise<T | undefined>;
  /** Cria (gera id se faltar) e devolve o registro salvo. */
  criar(item: Novo<T>): Promise<T>;
  /** Cria ou substitui pelo id. */
  salvar(item: T): Promise<T>;
  atualizar(id: Id, mudancas: Partial<Omit<T, 'id'>>): Promise<void>;
  excluir(id: Id): Promise<void>;
}

export interface ColecaoLancamentos extends Colecao<Lancamento> {
  /** Inclusive nas duas pontas. */
  porPeriodo(inicio: DataISO, fim: DataISO): Promise<Lancamento[]>;
  porMes(mes: MesRef): Promise<Lancamento[]>;
  porFatura(cartaoId: Id, faturaRef: MesRef): Promise<Lancamento[]>;
  porGrupoParcela(grupoId: Id): Promise<Lancamento[]>;
  criarVarios(itens: Novo<Lancamento>[]): Promise<Lancamento[]>;
}

export interface Backup {
  versao: 1;
  exportadoEm: string;
  dados: {
    config: Config[];
    contas: Conta[];
    categorias: Categoria[];
    fontesRenda: FonteRenda[];
    lancamentos: Lancamento[];
    recorrencias: Recorrencia[];
    cartoes: Cartao[];
    metas: Meta[];
    investimentos: Investimento[];
    snapshotsInvestimento: SnapshotInvestimento[];
  };
}

export interface Repositorio {
  obterConfig(): Promise<Config>;
  salvarConfig(mudancas: Partial<Omit<Config, 'id'>>): Promise<Config>;
  contas: Colecao<Conta>;
  categorias: Colecao<Categoria>;
  fontesRenda: Colecao<FonteRenda>;
  lancamentos: ColecaoLancamentos;
  recorrencias: Colecao<Recorrencia>;
  cartoes: Colecao<Cartao>;
  metas: Colecao<Meta>;
  investimentos: Colecao<Investimento>;
  snapshotsInvestimento: Colecao<SnapshotInvestimento>;
  exportar(): Promise<Backup>;
  /** Substitui TODOS os dados pelos do backup. */
  importar(backup: Backup): Promise<void>;
  /** Avisa quando qualquer dado muda (para as telas se atualizarem). */
  aoMudar(ouvinte: () => void): () => void;
}

export const CONFIG_PADRAO: Config = {
  id: 'principal',
  perfilRenda: 'variavel',
  mesesReservaAlvo: 6,
  destinoSobraMes: 'reserva',
  onboardingConcluido: false,
  tema: 'claro',
};

export function novoId(): Id {
  return crypto.randomUUID();
}

// ---------- Implementação com Dexie ----------

export function criarRepositorioDexie(nomeBanco = 'financas'): Repositorio {
  const db = new BancoFinancas(nomeBanco);
  const ouvintes = new Set<() => void>();
  const avisar = () => ouvintes.forEach((o) => o());

  function colecao<T extends ComId>(entidade: EntityTable<T, 'id'>): Colecao<T> {
    // EntityTable aceita inserção sem id; aqui sempre gravamos com id, então a visão simples basta.
    const tabela = entidade as unknown as Table<T, Id, T>;
    return {
      listar: () => tabela.toArray(),
      obter: (id) => tabela.get(id),
      async criar(item) {
        const salvo = { ...item, id: item.id ?? novoId() } as T;
        await tabela.add(salvo);
        avisar();
        return salvo;
      },
      async salvar(item) {
        await tabela.put(item);
        avisar();
        return item;
      },
      async atualizar(id, mudancas) {
        const atual = await tabela.get(id);
        if (!atual) throw new Error(`Registro não encontrado: ${id}`);
        await tabela.put({ ...atual, ...mudancas, id });
        avisar();
      },
      async excluir(id) {
        await tabela.delete(id);
        avisar();
      },
    };
  }

  const lancamentos: ColecaoLancamentos = {
    ...colecao<Lancamento>(db.lancamentos),
    porPeriodo: (inicio, fim) =>
      db.lancamentos.where('data').between(inicio, fim, true, true).sortBy('data'),
    porMes: (mes) =>
      db.lancamentos.where('data').between(`${mes}-01`, `${mes}-31`, true, true).sortBy('data'),
    porFatura: (cartaoId, faturaRef) =>
      db.lancamentos.where({ cartaoId, faturaRef }).toArray(),
    porGrupoParcela: (grupoId) =>
      db.lancamentos.where('parcela.grupoId').equals(grupoId).sortBy('parcela.numero'),
    async criarVarios(itens) {
      const salvos = itens.map((i) => ({ ...i, id: i.id ?? novoId() }) as Lancamento);
      await db.lancamentos.bulkAdd(salvos);
      avisar();
      return salvos;
    },
  };

  const tabelas = [
    db.config, db.contas, db.categorias, db.fontesRenda, db.lancamentos,
    db.recorrencias, db.cartoes, db.metas, db.investimentos, db.snapshotsInvestimento,
  ];

  return {
    async obterConfig() {
      return (await db.config.get('principal')) ?? CONFIG_PADRAO;
    },
    async salvarConfig(mudancas) {
      const atual = (await db.config.get('principal')) ?? CONFIG_PADRAO;
      const nova: Config = { ...atual, ...mudancas, id: 'principal' };
      await db.config.put(nova);
      avisar();
      return nova;
    },
    contas: colecao(db.contas),
    categorias: colecao(db.categorias),
    fontesRenda: colecao(db.fontesRenda),
    lancamentos,
    recorrencias: colecao(db.recorrencias),
    cartoes: colecao(db.cartoes),
    metas: colecao(db.metas),
    investimentos: colecao(db.investimentos),
    snapshotsInvestimento: colecao(db.snapshotsInvestimento),

    async exportar() {
      const [config, contas, categorias, fontesRenda, lanc, recorrencias, cartoes, metas, investimentos, snapshotsInvestimento] =
        await Promise.all(tabelas.map((t) => t.toArray()));
      return {
        versao: 1,
        exportadoEm: new Date().toISOString(),
        dados: {
          config, contas, categorias, fontesRenda, lancamentos: lanc, recorrencias,
          cartoes, metas, investimentos, snapshotsInvestimento,
        } as Backup['dados'],
      };
    },
    async importar(backup) {
      if (backup?.versao !== 1 || !backup.dados) throw new Error('Arquivo de backup inválido.');
      const d = backup.dados;
      await db.transaction('rw', tabelas, async () => {
        await Promise.all(tabelas.map((t) => t.clear()));
        await db.config.bulkPut(d.config ?? []);
        await db.contas.bulkPut(d.contas ?? []);
        await db.categorias.bulkPut(d.categorias ?? []);
        await db.fontesRenda.bulkPut(d.fontesRenda ?? []);
        await db.lancamentos.bulkPut(d.lancamentos ?? []);
        await db.recorrencias.bulkPut(d.recorrencias ?? []);
        await db.cartoes.bulkPut(d.cartoes ?? []);
        await db.metas.bulkPut(d.metas ?? []);
        await db.investimentos.bulkPut(d.investimentos ?? []);
        await db.snapshotsInvestimento.bulkPut(d.snapshotsInvestimento ?? []);
      });
      avisar();
    },
    aoMudar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
  };
}

/** Instância usada pelo app. */
export const repositorio: Repositorio = criarRepositorioDexie();
