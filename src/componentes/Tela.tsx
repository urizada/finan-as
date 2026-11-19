import type { ReactNode } from 'react';
import { IconeVoltar } from './Icones';

/** Moldura padrão de cada tela: título, botão voltar opcional e conteúdo. */
export function Tela({ titulo, voltar, children }: { titulo: string; voltar?: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28">
      <header className="mb-5 flex items-center gap-2">
        {voltar && (
          <a href={voltar} aria-label="Voltar" className="-ml-2 rounded-full p-2 text-texto-2 hover:text-texto">
            <IconeVoltar className="h-5 w-5" />
          </a>
        )}
        <h1 className="text-xl font-bold tracking-tight text-balance">{titulo}</h1>
      </header>
      {children}
    </main>
  );
}

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-borda bg-superficie p-4 ${className}`}>{children}</section>;
}

/** Aviso de tela que ainda será construída numa fase futura. */
export function EmConstrucao({ fase, itens }: { fase: number; itens: string[] }) {
  return (
    <Cartao>
      <p className="text-xs font-semibold uppercase tracking-wider text-texto-2">Chega na Fase {fase}</p>
      <ul className="mt-3 space-y-1.5 text-sm text-texto-2">
        {itens.map((i) => (
          <li key={i} className="flex gap-2"><span className="text-destaque">•</span>{i}</li>
        ))}
      </ul>
    </Cartao>
  );
}
