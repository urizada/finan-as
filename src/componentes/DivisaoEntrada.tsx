// 5.7: quando uma entrada garantida cai, sugere como usar o dinheiro. Você confirma ou edita.
import { useEffect, useState } from 'react';
import { guardarNaReserva, sugerirDivisao } from '../data/servicos';
import { formatarReais } from '../calculos/dinheiro';
import type { Divisao } from '../calculos/orcamento';
import type { Centavos } from '../tipos';
import { CampoValor } from './ui';

export function DivisaoEntrada({ valor, aoFechar }: { valor: Centavos; aoFechar: () => void }) {
  const [d, setD] = useState<Divisao | null>(null);
  const [reserva, setReserva] = useState<number | null>(null);
  useEffect(() => { sugerirDivisao(valor).then(setD); }, [valor]);
  if (!d) return <p className="py-6 text-center text-texto-2">Calculando…</p>;
  const guardar = reserva ?? d.reserva;
  const livre = valor - d.fixos - guardar - d.investimentos - d.metas;
  const linha = (rot: string, v: number, sub: string, cor = '') => (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span><span className="block font-bold">{rot}</span><span className="block text-xs text-texto-2">{sub}</span></span>
      <span className={`shrink-0 whitespace-nowrap font-bold tabular-nums ${cor}`}>{formatarReais(v)}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-texto-2">Entraram <b className="text-entrada">{formatarReais(valor)}</b>. Sugestão de como usar:</p>
      <div className="divide-y divide-borda rounded-2xl bg-superficie px-4">
        {linha('Fixos do mês', d.fixos, d.fixos > 0 ? 'Primeiro, cobrir o que falta pagar até o fim do mês' : 'Os fixos do mês já estão cobertos')}
        {d.investimentos > 0 && linha('Investimentos', d.investimentos, 'Separe para investir (cadastro de investimentos na Fase 6)')}
        {d.metas > 0 && linha('Metas', d.metas, 'Para suas metas')}
        {linha('Livre para gastar', Math.max(0, livre), 'Entra no seu livre por dia', 'text-entrada')}
      </div>
      <CampoValor rotulo="Guardar na reserva agora" valor={guardar} aoMudar={(v) => setReserva(Math.min(v, valor - d.fixos))}
        ajuda="Você pode mudar o valor. Os percentuais ficam em Configurações › Divisão das entradas." />
      <div className="flex gap-2">
        <button type="button" onClick={aoFechar} className="flex-1 rounded-2xl bg-superficie-2 py-3.5 font-bold">Agora não</button>
        <button type="button" disabled={guardar <= 0} onClick={async () => { await guardarNaReserva(guardar); aoFechar(); }}
          className="flex-[2] rounded-2xl bg-texto py-3.5 font-bold text-fundo disabled:opacity-40">Guardar {formatarReais(guardar)}</button>
      </div>
    </div>
  );
}
