import { IconeSeta } from '../componentes/Icones';
import { linkPara, type Rota } from '../navegacao';

const ITENS: { rota: Rota; titulo: string; sub: string }[] = [
  { rota: 'lancamentos', titulo: 'Lançamentos', sub: 'Lista, filtros, editar e excluir' },
  { rota: 'para-onde-foi', titulo: 'Para onde foi', sub: 'Gastos por categoria' },
  { rota: 'cartoes', titulo: 'Cartões', sub: 'Faturas, parcelas e limite' },
  { rota: 'limites', titulo: 'Limites por categoria', sub: 'Quanto pode gastar em cada coisa' },
  { rota: 'metas', titulo: 'Reserva e metas', sub: 'Progresso e aportes' },
  { rota: 'investimentos', titulo: 'Investimentos', sub: 'Carteira e caixinhas' },
  { rota: 'configuracoes', titulo: 'Configurações', sub: 'Contas, categorias, fontes, backup' },
];

export function Mais() {
  return (
    <main className="mx-auto max-w-md px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28">
      <h1 className="mb-5 text-xl font-bold tracking-tight">Mais</h1>
      <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
        {ITENS.map((i) => (
          <li key={i.rota}>
            <a href={linkPara(i.rota)} className="flex items-center gap-3 px-4 py-3.5 hover:bg-superficie-2">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{i.titulo}</span>
                <span className="block text-sm text-texto-2">{i.sub}</span>
              </span>
              <IconeSeta className="h-5 w-5 text-texto-2" />
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
