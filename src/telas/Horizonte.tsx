// Horizonte de saldos: um mês por coluna, um dia por linha. Mostra até quando sobra e quando falta.
import { useEffect, useRef } from 'react';
import { IconeVoltar } from '../componentes/Icones';
import { horizonte } from '../data/servicos';
import { useConsulta } from '../data/useConsulta';
import { formatarReais } from '../calculos/dinheiro';
import { saldoCurto } from '../calculos/saldos';
import { irParaDia, linkPara } from '../navegacao';
import { FUNDO_COR } from './Saldos';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ALTURA = 'h-11';

export function Horizonte() {
  const h = useConsulta(() => horizonte(12), []);
  const caixa = useRef<HTMLDivElement>(null);
  const linhaHoje = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!h || !caixa.current || !linhaHoje.current) return;
    const c = caixa.current.getBoundingClientRect();
    const l = linhaHoje.current.getBoundingClientRect();
    caixa.current.scrollTop += l.top - c.top - c.height / 3;
  }, [h]);

  const primeiroNegativo = h?.meses.flatMap((m) => m.dias).find((d) => d.saldo !== null && d.saldo < 0 && d.data >= h.hoje);

  return (
    <main className="mx-auto flex h-full max-w-3xl flex-col pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-2 px-4 pb-2">
        <a href={linkPara('saldos')} aria-label="Voltar para Saldos" className="-ml-2 rounded-full p-2"><IconeVoltar className="h-5 w-5" /></a>
        <h1 className="text-xl font-extrabold tracking-tight">Horizonte de saldos</h1>
      </header>
      {h && (
        <p className="px-4 pb-2 text-sm text-texto-2">
          {primeiroNegativo
            ? <>O dinheiro fica negativo a partir de <b className="text-saida">{primeiroNegativo.data.slice(8)}/{primeiroNegativo.data.slice(5, 7)}/{primeiroNegativo.data.slice(2, 4)}</b>. Toque num dia para ver o que acontece nele.</>
            : <>Nos próximos 12 meses o saldo não fica negativo. Toque num dia para ver o que acontece nele.</>}
        </p>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-2 text-[11px] text-texto-2">
        {[['bg-h-forte', 'sobra bem'], ['bg-h-bom', 'cobre o mês'], ['bg-h-apertado', 'apertado'], ['bg-h-pouco', 'pouco negativo'], ['bg-h-negativo', 'negativo']].map(([c, t]) => (
          <span key={t} className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-sm ${c}`} />{t}</span>
        ))}
      </div>

      <div ref={caixa} className="min-h-0 flex-1 overflow-auto border-t border-borda pb-24" aria-label="Saldo previsto por dia, um mês por coluna">
        {h && (
          <div className="flex w-max">
            {h.meses.map((m, i) => {
              const [a, mm] = m.mes.split('-').map(Number);
              return (
                <section key={m.mes} className="w-[8.75rem] shrink-0 border-r border-borda" aria-label={`${MESES[mm - 1]} de ${a}`}>
                  <div className={`sticky top-0 z-10 flex h-14 flex-col items-center justify-center border-b border-borda ${i === 0 ? 'bg-texto text-fundo' : 'bg-fundo'}`}>
                    <span className="font-extrabold">{MESES[mm - 1]}/{String(a).slice(2)}</span>
                    {m.fim !== null && <span className={`text-[10px] font-semibold ${i === 0 ? 'opacity-80' : m.fim < 0 ? 'text-saida' : 'text-texto-2'}`}>fim {saldoCurto(m.fim)}</span>}
                  </div>
                  {Array.from({ length: 31 }, (_, k) => {
                    const d = m.dias[k];
                    if (!d) return <div key={k} className={`${ALTURA} border-b border-borda bg-superficie-2/40`} />;
                    const semana = new Date(a, mm - 1, d.dia).getDay();
                    const hoje = d.data === h.hoje;
                    return (
                      <div key={k} ref={hoje ? linhaHoje : undefined}>
                        <button type="button" onClick={() => irParaDia(d.data)}
                          aria-label={`${d.dia}/${mm}: ${d.saldo === null ? 'sem dados' : formatarReais(d.saldo)}`}
                          className={`grid ${ALTURA} w-full grid-cols-[2.25rem_1fr] border-b border-borda text-left`}>
                          <span className={`flex items-center justify-center text-sm ${hoje ? 'bg-texto font-bold text-fundo' : semana === 0 || semana === 6 ? 'bg-superficie-2' : 'bg-superficie'}`}>{d.dia}</span>
                          <span className={`flex items-center justify-end pr-2.5 text-sm font-semibold tabular-nums ${d.cor ? FUNDO_COR[d.cor] : 'bg-superficie-2/40 text-texto-2/60'}`}>
                            {d.saldo === null ? '—' : saldoCurto(d.saldo)}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
