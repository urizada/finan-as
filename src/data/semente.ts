// Dados iniciais gravados na primeira abertura. Usa só o repositório.
import { repositorio } from './repositorio';
import { CATEGORIAS_PADRAO } from '../calculos/padroes';

/** Cria as categorias padrão se ainda não houver nenhuma. */
export async function garantirCategoriasPadrao(): Promise<void> {
  const existentes = await repositorio.categorias.listar();
  if (existentes.length > 0) return;
  for (const c of CATEGORIAS_PADRAO) await repositorio.categorias.criar({ ...c, palavrasChave: [...c.palavrasChave] });
}
