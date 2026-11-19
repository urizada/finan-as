import { useCallback, useState } from 'react';
import { Tela } from '../componentes/Tela';
import { FormLancamento, LinhaLancamento, SeletorMes, rotuloDia } from '../componentes/lancamentos';
import { CampoEscolha, Folha, Segmentos } from '../componentes/ui';
import { garantirFixosDoMes } from '../data/servicos';
import { repositorio } from '../data/repositorio';
import { useCadastros } from '../data/useCadastros';
import { useConsulta } from '../data/useConsulta';
import { hojeISO, mesDe } from '../calculos/datas';
import { formatarReais } from '../calculos/dinheiro';
import { agruparPorDia, filtrarLancamentos } from '../calculos/lancamentos';
import { linkPara } from '../navegacao';
import type { Lancamento } from '../tipos';

export function Lancamentos() {
  const [mes, setMes] = useState(mesDe(hojeISO()));
  const [tipo, setTipo] = useState<'todos' | 'saida' | 'entrada'>('todos');
  const [categoriaId, setCategoriaId] = useState('');
  const [cartaoId, setCartaoId] = useState('');
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const fechar = useCallback(() => setEditando(null), []);
  const lancs = useConsulta(async () => { await garantirFixosDoMes(mes); return repositorio.lancamentos.porMes(mes); }, [mes]);
  const cad = useCadastros();

  const filtrados = filtrarLancamentos(lancs ?? [], {
    tipo: tipo === 'todos' ? undefined : tipo, categoriaId: categoriaId || undefined, cartaoId: cartaoId || undefined,
  });
  const grupos = agruparPorDia(filtrados);
  const entrou = filtrados.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
  const saiu = filtrados.filter((l) => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0);
  const cats = (cad?.categorias ?? []).filter((c) => tipo === 'todos' || c.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <Tela titulo="Lançamentos" voltar={linkPara('mais')}>
      <div className="flex flex-col gap-3">
        <SeletorMes mes={mes} aoMudar={setMes} />
        <Segmentos valor={tipo} aoMudar={(t) => { setTipo(t); setCategoriaId(''); }}
          opcoes={[{ valor: 'todos', rotulo: 'Todos' }, { valor: 'saida', rotulo: 'Gastos' }, { valor: 'entrada', rotulo: 'Entradas' }]} />
        <div className={`grid gap-2 ${cad && cad.cartoes.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <CampoEscolha rotulo="Categoria" valor={categoriaId} aoMudar={setCategoriaId}
            opcoes={[{ valor: '', rotulo: 'Todas' }, ...cats.map((c) => ({ valor: c.id, rotulo: `${c.icone} ${c.nome}` }))]} />
          {cad && cad.cartoes.length > 0 && (
            <CampoEscolha rotulo="Cartão" valor={cartaoId} aoMudar={setCartaoId}
              opcoes={[{ valor: '', rotulo: 'Todos' }, ...cad.cartoes.map((c) => ({ valor: c.id, rotulo: c.nome }))]} />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-borda bg-superficie px-3 py-2">
            <p className="text-xs font-bold text-texto-2">Entradas</p>
            <p className="text-lg font-extrabold tabular-nums text-entrada">{formatarReais(entrou)}</p>
          </div>
          <div className="rounded-2xl border border-borda bg-superficie px-3 py-2">
            <p className="text-xs font-bold text-texto-2">Saídas</p>
            <p className="text-lg font-extrabold tabular-nums">{formatarReais(saiu)}</p>
          </div>
        </div>

        {lancs && cad && (grupos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-borda px-4 py-6 text-center text-sm text-texto-2">
            Nenhum lançamento {categoriaId || cartaoId || tipo !== 'todos' ? 'com esses filtros' : 'neste mês'}. Toque no + para lançar.
          </p>
        ) : grupos.map((g) => (
          <section key={g.data}>
            <div className="mb-1.5 mt-2 flex items-baseline justify-between px-1">
              <h2 className="text-sm font-bold">{rotuloDia(g.data)}</h2>
              <span className="text-xs tabular-nums text-texto-2">
                {g.entradas > 0 && <span className="text-entrada">+{formatarReais(g.entradas)} </span>}
                {g.saidas > 0 && <span>−{formatarReais(g.saidas)}</span>}
              </span>
            </div>
            <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
              {g.itens.map((l) => <LinhaLancamento key={l.id} l={l} cad={cad} aoTocar={() => setEditando(l)} />)}
            </ul>
          </section>
        )))}
      </div>
      <Folha aberta={editando !== null} titulo="Editar lançamento" aoFechar={fechar}>
        {editando && cad && <FormLancamento item={editando} cad={cad} aoFechar={fechar} />}
      </Folha>
    </Tela>
  );
}
