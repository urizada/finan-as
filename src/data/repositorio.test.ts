import { beforeEach, describe, expect, it } from 'vitest';
import { criarRepositorioDexie, type Repositorio } from './repositorio';
import type { Lancamento } from '../tipos';

let repo: Repositorio;
let n = 0;
beforeEach(() => { repo = criarRepositorioDexie(`teste-${n++}`); });

const base = (data: string, valor: number): Omit<Lancamento, 'id'> => ({
  tipo: 'saida', valor, data, descricao: 'x', certeza: 'garantida', status: 'realizado',
});

describe('repositorio (Dexie)', () => {
  it('config tem padrão e salva mudanças', async () => {
    expect((await repo.obterConfig()).mesesReservaAlvo).toBe(6);
    await repo.salvarConfig({ mesesReservaAlvo: 9 });
    expect((await repo.obterConfig()).mesesReservaAlvo).toBe(9);
  });

  it('CRUD de contas', async () => {
    const c = await repo.contas.criar({ nome: 'Nubank', tipo: 'corrente', saldoInicial: 150000, dataSaldoInicial: '2026-11-19' });
    expect(c.id).toBeTruthy();
    await repo.contas.atualizar(c.id, { saldoInicial: 200000 });
    expect((await repo.contas.obter(c.id))?.saldoInicial).toBe(200000);
    await repo.contas.excluir(c.id);
    expect(await repo.contas.listar()).toEqual([]);
  });

  it('busca lançamentos por mês', async () => {
    await repo.lancamentos.criarVarios([
      base('2026-10-31', 100), base('2026-11-01', 200), base('2026-11-30', 300), base('2026-12-01', 400),
    ]);
    const nov = await repo.lancamentos.porMes('2026-11');
    expect(nov.map((l) => l.valor)).toEqual([200, 300]);
  });

  it('exporta e importa backup', async () => {
    await repo.contas.criar({ nome: 'Carteira', tipo: 'carteira', saldoInicial: 5000, dataSaldoInicial: '2026-11-19' });
    const backup = await repo.exportar();
    const outro = criarRepositorioDexie(`teste-${n++}`);
    await outro.importar(JSON.parse(JSON.stringify(backup)));
    expect((await outro.contas.listar())[0].nome).toBe('Carteira');
  });

  it('avisa ouvintes quando muda', async () => {
    let avisos = 0;
    const parar = repo.aoMudar(() => avisos++);
    await repo.contas.criar({ nome: 'A', tipo: 'corrente', saldoInicial: 0, dataSaldoInicial: '2026-11-19' });
    parar();
    await repo.contas.criar({ nome: 'B', tipo: 'corrente', saldoInicial: 0, dataSaldoInicial: '2026-11-19' });
    expect(avisos).toBe(1);
  });
});
