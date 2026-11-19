// Schema Dexie (IndexedDB). SOMENTE src/data/repositorio.ts pode importar este arquivo.
import Dexie, { type EntityTable } from 'dexie';
import type {
  Cartao, Categoria, Config, Conta, FonteRenda, Investimento, Lancamento,
  Meta, Recorrencia, SnapshotInvestimento,
} from '../tipos';

export class BancoFinancas extends Dexie {
  config!: EntityTable<Config, 'id'>;
  contas!: EntityTable<Conta, 'id'>;
  categorias!: EntityTable<Categoria, 'id'>;
  fontesRenda!: EntityTable<FonteRenda, 'id'>;
  lancamentos!: EntityTable<Lancamento, 'id'>;
  recorrencias!: EntityTable<Recorrencia, 'id'>;
  cartoes!: EntityTable<Cartao, 'id'>;
  metas!: EntityTable<Meta, 'id'>;
  investimentos!: EntityTable<Investimento, 'id'>;
  snapshotsInvestimento!: EntityTable<SnapshotInvestimento, 'id'>;

  constructor(nome = 'financas') {
    super(nome);
    // Só os campos indexados são listados; os demais são salvos normalmente.
    this.version(1).stores({
      config: 'id',
      contas: 'id',
      categorias: 'id, tipo',
      fontesRenda: 'id',
      lancamentos:
        'id, data, tipo, status, categoriaId, contaId, cartaoId, faturaRef, recorrenciaId, parcela.grupoId',
      recorrencias: 'id, ativa',
      cartoes: 'id',
      metas: 'id, tipo',
      investimentos: 'id',
      snapshotsInvestimento: 'id, investimentoId, data, [investimentoId+data]',
    });
  }
}
