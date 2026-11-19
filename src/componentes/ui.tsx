// Peças de interface reutilizadas nos formulários.
import { useEffect, useId, type ReactNode } from 'react';
import { digitosParaCentavos, formatarReais } from '../calculos/dinheiro';

export function Botao({
  children, onClick, tipo = 'principal', type = 'button', disabled, className = '',
}: {
  children: ReactNode; onClick?: () => void; tipo?: 'principal' | 'secundario' | 'perigo' | 'texto';
  type?: 'button' | 'submit'; disabled?: boolean; className?: string;
}) {
  const estilos = {
    principal: 'bg-texto text-fundo',
    secundario: 'bg-superficie-2 text-texto',
    perigo: 'bg-transparent text-saida border border-saida/40',
    texto: 'bg-transparent text-destaque',
  }[tipo];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl px-4 py-3.5 font-bold transition active:scale-[0.98] disabled:opacity-40 ${estilos} ${className}`}
    >
      {children}
    </button>
  );
}

/** Rótulo + controle + mensagem de erro. */
export function Campo({ rotulo, erro, ajuda, children, id }: {
  rotulo: string; erro?: string; ajuda?: string; children: ReactNode; id: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-texto-2">{rotulo}</label>
      {children}
      {erro ? <p className="text-sm font-semibold text-saida">{erro}</p> : ajuda ? <p className="text-xs text-texto-2">{ajuda}</p> : null}
    </div>
  );
}

const classeEntrada =
  'w-full rounded-2xl border border-borda bg-superficie px-4 py-3 text-base text-texto placeholder:text-texto-2/60 focus:border-destaque focus:outline-none';

export function CampoTexto({ rotulo, valor, aoMudar, erro, ajuda, placeholder, autoFocus }: {
  rotulo: string; valor: string; aoMudar: (v: string) => void; erro?: string; ajuda?: string; placeholder?: string; autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <Campo rotulo={rotulo} erro={erro} ajuda={ajuda} id={id}>
      <input id={id} className={classeEntrada} value={valor} placeholder={placeholder} autoFocus={autoFocus}
        onChange={(e) => aoMudar(e.target.value)} />
    </Campo>
  );
}

/** Valor em reais: os dígitos enchem da direita (como no app do banco). */
export function CampoValor({ rotulo, valor, aoMudar, erro, ajuda, permitirNegativo }: {
  rotulo: string; valor: number; aoMudar: (centavos: number) => void; erro?: string; ajuda?: string; permitirNegativo?: boolean;
}) {
  const id = useId();
  const negativo = valor < 0;
  return (
    <Campo rotulo={rotulo} erro={erro} ajuda={ajuda} id={id}>
      <div className="flex gap-2">
        {permitirNegativo && (
          <button type="button" onClick={() => aoMudar(-valor)} aria-label={negativo ? 'Tornar positivo' : 'Tornar negativo'}
            className={`w-14 shrink-0 rounded-2xl border text-lg font-bold ${negativo ? 'border-saida text-saida' : 'border-borda text-texto-2'}`}>
            {negativo ? '−' : '+'}
          </button>
        )}
        <input id={id} inputMode="numeric" className={`${classeEntrada} text-right font-bold tabular-nums ${negativo ? 'text-saida' : ''}`}
          value={formatarReais(Math.abs(valor))}
          onChange={(e) => { const c = digitosParaCentavos(e.target.value); aoMudar(negativo ? -c : c); }} />
      </div>
    </Campo>
  );
}

export function CampoNumero({ rotulo, valor, aoMudar, erro, ajuda, min, max, sufixo }: {
  rotulo: string; valor: string; aoMudar: (v: string) => void; erro?: string; ajuda?: string; min?: number; max?: number; sufixo?: string;
}) {
  const id = useId();
  return (
    <Campo rotulo={rotulo} erro={erro} ajuda={ajuda} id={id}>
      <div className="relative">
        <input id={id} inputMode="decimal" className={`${classeEntrada} ${sufixo ? 'pr-12' : ''}`} value={valor} min={min} max={max}
          onChange={(e) => aoMudar(e.target.value)} />
        {sufixo && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-texto-2">{sufixo}</span>}
      </div>
    </Campo>
  );
}

export function CampoEscolha<T extends string>({ rotulo, valor, aoMudar, opcoes, erro, ajuda }: {
  rotulo: string; valor: T | ''; aoMudar: (v: T) => void; opcoes: { valor: T; rotulo: string }[]; erro?: string; ajuda?: string;
}) {
  const id = useId();
  return (
    <Campo rotulo={rotulo} erro={erro} ajuda={ajuda} id={id}>
      <select id={id} className={`${classeEntrada} appearance-none`} value={valor} onChange={(e) => aoMudar(e.target.value as T)}>
        {valor === '' && !opcoes.some((o) => o.valor === '') && <option value="">Escolha…</option>}
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
    </Campo>
  );
}

/** Botões lado a lado para poucas opções. */
export function Segmentos<T extends string>({ rotulo, valor, aoMudar, opcoes }: {
  rotulo?: string; valor: T; aoMudar: (v: T) => void; opcoes: { valor: T; rotulo: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {rotulo && <span className="text-sm font-bold text-texto-2">{rotulo}</span>}
      <div role="radiogroup" aria-label={rotulo} className="flex gap-1 rounded-2xl bg-superficie-2 p-1">
        {opcoes.map((o) => (
          <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor} onClick={() => aoMudar(o.valor)}
            className={`flex-1 rounded-xl px-2 py-2.5 text-sm font-bold transition ${valor === o.valor ? 'bg-superficie text-texto shadow-sm' : 'text-texto-2'}`}>
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Painel que sobe de baixo. Fecha tocando fora ou com Esc. */
export function Folha({ aberta, titulo, aoFechar, children }: {
  aberta: boolean; titulo: string; aoFechar: () => void; children: ReactNode;
}) {
  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = ''; };
  }, [aberta, aoFechar]);
  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={aoFechar}>
      <div role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[92%] w-full max-w-md overflow-y-auto rounded-t-3xl bg-fundo px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-borda" />
        <h2 className="mb-4 text-lg font-bold">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

/** Linha de lista tocável (abre edição). */
export function LinhaItem({ titulo, sub, direita, marcador, aoTocar }: {
  titulo: ReactNode; sub?: ReactNode; direita?: ReactNode; marcador?: ReactNode; aoTocar: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={aoTocar} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-superficie-2">
        {marcador}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{titulo}</span>
          {sub && <span className="block truncate text-sm text-texto-2">{sub}</span>}
        </span>
        {direita && <span className="shrink-0 text-right font-bold tabular-nums">{direita}</span>}
      </button>
    </li>
  );
}
