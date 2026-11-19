import { useState } from 'react';
import { Tela } from '../componentes/Tela';
import { IconeSeta, IconeVoltar } from '../componentes/Icones';
import { diasNoMes, hojeISO, mesDe, nomeDoMes, somarMeses } from '../calculos/datas';

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const COLUNAS = ['entradas', 'saídas', 'cartão', 'fixos'] as const;

/** Grade do mês dia a dia. Na Fase 0 mostra só a estrutura; os valores chegam na Fase 2. */
export function Saldos() {
  const hoje = hojeISO();
  const [mes, setMes] = useState(mesDe(hoje));
  const [coluna, setColuna] = useState<(typeof COLUNAS)[number]>('entradas');
  const [a, m] = mes.split('-').map(Number);
  const dias = Array.from({ length: diasNoMes(mes) }, (_, i) => i + 1);

  return (
    <Tela titulo="Saldos">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" aria-label="Mês anterior" onClick={() => setMes(somarMeses(mes, -1))} className="rounded-full p-2 hover:bg-superficie-2">
          <IconeVoltar className="h-5 w-5" />
        </button>
        <p className="font-bold first-letter:uppercase">{nomeDoMes(mes)}</p>
        <button type="button" aria-label="Próximo mês" onClick={() => setMes(somarMeses(mes, 1))} className="rounded-full p-2 hover:bg-superficie-2">
          <IconeSeta className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Coluna exibida">
        {COLUNAS.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={coluna === c}
            onClick={() => setColuna(c)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold ${
              coluna === c ? 'border-texto bg-texto text-fundo' : 'border-borda bg-superficie text-texto-2'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-borda bg-superficie">
        <div className="grid grid-cols-[3.5rem_1fr_1fr] border-b border-borda px-3 py-2 text-xs font-bold uppercase tracking-wider text-texto-2">
          <span>dia</span><span className="text-right">{coluna}</span><span className="text-right">saldo</span>
        </div>
        <ol>
          {dias.map((d) => {
            const iso = `${mes}-${String(d).padStart(2, '0')}`;
            const ehHoje = iso === hoje;
            const semana = new Date(a, m - 1, d).getDay();
            return (
              <li key={d} className={`grid grid-cols-[3.5rem_1fr_1fr] items-center border-b border-borda last:border-0 ${ehHoje ? 'bg-superficie-2' : ''}`}>
                <span className={`flex flex-col px-3 py-2 leading-tight ${semana === 0 || semana === 6 ? 'text-texto-2' : ''}`}>
                  <span className={`font-bold ${ehHoje ? 'text-destaque' : ''}`}>{d}</span>
                  <span className="text-[10px] uppercase">{ehHoje ? 'hoje' : DIAS_SEMANA[semana]}</span>
                </span>
                <span className="px-3 text-right text-texto-2/50">—</span>
                <span className="self-stretch bg-superficie-2/60 px-3 py-2 text-right leading-[2.1rem] text-texto-2/50">—</span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="mt-3 text-center text-xs text-texto-2">Os valores e as cores do saldo chegam na Fase 2.</p>
    </Tela>
  );
}
