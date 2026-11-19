import { useEffect, useState } from 'react';
import { useCadastros } from '../data/useCadastros';
import { FormRecorrencia } from './formularios';
import { FormEconomia } from './FormEconomia';
import { FormLancamento, type InicialLancamento, type ModoLancamento } from './lancamentos';
import { LancamentoRapido } from './LancamentoRapido';
import { Folha } from './ui';

type Escolha = ModoLancamento | 'fixo' | 'economia' | 'detalhes';

const OPCOES: { id: Escolha; titulo: string; sub: string; icone: string; cor: string }[] = [
  { id: 'entrada', titulo: 'Entrada', sub: 'Comissão, salário', icone: '↙', cor: 'var(--color-entrada)' },
  { id: 'saida', titulo: 'Saída', sub: 'Gasto na conta', icone: '↗', cor: 'var(--color-saida)' },
  { id: 'cartao', titulo: 'Cartão', sub: 'Compra no crédito', icone: '💳', cor: 'var(--color-cartao)' },
  { id: 'fixo', titulo: 'Fixo', sub: 'Repete todo mês', icone: '🔁', cor: 'var(--color-alerta)' },
  { id: 'economia', titulo: 'Economia', sub: 'Guardar na reserva', icone: '🐷', cor: 'var(--color-destaque)' },
];

const TITULOS: Record<Escolha, string> = {
  entrada: 'Nova entrada', saida: 'Nova saída', cartao: 'Compra no cartão', fixo: 'Novo fixo', economia: 'Guardar dinheiro', detalhes: 'Novo lançamento',
};

/** Aberto pelo + da barra: escolha o tipo, ou digite como fala. */
export function PainelLancamento({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const cad = useCadastros();
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [inicial, setInicial] = useState<InicialLancamento>({});
  useEffect(() => { if (!aberto) { setEscolha(null); setInicial({}); } }, [aberto]);

  let conteudo = null;
  if (cad && escolha === 'fixo') conteudo = <FormRecorrencia aoFechar={aoFechar} />;
  else if (cad && escolha === 'economia') conteudo = <FormEconomia cad={cad} aoFechar={aoFechar} />;
  else if (cad && escolha) conteudo = <FormLancamento cad={cad} inicial={inicial} modo={escolha === 'detalhes' ? undefined : (escolha as ModoLancamento)} aoFechar={aoFechar} />;
  else if (cad) conteudo = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {OPCOES.map((o, i) => (
          <button key={o.id} type="button" onClick={() => setEscolha(o.id)}
            className={`flex items-center gap-3 rounded-2xl border border-borda bg-superficie px-3 py-3 text-left active:scale-[0.98] ${i === OPCOES.length - 1 ? 'col-span-2' : ''}`}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl font-bold"
              style={{ background: `color-mix(in srgb, ${o.cor} 16%, transparent)`, color: o.cor }} aria-hidden="true">{o.icone}</span>
            <span className="min-w-0">
              <span className="block font-bold">{o.titulo}</span>
              <span className="block truncate text-xs text-texto-2">{o.sub}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-texto-2">
        <span className="h-px flex-1 bg-borda" />ou digite como fala<span className="h-px flex-1 bg-borda" />
      </div>
      <LancamentoRapido cad={cad} aoDetalhes={(i) => { setInicial(i); setEscolha('detalhes'); }} />
    </div>
  );

  return (
    <Folha aberta={aberto} titulo={escolha ? TITULOS[escolha] : 'O que você quer lançar?'} aoFechar={aoFechar}>
      {escolha && (
        <button type="button" onClick={() => setEscolha(null)} className="-mt-2 mb-3 text-sm font-bold text-destaque">‹ Trocar tipo</button>
      )}
      {conteudo}
    </Folha>
  );
}
