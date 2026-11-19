import { useCadastros } from '../data/useCadastros';
import { FormLancamento } from './lancamentos';
import { Folha } from './ui';

/** Aberto pelo + da barra. Na Fase 3 ganha o campo de lançamento rápido no topo. */
export function PainelLancamento({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const cad = useCadastros();
  return (
    <Folha aberta={aberto} titulo="Novo lançamento" aoFechar={aoFechar}>
      {cad && <FormLancamento cad={cad} aoFechar={aoFechar} />}
    </Folha>
  );
}
