import { repositorio } from './repositorio';
import { useConsulta } from './useConsulta';
import type { Cartao, Categoria, Conta, FonteRenda, Id } from '../tipos';

export interface Cadastros {
  contas: Conta[];
  cartoes: Cartao[];
  categorias: Categoria[];
  fontes: FonteRenda[];
  contaPadraoId?: Id;
  categoria: (id?: Id) => Categoria | undefined;
  conta: (id?: Id) => Conta | undefined;
  cartao: (id?: Id) => Cartao | undefined;
}

/** Tudo o que as telas precisam para mostrar nomes e ícones dos lançamentos. */
export function useCadastros(): Cadastros | undefined {
  return useConsulta(async () => {
    const [contas, cartoes, categorias, fontes, config] = await Promise.all([
      repositorio.contas.listar(), repositorio.cartoes.listar(), repositorio.categorias.listar(),
      repositorio.fontesRenda.listar(), repositorio.obterConfig(),
    ]);
    const porId = <T extends { id: Id }>(xs: T[]) => { const m = new Map(xs.map((x) => [x.id, x])); return (id?: Id) => (id ? m.get(id) : undefined); };
    return {
      contas, cartoes, categorias, fontes, contaPadraoId: config.contaPadraoId,
      categoria: porId(categorias), conta: porId(contas), cartao: porId(cartoes),
    };
  }, []);
}
