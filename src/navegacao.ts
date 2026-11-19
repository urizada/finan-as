import { useEffect, useState } from 'react';

export type Rota =
  | 'hoje' | 'saldos' | 'totais' | 'mais'
  | 'lancamentos' | 'previsao' | 'para-onde-foi' | 'cartoes' | 'metas' | 'investimentos' | 'configuracoes';

const ROTAS: Rota[] = [
  'hoje', 'saldos', 'totais', 'mais',
  'lancamentos', 'previsao', 'para-onde-foi', 'cartoes', 'metas', 'investimentos', 'configuracoes',
];

function lerRota(): Rota {
  const r = location.hash.replace(/^#\/?/, '') as Rota; // aceita #saldos e #/saldos
  return ROTAS.includes(r) ? r : 'hoje';
}

/** Navegação por hash (#saldos): o gesto de voltar do celular funciona. */
export function useRota(): Rota {
  const [rota, setRota] = useState(lerRota);
  useEffect(() => {
    const ao = () => { setRota(lerRota()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', ao);
    return () => window.removeEventListener('hashchange', ao);
  }, []);
  return rota;
}

export const linkPara = (rota: Rota) => (rota === 'hoje' ? '#' : `#${rota}`);

/** A qual aba da barra inferior cada rota pertence. */
export function abaDe(rota: Rota): Rota {
  if (rota === 'hoje' || rota === 'saldos' || rota === 'totais') return rota;
  if (rota === 'previsao') return 'totais';
  return 'mais';
}
