import { abaDe, linkPara, type Rota } from '../navegacao';
import { IconeHoje, IconeMais, IconeMenu, IconeSaldos, IconeTotais } from './Icones';

type Aba = { rota: Rota; rotulo: string; Icone: (p: { className?: string }) => React.JSX.Element };

const ESQUERDA: Aba[] = [
  { rota: 'hoje', rotulo: 'Hoje', Icone: IconeHoje },
  { rota: 'saldos', rotulo: 'Saldos', Icone: IconeSaldos },
];
const DIREITA: Aba[] = [
  { rota: 'totais', rotulo: 'Totais', Icone: IconeTotais },
  { rota: 'mais', rotulo: 'Mais', Icone: IconeMenu },
];

export function BarraNavegacao({ rota, aoLancar }: { rota: Rota; aoLancar: () => void }) {
  const ativa = abaDe(rota);
  const item = ({ rota: r, rotulo, Icone }: Aba) => {
    const atual = ativa === r;
    return (
      <li key={r}>
        <a
          href={linkPara(r)}
          aria-current={atual ? 'page' : undefined}
          className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-bold transition-colors ${
            atual ? 'text-destaque' : 'text-texto-2 hover:text-texto'
          }`}
        >
          <Icone className="h-6 w-6" />
          {rotulo}
        </a>
      </li>
    );
  };
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-superficie/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-center">
        {ESQUERDA.map(item)}
        <li className="flex justify-center">
          <button
            type="button"
            onClick={aoLancar}
            aria-label="Novo lançamento"
            className="flex h-14 w-14 -translate-y-1 items-center justify-center rounded-full bg-texto text-fundo shadow-lg shadow-black/20 active:scale-95 transition-transform"
          >
            <IconeMais className="h-7 w-7" />
          </button>
        </li>
        {DIREITA.map(item)}
      </ul>
    </nav>
  );
}
