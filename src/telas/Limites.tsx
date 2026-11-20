// Plano do mês: quanto guardar primeiro e quanto gastar no dia a dia (comida, transporte, lazer…).
// O plano de cada categoria é o seu limite: avisa perto de 80% e quando passa.
import { useCallback, useState } from 'react';
import { Tela } from '../componentes/Tela';
import { Botao, CampoValor, Folha } from '../componentes/ui';
import { repositorio } from '../data/repositorio';
import { limitesDoMes, resumoHoje, type LinhaLimite } from '../data/servicos';
import { useConsulta } from '../data/useConsulta';
import { diasNoMes, hojeISO, mesDe } from '../calculos/datas';
import { formatarReais } from '../calculos/dinheiro';
import { linkPara } from '../navegacao';
import type { Categoria } from '../tipos';

const COR = { ok: 'bg-destaque', perto: 'bg-alerta', estourado: 'bg-saida' } as const;
/** Categorias que costumam ser do dia a dia aparecem primeiro. */
const DIA_A_DIA = ['Alimentação', 'Mercado', 'Transporte', 'Lazer', 'Compras', 'Cuidados pessoais', 'Saúde', 'Pets', 'Educação', 'Outros'];

export function BarraLimite({ l }: { l: LinhaLimite }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-lg">{l.categoria.icone}</span>
        <span className="min-w-0 flex-1 truncate font-bold">{l.categoria.nome}</span>
        <span className="shrink-0 text-sm tabular-nums"><b>{formatarReais(l.gasto)}</b> <span className="text-texto-2">de {formatarReais(l.limite)}</span></span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-superficie-2" role="progressbar" aria-valuenow={l.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${l.categoria.nome}: ${l.pct}% do plano`}>
        <div className={`h-full rounded-full ${COR[l.estado]}`} style={{ width: `${Math.min(100, l.pct)}%` }} />
      </div>
      <p className={`text-xs font-semibold ${l.estado === 'estourado' ? 'text-saida' : l.estado === 'perto' ? 'text-alerta' : 'text-texto-2'}`}>
        {l.estado === 'estourado' ? `Passou ${formatarReais(-l.restante)} do planejado` : `Ainda pode gastar ${formatarReais(l.restante)}`}
      </p>
    </div>
  );
}

type Editando = { tipo: 'categoria'; c: Categoria } | { tipo: 'guardar' } | null;

export function Limites() {
  const mes = mesDe(hojeISO());
  const [editando, setEditando] = useState<Editando>(null);
  const fechar = useCallback(() => setEditando(null), []);
  const dados = useConsulta(() => limitesDoMes(mes), [mes]);
  const r = useConsulta(() => resumoHoje(), []);
  const l = r?.livre;
  const dias = diasNoMes(mes);
  const ordem = (c: Categoria) => { const i = DIA_A_DIA.indexOf(c.nome); return i < 0 ? 99 : i; };
  const semPlano = (dados?.semLimite ?? []).slice().sort((a, b) => ordem(a.categoria) - ordem(b.categoria));
  const principais = semPlano.filter((x) => ordem(x.categoria) < 99);
  const outras = semPlano.filter((x) => ordem(x.categoria) === 99);

  return (
    <Tela titulo="Plano do mês" voltar={linkPara('mais')}>
      <div className="flex flex-col gap-5">
        {l && (
          <section className="rounded-3xl border border-borda bg-superficie px-5 py-4">
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between"><span className="text-texto-2">Entra no mês (com o que já tinha)</span><b className="tabular-nums text-entrada">{formatarReais(l.partida + l.entradas)}</b></div>
              <div className="flex justify-between"><span className="text-texto-2">Contas fixas e parcelas</span><b className="tabular-nums">− {formatarReais(l.fixos + l.parcelas)}</b></div>
              <button type="button" onClick={() => setEditando({ tipo: 'guardar' })} className="flex justify-between text-left">
                <span className="text-texto-2">Guardar primeiro <span className="font-bold text-destaque">editar</span></span>
                <b className="tabular-nums">− {formatarReais(Math.max(l.guardarMeta, l.guardado))}</b>
              </button>
              <div className="mt-1 flex justify-between border-t border-borda pt-2 text-base"><span className="font-bold">Dá para o dia a dia</span><b className={`tabular-nums ${l.capacidade < 0 ? 'text-saida' : ''}`}>{formatarReais(l.capacidade)}</b></div>
            </div>
            {l.planejado > 0 ? (
              <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${l.planoAcima > 0 ? 'bg-saldo-apertado' : 'bg-saldo-ok'}`}>
                Seu plano: <b>{formatarReais(l.planejado)}</b> no mês, cerca de <b>{formatarReais(l.mediaPorDia)} por dia</b>.
                {l.planoAcima > 0 ? <> Passa <b>{formatarReais(l.planoAcima)}</b> do que dá: diminua alguma categoria.</> : l.sobraNoFim > 0 ? <> Sobram {formatarReais(l.sobraNoFim)} além do que vai guardar.</> : null}
              </p>
            ) : (
              <p className="mt-3 rounded-xl bg-superficie-2 px-3 py-2 text-sm">Sem plano, o app divide tudo o que dá para o dia a dia pelos dias do mês. Planeje as categorias abaixo para ter mais controle.</p>
            )}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-bold uppercase tracking-wider text-texto-2">Quanto quer gastar no mês</h2>
          {dados && dados.comLimite.length > 0 && (
            <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-superficie">
              {dados.comLimite.map((x) => (
                <li key={x.categoria.id}>
                  <button type="button" onClick={() => setEditando({ tipo: 'categoria', c: x.categoria })} className="w-full px-4 py-3.5 text-left"><BarraLimite l={x} /></button>
                </li>
              ))}
            </ul>
          )}
          {principais.length > 0 && (
            <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
              {principais.map(({ categoria, gasto }) => (
                <li key={categoria.id}>
                  <button type="button" onClick={() => setEditando({ tipo: 'categoria', c: categoria })} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <span aria-hidden="true" className="text-lg">{categoria.icone}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{categoria.nome}</span>
                    {gasto > 0 && <span className="text-xs tabular-nums text-texto-2">gastou {formatarReais(gasto)}</span>}
                    <span className="text-sm font-bold text-destaque">+ planejar</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {outras.length > 0 && (
            <details className="rounded-2xl border border-borda bg-superficie">
              <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-texto-2">Outras categorias ({outras.length})</summary>
              <ul className="divide-y divide-borda border-t border-borda">
                {outras.map(({ categoria }) => (
                  <li key={categoria.id}>
                    <button type="button" onClick={() => setEditando({ tipo: 'categoria', c: categoria })} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                      <span aria-hidden="true">{categoria.icone}</span><span className="flex-1 font-semibold">{categoria.nome}</span><span className="text-sm font-bold text-destaque">+ planejar</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="px-1 text-xs text-texto-2">Ao lançar um gasto que chega a 80% ou passa do planejado na categoria, o app pergunta se você quer continuar.</p>
        </section>
      </div>

      <Folha aberta={editando !== null} aoFechar={fechar}
        titulo={editando?.tipo === 'guardar' ? 'Quanto guardar por mês' : editando ? `${editando.c.icone} ${editando.c.nome}` : ''}>
        {editando?.tipo === 'guardar' && <EditarGuardar atual={l?.guardarMeta ?? 0} entradas={(l?.entradas ?? 0)} aoFechar={fechar} />}
        {editando?.tipo === 'categoria' && <EditarPlano c={editando.c} dias={dias} aoFechar={fechar} />}
      </Folha>
    </Tela>
  );
}

function EditarPlano({ c, dias, aoFechar }: { c: Categoria; dias: number; aoFechar: () => void }) {
  const [valor, setValor] = useState(c.limiteMensal ?? 0);
  async function salvar(v: number) {
    const { limiteMensal: _, ...resto } = c;
    await repositorio.categorias.salvar(v > 0 ? { ...resto, limiteMensal: v } : resto);
    aoFechar();
  }
  return (
    <div className="flex flex-col gap-4">
      <CampoValor rotulo="Quanto quer gastar por mês" valor={valor} aoMudar={setValor}
        ajuda={valor > 0 ? `Cerca de ${formatarReais(Math.floor(valor / dias))} por dia, ${formatarReais(Math.floor((valor * 12) / 52))} por semana.` : 'Ex.: lazer R$ 300 por mês.'} />
      <Botao onClick={() => salvar(valor)}>Salvar</Botao>
      {c.limiteMensal ? <Botao tipo="texto" onClick={() => salvar(0)}>Tirar do plano</Botao> : null}
    </div>
  );
}

function EditarGuardar({ atual, entradas, aoFechar }: { atual: number; entradas: number; aoFechar: () => void }) {
  const [valor, setValor] = useState(atual);
  const sugestoes = [10, 15, 20].map((p) => Math.round((entradas * p) / 100 / 100) * 100).filter((v) => v > 0);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texto-2">Guardar primeiro é o hábito que mais ajuda: o app separa esse valor antes de calcular quanto dá para gastar por dia.</p>
      <CampoValor rotulo="Quanto quer guardar por mês" valor={valor} aoMudar={setValor} />
      {sugestoes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sugestoes.map((v, i) => (
            <button key={v} type="button" onClick={() => setValor(v)} className="rounded-full bg-superficie-2 px-3 py-1.5 text-sm font-bold">
              {[10, 15, 20][i]}% · {formatarReais(v)}
            </button>
          ))}
        </div>
      )}
      <Botao onClick={async () => { await repositorio.salvarConfig({ guardarPorMes: valor }); aoFechar(); }}>Salvar</Botao>
    </div>
  );
}
