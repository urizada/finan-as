// Avisos simples entre a camada de dados e a interface.
import type { Centavos } from '../tipos';

type Ouvinte = (valor: Centavos) => void;
const ouvintes = new Set<Ouvinte>();

/** Uma entrada garantida acabou de cair (lançamento novo). */
export function avisarEntradaRecebida(valor: Centavos): void {
  ouvintes.forEach((o) => o(valor));
}

export function aoReceberEntrada(o: Ouvinte): () => void {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}
