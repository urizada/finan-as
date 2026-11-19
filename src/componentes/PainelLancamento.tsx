import { useEffect } from 'react';
import { EmConstrucao } from './Tela';

/** Painel que sobe de baixo ao tocar no +. O lançamento rápido entra aqui na Fase 3. */
export function PainelLancamento({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/40" onClick={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Novo lançamento"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-md rounded-t-3xl bg-fundo px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-borda" />
        <h2 className="mb-3 text-lg font-bold">Novo lançamento</h2>
        <input
          id="lancamento-rapido"
          disabled
          placeholder="ex.: almoço 32"
          className="mb-4 w-full rounded-2xl border border-borda bg-superficie px-4 py-3.5 text-base placeholder:text-texto-2/70"
        />
        <EmConstrucao fase={3} itens={['Digite como fala: “uber 18,50 nubank”', 'Pré-visualização antes de salvar', 'O app aprende suas categorias']} />
        <button type="button" onClick={aoFechar} className="mt-4 w-full rounded-2xl bg-superficie-2 py-3 font-bold">
          Fechar
        </button>
      </div>
    </div>
  );
}
