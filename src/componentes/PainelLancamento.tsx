import { useEffect, useState } from 'react';
import { useCadastros } from '../data/useCadastros';
import { FormLancamento, type InicialLancamento } from './lancamentos';
import { LancamentoRapido } from './LancamentoRapido';
import { Folha } from './ui';

/** Aberto pelo + da barra: lançamento rápido; "Mais detalhes" abre o formulário completo. */
export function PainelLancamento({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const cad = useCadastros();
  const [completo, setCompleto] = useState<InicialLancamento | null>(null);
  useEffect(() => { if (!aberto) setCompleto(null); }, [aberto]);
  return (
    <Folha aberta={aberto} titulo={completo ? 'Novo lançamento' : 'Lançar'} aoFechar={aoFechar}>
      {cad && (completo ? (
        <FormLancamento cad={cad} inicial={completo} aoFechar={aoFechar} />
      ) : (
        <div className="flex flex-col gap-3">
          <LancamentoRapido cad={cad} aoDetalhes={setCompleto} autoFocus />
          <button type="button" onClick={() => setCompleto({})} className="self-center py-2 text-sm font-bold text-destaque">
            Preencher campo a campo
          </button>
        </div>
      ))}
    </Folha>
  );
}
