// Limites por categoria: quanto já gastou de cada limite neste mês.
import { useCallback, useState } from 'react';
import { Tela } from '../componentes/Tela';
import { FormCategoria } from '../componentes/formularios';
import { SeletorMes } from '../componentes/lancamentos';
import { Folha } from '../componentes/ui';
import { limitesDoMes, type LinhaLimite } from '../data/servicos';
import { useConsulta } from '../data/useConsulta';
import { hojeISO, mesDe } from '../calculos/datas';
import { formatarReais } from '../calculos/dinheiro';
import { linkPara } from '../navegacao';
import type { Categoria } from '../tipos';

const COR = { ok: 'bg-destaque', perto: 'bg-alerta', estourado: 'bg-saida' } as const;

export function BarraLimite({ l }: { l: LinhaLimite }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-lg">{l.categoria.icone}</span>
        <span className="min-w-0 flex-1 truncate font-bold">{l.categoria.nome}</span>
        <span className="shrink-0 text-sm tabular-nums"><b>{formatarReais(l.gasto)}</b> <span className="text-texto-2">de {formatarReais(l.limite)}</span></span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-superficie-2" role="progressbar" aria-valuenow={l.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${l.categoria.nome}: ${l.pct}% do limite`}>
        <div className={`h-full rounded-full ${COR[l.estado]}`} style={{ width: `${Math.min(100, l.pct)}%` }} />
      </div>
      <p className={`text-xs font-semibold ${l.estado === 'estourado' ? 'text-saida' : l.estado === 'perto' ? 'text-alerta' : 'text-texto-2'}`}>
        {l.estado === 'estourado' ? `Passou ${formatarReais(-l.restante)} do limite` : `Ainda pode gastar ${formatarReais(l.restante)}`}
      </p>
    </div>
  );
}

export function Limites() {
  const [mes, setMes] = useState(mesDe(hojeISO()));
  const [editando, setEditando] = useState<Categoria | null>(null);
  const fechar = useCallback(() => setEditando(null), []);
  const dados = useConsulta(() => limitesDoMes(mes), [mes]);

  return (
    <Tela titulo="Limites por categoria" voltar={linkPara('mais')}>
      <div className="flex flex-col gap-4">
        <SeletorMes mes={mes} aoMudar={setMes} />
        <p className="text-sm text-texto-2">Ao lançar um gasto que chega a 80% ou passa do limite, o app pergunta se você quer continuar.</p>
        {dados?.comLimite.length ? (
          <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
            {dados.comLimite.map((l) => (
              <li key={l.categoria.id}>
                <button type="button" onClick={() => setEditando(l.categoria)} className="w-full px-4 py-3.5 text-left"><BarraLimite l={l} /></button>
              </li>
            ))}
          </ul>
        ) : dados && (
          <p className="rounded-2xl border border-dashed border-borda px-4 py-5 text-center text-sm text-texto-2">Nenhum limite ainda. Escolha uma categoria abaixo para colocar um.</p>
        )}
        {dados && dados.semLimite.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-texto-2">Sem limite</h2>
            <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
              {dados.semLimite.map(({ categoria, gasto }) => (
                <li key={categoria.id}>
                  <button type="button" onClick={() => setEditando(categoria)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <span aria-hidden="true" className="text-lg">{categoria.icone}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{categoria.nome}</span>
                    <span className="text-sm tabular-nums text-texto-2">{gasto > 0 ? `gastou ${formatarReais(gasto)}` : ''}</span>
                    <span className="text-sm font-bold text-destaque">+ limite</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <Folha aberta={editando !== null} titulo={editando ? `Limite de ${editando.nome}` : ''} aoFechar={fechar}>
        {editando && <FormCategoria item={editando} aoFechar={fechar} />}
      </Folha>
    </Tela>
  );
}
